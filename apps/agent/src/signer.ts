import { createDecipheriv, scryptSync, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  isAddress,
  keccak256,
  toHex,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

import {
  AgentRejection,
  revalidatePrepared,
  type AgentAuthority,
  type AgentPolicy,
  type ManualExecutionRequest,
  type PreparedExecution,
} from "./policy.js";

const hex = (bytes: number) => z.string().regex(new RegExp(`^[0-9a-fA-F]{${bytes * 2}}$`));
const KeystoreSchema = z.strictObject({
  version: z.literal(3),
  id: z.string().min(1),
  address: hex(20).optional(),
  crypto: z.strictObject({
    cipher: z.literal("aes-128-ctr"),
    cipherparams: z.strictObject({ iv: hex(16) }),
    ciphertext: hex(32),
    kdf: z.literal("scrypt"),
    kdfparams: z.strictObject({
      dklen: z.literal(32),
      n: z.number().int().min(2).max(1_048_576),
      r: z.number().int().min(1).max(32),
      p: z.number().int().min(1).max(16),
      salt: hex(32),
    }),
    mac: hex(32),
  }),
});

export interface MandateExecutionSigner {
  submit(prepared: PreparedExecution): Promise<{ txHash: Hash }>;
}

type ExecutionTransport = {
  send(request: ManualExecutionRequest): Promise<Hash>;
  wait(hash: Hash): Promise<{ status: "success" | "reverted" }>;
};

export interface SignerSecurityBoundary {
  policy: AgentPolicy;
  authority: AgentAuthority;
  now?: () => Date;
}

export function createPolicyBoundSignerForTransport(
  transport: ExecutionTransport,
  security: SignerSecurityBoundary,
): MandateExecutionSigner {
  return {
    async submit(prepared) {
      const request = await revalidatePrepared(prepared, security.policy);
      const txHash = await transport.send(request);
      const receipt = await transport.wait(txHash);
      if (receipt.status !== "success") throw new AgentRejection("ROUTE_REVERTED");
      return { txHash };
    },
  };
}

export interface DedicatedKeystoreConfiguration {
  keystorePath: string;
  keystorePassword: string;
  expectedSigner: Address;
  chainId: number;
  rpcUrl: string;
}

async function loadDedicatedAccount(configuration: DedicatedKeystoreConfiguration) {
  let parsed: z.infer<typeof KeystoreSchema>;
  try {
    parsed = KeystoreSchema.parse(JSON.parse(await readFile(configuration.keystorePath, "utf8")));
  } catch {
    throw new AgentRejection("CALLER_NOT_AGENT");
  }
  const ciphertext = Buffer.from(parsed.crypto.ciphertext, "hex");
  const derived = scryptSync(
    configuration.keystorePassword,
    Buffer.from(parsed.crypto.kdfparams.salt, "hex"),
    parsed.crypto.kdfparams.dklen,
    {
      N: parsed.crypto.kdfparams.n,
      r: parsed.crypto.kdfparams.r,
      p: parsed.crypto.kdfparams.p,
      maxmem: Math.max(
        128 * parsed.crypto.kdfparams.n * parsed.crypto.kdfparams.r + 1024,
        32 * 1024 * 1024,
      ),
    },
  );
  const expectedMac = Buffer.from(parsed.crypto.mac, "hex");
  const actualMac = Buffer.from(
    keccak256(toHex(Buffer.concat([derived.subarray(16, 32), ciphertext]))).slice(2),
    "hex",
  );
  if (!timingSafeEqual(expectedMac, actualMac)) {
    derived.fill(0);
    throw new AgentRejection("CALLER_NOT_AGENT");
  }
  const decipher = createDecipheriv(
    parsed.crypto.cipher,
    derived.subarray(0, 16),
    Buffer.from(parsed.crypto.cipherparams.iv, "hex"),
  );
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  derived.fill(0);
  const account = privateKeyToAccount(toHex(decrypted));
  decrypted.fill(0);
  if (
    account.address.toLowerCase() !== configuration.expectedSigner.toLowerCase() ||
    (parsed.address !== undefined &&
      parsed.address.toLowerCase() !== account.address.slice(2).toLowerCase())
  ) {
    throw new AgentRejection("CALLER_NOT_AGENT");
  }
  return account;
}

export interface DedicatedKeystoreSignerFactory {
  create(security: SignerSecurityBoundary): MandateExecutionSigner;
}

export async function createDedicatedKeystoreSignerFactory(
  configuration: DedicatedKeystoreConfiguration,
): Promise<DedicatedKeystoreSignerFactory> {
  if (
    !configuration.keystorePath ||
    !configuration.keystorePassword ||
    !isAddress(configuration.expectedSigner) ||
    !Number.isSafeInteger(configuration.chainId) ||
    configuration.chainId < 1 ||
    !URL.canParse(configuration.rpcUrl)
  ) {
    throw new AgentRejection("CALLER_NOT_AGENT");
  }
  const account = await loadDedicatedAccount(configuration);
  const chain = defineChain({
    id: configuration.chainId,
    name: `Mandate chain ${configuration.chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [configuration.rpcUrl] } },
  });
  const transport = http(configuration.rpcUrl);
  const wallet = createWalletClient({ account, chain, transport });
  const publicClient = createPublicClient({ chain, transport });

  return {
    create(security) {
      if (
        security.policy.signer !== configuration.expectedSigner.toLowerCase() ||
        security.policy.chainId !== configuration.chainId.toString()
      ) {
        throw new AgentRejection("CALLER_NOT_AGENT");
      }
      return createPolicyBoundSignerForTransport(
        {
          send: async (request) => {
            if (request.account !== account.address.toLowerCase()) {
              throw new AgentRejection("CALLER_NOT_AGENT");
            }
            return wallet.sendTransaction({
              account,
              to: request.to,
              data: request.data,
              value: request.value,
            });
          },
          wait: async (hash) => publicClient.waitForTransactionReceipt({ hash }),
        },
        security,
      );
    },
  };
}

export async function createDedicatedKeystoreSigner(
  configuration: DedicatedKeystoreConfiguration,
  security: SignerSecurityBoundary,
): Promise<MandateExecutionSigner> {
  return (await createDedicatedKeystoreSignerFactory(configuration)).create(security);
}
