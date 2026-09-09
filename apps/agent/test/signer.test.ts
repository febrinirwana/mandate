import { createCipheriv, randomUUID, scryptSync } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { keccak256, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { afterEach, expect, it, vi } from "vitest";

import { AgentRejection, createDedicatedKeystoreSigner, prepareExecution } from "../src/index.js";
import { createSignerForTransport } from "../src/signer.js";
import { authority, now, policy, request, simulation, strategy } from "./fixtures.js";

const directories: string[] = [];
const password = "test-only-password";
const privateKey: Hex = `0x${"11".repeat(32)}`;

async function fixtureKeystore(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "mandate-agent-"));
  directories.push(directory);
  const salt = Buffer.from("22".repeat(32), "hex");
  const iv = Buffer.from("33".repeat(16), "hex");
  const derived = scryptSync(password, salt, 32, { N: 1024, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
  const cipher = createCipheriv("aes-128-ctr", derived.subarray(0, 16), iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(privateKey.slice(2), "hex")),
    cipher.final(),
  ]);
  const mac = keccak256(toHex(Buffer.concat([derived.subarray(16, 32), ciphertext]))).slice(2);
  const account = privateKeyToAccount(privateKey);
  const path = join(directory, "agent.keystore");
  await writeFile(
    path,
    JSON.stringify({
      version: 3,
      id: randomUUID(),
      address: account.address.slice(2).toLowerCase(),
      crypto: {
        cipher: "aes-128-ctr",
        cipherparams: { iv: iv.toString("hex") },
        ciphertext: ciphertext.toString("hex"),
        kdf: "scrypt",
        kdfparams: { dklen: 32, n: 1024, r: 8, p: 1, salt: salt.toString("hex") },
        mac,
      },
    }),
  );
  return path;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

it("loads an encrypted dedicated keystore without exposing account material", async () => {
  const path = await fixtureKeystore();
  const account = privateKeyToAccount(privateKey);
  const signer = await createDedicatedKeystoreSigner({
    keystorePath: path,
    keystorePassword: password,
    expectedSigner: account.address.toLowerCase() as `0x${string}`,
    chainId: 31337,
    rpcUrl: "http://127.0.0.1:1",
  });

  expect(Object.keys(signer)).toEqual(["submit"]);
  expect("account" in signer).toBe(false);
  expect("signMessage" in signer).toBe(false);
  expect("signTransaction" in signer).toBe(false);
  expect("signTypedData" in signer).toBe(false);
});

it("rejects a keystore whose decrypted signer is not configured", async () => {
  const path = await fixtureKeystore();

  await expect(
    createDedicatedKeystoreSigner({
      keystorePath: path,
      keystorePassword: password,
      expectedSigner: strategy.agent,
      chainId: 31337,
      rpcUrl: "http://127.0.0.1:1",
    }),
  ).rejects.toMatchObject({ reason: "CALLER_NOT_AGENT" });
});

it("rejects a forged prepared request before transport submission", async () => {
  const send = vi.fn(() => Promise.resolve(request.strategy.salt));
  const signer = createSignerForTransport({
    send,
    wait: () => Promise.resolve({ status: "success" as const }),
  });

  await expect(signer.submit({ kind: "MANDATE_EXECUTE_PREPARED" } as never)).rejects.toBeInstanceOf(
    AgentRejection,
  );
  expect(send).not.toHaveBeenCalled();
});

it("revalidates freshness immediately before sending the exact prepared call", async () => {
  let current = now;
  const send = vi.fn(() => Promise.resolve(request.strategy.salt));
  const signer = createSignerForTransport({
    send,
    wait: () => Promise.resolve({ status: "success" as const }),
  });
  const prepared = await prepareExecution(
    {
      chainId: request.chainId,
      strategy,
      amountIn: request.amountIn,
      agentMinOut: request.agentMinOut,
      executionDeadline: request.executionDeadline,
      routeData: request.routeData,
      simulation,
    },
    policy,
    authority(),
    { now: () => current },
  );

  const result = await signer.submit(prepared);
  expect(send).toHaveBeenCalledWith(prepared.toManualRequest());
  expect(result.txHash).toBe(request.strategy.salt);

  current = new Date(simulation.binding.expiresAt);
  await expect(signer.submit(prepared)).rejects.toMatchObject({ reason: "SIMULATION_STALE" });
  expect(send).toHaveBeenCalledTimes(1);
});

it("treats a reverted receipt as a failed execution", async () => {
  const signer = createSignerForTransport({
    send: () => Promise.resolve(request.strategy.salt),
    wait: () => Promise.resolve({ status: "reverted" as const }),
  });
  const prepared = await prepareExecution(
    {
      chainId: request.chainId,
      strategy,
      amountIn: request.amountIn,
      agentMinOut: request.agentMinOut,
      executionDeadline: request.executionDeadline,
      routeData: request.routeData,
      simulation,
    },
    policy,
    authority(),
    { now: () => now },
  );

  await expect(signer.submit(prepared)).rejects.toMatchObject({ reason: "ROUTE_REVERTED" });
});
