import {
  getAddress,
  isAddress,
  keccak256,
  namehash,
  stringToHex,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { normalize } from "viem/ens";

/** Generated from contracts-v2 97a57293 deployment interfaces. */
export const permissionedRegistryAbi = [
  {
    type: "function",
    name: "getState",
    stateMutability: "view",
    inputs: [{ name: "anyId", type: "uint256" }],
    outputs: [
      {
        name: "state",
        type: "tuple",
        components: [
          { name: "status", type: "uint8" },
          { name: "expiry", type: "uint64" },
          { name: "latestOwner", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "resource", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
  },
  {
    type: "function",
    name: "getResolver",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ name: "resolver", type: "address" }],
  },
] as const satisfies Abi;

export const addrResolverAbi = [
  {
    type: "function",
    name: "addr",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "address", type: "address" }],
  },
] as const satisfies Abi;

export type EnsStatus = "AVAILABLE" | "RESERVED" | "REGISTERED";


export interface EnsIdentityRequest {
  blockNumber: bigint;
  registry: Address;
  label: string;
  name: string;
  expectedAgent: Address;
  expectedResolver: Address;
}

export interface EnsIdentity {
  chainId: number;
  blockNumber: bigint;
  blockHash: Hex;
  registry: Address;
  label: string;
  labelId: bigint;
  node: Hex;
  status: EnsStatus;
  expiry: bigint;
  tokenId: bigint;
  owner: Address;
  resolver: Address;
  resolvedAddress: Address;
  validation: {
    domain: boolean;
    registered: boolean;
    unexpired: boolean;
    ownerMatchesAgent: boolean;
    resolverMatchesExpected: boolean;
    addressMatchesAgent: boolean;
    valid: boolean;
  };
}

export interface SerializedEnsIdentity extends Omit<EnsIdentity, "blockNumber" | "labelId" | "expiry" | "tokenId"> {
  blockNumber: string;
  labelId: string;
  expiry: string;
  tokenId: string;
}

function requireNormalizedImmediateLabel(label: string, name: string): void {
  let normalizedLabel: string;
  let normalizedName: string;
  try {
    normalizedLabel = normalize(label);
    normalizedName = normalize(name);
  } catch {
    throw new Error("ENS label must be normalized and immediate");
  }

  if (
    label.length === 0 ||
    label !== normalizedLabel ||
    label.includes(".") ||
    name !== normalizedName ||
    !name.startsWith(`${label}.`)
  ) {
    throw new Error("ENS label must be normalized and immediate");
  }
}

function statusFrom(value: number | bigint): EnsStatus {
  switch (Number(value)) {
    case 0:
      return "AVAILABLE";
    case 1:
      return "RESERVED";
    case 2:
      return "REGISTERED";
    default:
      throw new Error(`unknown ENSv2 status ${value.toString()}`);
  }
}

export async function readEnsIdentity(client: PublicClient, request: EnsIdentityRequest): Promise<EnsIdentity> {
  requireNormalizedImmediateLabel(request.label, request.name);
  if (!isAddress(request.registry) || !isAddress(request.expectedAgent) || !isAddress(request.expectedResolver)) {
    throw new Error("ENS identity addresses must be valid");
  }

  const [chainId, header] = await Promise.all([
    client.getChainId(),
    client.getBlock({ blockNumber: request.blockNumber }),
  ]);
  if (header.number === null || header.hash === null) throw new Error("ENS identity block is unavailable");

  const blockNumber = header.number;
  const blockHash = header.hash;
  const registry = getAddress(request.registry);
  const expectedAgent = getAddress(request.expectedAgent);
  const expectedResolver = getAddress(request.expectedResolver);
  const labelId = BigInt(keccak256(stringToHex(request.label)));
  const node = namehash(request.name);

  const [state, resolverValue] = await Promise.all([
    client.readContract({
      address: registry,
      abi: permissionedRegistryAbi,
      functionName: "getState",
      args: [labelId],
      blockNumber,
    }),
    client.readContract({
      address: registry,
      abi: permissionedRegistryAbi,
      functionName: "getResolver",
      args: [request.label],
      blockNumber,
    }),
  ]);

  const tokenId = state.tokenId;
  const actualOwner = await client.readContract({
    address: registry,
    abi: permissionedRegistryAbi,
    functionName: "ownerOf",
    args: [tokenId],
    blockNumber,
  });
  const resolver = getAddress(resolverValue);
  const resolvedAddress = getAddress(await client.readContract({
    address: resolver,
    abi: addrResolverAbi,
    functionName: "addr",
    args: [node],
    blockNumber,
  }));
  const canonicalHeader = await client.getBlock({ blockHash });
  if (canonicalHeader.number !== blockNumber || canonicalHeader.hash !== blockHash) {
    throw new Error("ENS identity block is not canonical");
  }

  const status = statusFrom(state.status);
  const expiry = state.expiry;
  const owner = getAddress(actualOwner);
  const validation = {
    domain: true,
    registered: status === "REGISTERED",
    unexpired: expiry > header.timestamp,
    ownerMatchesAgent: owner === expectedAgent,
    resolverMatchesExpected: resolver === expectedResolver,
    addressMatchesAgent: resolvedAddress === expectedAgent,
    valid: false,
  };
  validation.valid =
    validation.domain &&
    validation.registered &&
    validation.unexpired &&
    validation.ownerMatchesAgent &&
    validation.resolverMatchesExpected &&
    validation.addressMatchesAgent;

  return {
    chainId,
    blockNumber,
    blockHash,
    registry,
    label: request.label,
    labelId,
    node,
    status,
    expiry,
    tokenId,
    owner,
    resolver,
    resolvedAddress,
    validation,
  };
}

export function serializeEnsIdentity(identity: EnsIdentity): SerializedEnsIdentity {
  return {
    ...identity,
    blockNumber: identity.blockNumber.toString(),
    labelId: identity.labelId.toString(),
    expiry: identity.expiry.toString(),
    tokenId: identity.tokenId.toString(),
  };
}

export interface ContractCodeProof {
  address: Address;
  codeHash: Hex;
  verificationBlock: {
    number: bigint;
    hash: Hex;
  };
}

export async function verifyContractCodeAtBlock(client: PublicClient, proof: ContractCodeProof): Promise<void> {
  const header = await client.getBlock({ blockNumber: proof.verificationBlock.number });
  if (header.hash !== proof.verificationBlock.hash) throw new Error("manifest verification block hash mismatch");

  const code = await client.getCode({ address: proof.address, blockNumber: proof.verificationBlock.number });
  if (code === undefined || code === "0x") throw new Error("manifest contract has no runtime code");
  if (keccak256(code) !== proof.codeHash) throw new Error("manifest runtime code hash mismatch");

  const canonicalHeader = await client.getBlock({ blockHash: proof.verificationBlock.hash });
  if (canonicalHeader.number !== proof.verificationBlock.number || canonicalHeader.hash !== proof.verificationBlock.hash) {
    throw new Error("manifest verification block is not canonical");
  }
}
