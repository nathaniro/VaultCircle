import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  TransactionVersion,
  createStacksPrivateKey,
  getAddressFromPrivateKey,
  getPublicKey,
  privateKeyToString,
  publicKeyToString
} from "@stacks/transactions";
import { createHmac, pbkdf2Sync } from "node:crypto";

export type ZestMode = "disabled" | "mock" | "live";
export type StacksMode = "testnet";
export type ProtocolContracts = {
  governanceParams: string;
  proposalManager: string;
  vaultRegistry: string;
  zestAdapter: string;
  vaultCircle: string;
};

const BIP32_HARDENED_OFFSET = 0x80000000;
const SECP256K1_ORDER = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

type DeploymentSummary = {
  deployerAddress?: string;
  contracts?: ProtocolContracts;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function numeric(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be numeric`);
  }
  return parsed;
}

function normalizeMnemonicForSeed(mnemonic: string) {
  return mnemonic.normalize("NFKD");
}

function hmacSha512(key: Uint8Array | string, data: Uint8Array) {
  return createHmac("sha512", key).update(data).digest();
}

function bigIntFromBuffer(buffer: Uint8Array) {
  return BigInt(`0x${Buffer.from(buffer).toString("hex")}`);
}

function bufferFromBigInt(value: bigint, length = 32) {
  return Buffer.from(value.toString(16).padStart(length * 2, "0"), "hex");
}

function serializeIndex(index: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(index >>> 0, 0);
  return buffer;
}

function getCompressedSecp256k1PublicKey(privateKey: Buffer) {
  const compressedPrivateKey = createStacksPrivateKey(Buffer.concat([privateKey, Buffer.from([0x01])]));
  return Buffer.from(publicKeyToString(getPublicKey(compressedPrivateKey)), "hex");
}

function deriveChildPrivateKey(parentKey: Buffer, chainCode: Buffer, index: number) {
  const hardened = index >= BIP32_HARDENED_OFFSET;
  const data = hardened
    ? Buffer.concat([Buffer.from([0x00]), parentKey, serializeIndex(index)])
    : Buffer.concat([getCompressedSecp256k1PublicKey(parentKey), serializeIndex(index)]);

  const digest = hmacSha512(chainCode, data);
  const left = digest.subarray(0, 32);
  const right = digest.subarray(32);
  const leftValue = bigIntFromBuffer(left);

  if (leftValue >= SECP256K1_ORDER) {
    throw new Error("Derived an invalid child key while processing DEPLOYER_MNEMONIC.");
  }

  const parentValue = bigIntFromBuffer(parentKey);
  const childValue = (leftValue + parentValue) % SECP256K1_ORDER;
  if (childValue === 0n) {
    throw new Error("Derived a zero child key while processing DEPLOYER_MNEMONIC.");
  }

  return {
    privateKey: bufferFromBigInt(childValue),
    chainCode: Buffer.from(right)
  };
}

export const appConfig = {
  stacksNetwork: optional("STACKS_NETWORK", "testnet") as StacksMode,
  stacksApiUrl: optional("STACKS_API_URL", "https://api.testnet.hiro.so"),
  stacksExplorerUrl: optional("STACKS_EXPLORER_URL", "https://explorer.hiro.so"),
  deployerAddress: required("DEPLOYER_ADDRESS"),
  deployerMnemonic: optional("DEPLOYER_MNEMONIC"),
  deployerPrivateKey: optional("DEPLOYER_PRIVATE_KEY"),
  deployerAccountIndex: numeric("DEPLOYER_ACCOUNT_INDEX", 0),
  protocolAdminAddress: required("PROTOCOL_ADMIN_ADDRESS"),
  sbtcContractPrincipal: required("SBTC_CONTRACT_PRINCIPAL"),
  zestAdapterMode: optional("ZEST_ADAPTER_MODE", "disabled") as Exclude<ZestMode, "mock">,
  zestContractPrincipal: optional("ZEST_CONTRACT_PRINCIPAL"),
  maxZestAllocationPct: numeric("MAX_ZEST_ALLOCATION_PCT", 70),
  minLiquidReservePct: numeric("MIN_LIQUID_RESERVE_PCT", 30),
  minThreshold: numeric("MIN_THRESHOLD", 51),
  defaultThreshold: numeric("DEFAULT_THRESHOLD", 70),
  minProposalExpiryBlocks: numeric("MIN_PROPOSAL_EXPIRY_BLOCKS", 144),
  defaultProposalExpiryBlocks: numeric("DEFAULT_PROPOSAL_EXPIRY_BLOCKS", 1008),
  maxProposalExpiryBlocks: numeric("MAX_PROPOSAL_EXPIRY_BLOCKS", 4320)
};

export function parseContractPrincipal(contractPrincipal: string) {
  const [contractAddress, contractName] = contractPrincipal.split(".");
  if (!contractAddress || !contractName) {
    throw new Error(`Invalid contract principal: ${contractPrincipal}`);
  }
  return { contractAddress, contractName };
}

export function isMockContractPrincipal(contractPrincipal: string) {
  return contractPrincipal.endsWith(".mock-sbtc") || contractPrincipal.endsWith(".mock-zest");
}

export function zestModeToClarity(mode: ZestMode): number {
  if (mode === "live") return 2;
  return 0;
}

export function getManifestPath() {
  return "Clarinet.toml";
}

export function getDeploymentPlanPath() {
  return "deployments/default.testnet-plan.yaml";
}

export function getDeploymentSummaryPath() {
  return "artifacts/testnet/deployment-summary.json";
}

export function getExpectedContracts(deployerAddress = appConfig.deployerAddress): ProtocolContracts {
  return {
    governanceParams: `${deployerAddress}.governance-params`,
    proposalManager: `${deployerAddress}.proposal-manager`,
    vaultRegistry: `${deployerAddress}.vault-registry`,
    zestAdapter: `${deployerAddress}.zest-adapter`,
    vaultCircle: `${deployerAddress}.vault-circle`
  };
}

function parseDeploymentSummary(raw: string): DeploymentSummary | null {
  try {
    return JSON.parse(raw) as DeploymentSummary;
  } catch {
    return null;
  }
}

export function loadDeploymentSummary() {
  const summaryPath = getDeploymentSummaryPath();
  if (!existsSync(summaryPath)) return null;
  return parseDeploymentSummary(readFileSync(summaryPath, "utf8"));
}

export function resolveProtocolContracts(): ProtocolContracts {
  const summary = loadDeploymentSummary();
  if (summary?.contracts) {
    return summary.contracts;
  }
  return getExpectedContracts();
}

export function resolveProtocolDeployerAddress() {
  const summary = loadDeploymentSummary();
  if (summary?.deployerAddress) {
    return summary.deployerAddress;
  }
  const { contractAddress } = parseContractPrincipal(resolveProtocolContracts().vaultCircle);
  return contractAddress;
}

export function deriveStacksPrivateKeyFromMnemonic(mnemonic: string, accountIndex = appConfig.deployerAccountIndex) {
  if (!Number.isInteger(accountIndex) || accountIndex < 0) {
    throw new Error("DEPLOYER_ACCOUNT_INDEX must be a non-negative integer.");
  }

  const seed = pbkdf2Sync(
    normalizeMnemonicForSeed(mnemonic),
    normalizeMnemonicForSeed("mnemonic"),
    2048,
    64,
    "sha512"
  );
  const masterDigest = hmacSha512("Bitcoin seed", seed);
  let privateKey = Buffer.from(masterDigest.subarray(0, 32));
  let chainCode = Buffer.from(masterDigest.subarray(32));

  if (bigIntFromBuffer(privateKey) === 0n || bigIntFromBuffer(privateKey) >= SECP256K1_ORDER) {
    throw new Error("Derived an invalid master key from DEPLOYER_MNEMONIC.");
  }

  const derivationPath = [
    44 + BIP32_HARDENED_OFFSET,
    5757 + BIP32_HARDENED_OFFSET,
    accountIndex + BIP32_HARDENED_OFFSET,
    0,
    0
  ];

  for (const segment of derivationPath) {
    const child = deriveChildPrivateKey(privateKey, chainCode, segment);
    privateKey = child.privateKey;
    chainCode = child.chainCode;
  }

  const compressedPrivateKey = createStacksPrivateKey(Buffer.concat([privateKey, Buffer.from([0x01])]));
  return privateKeyToString(compressedPrivateKey);
}

export function resolveDeployerSenderKey() {
  if (appConfig.deployerPrivateKey) {
    return appConfig.deployerPrivateKey;
  }
  if (!appConfig.deployerMnemonic) {
    throw new Error("Provide DEPLOYER_MNEMONIC or DEPLOYER_PRIVATE_KEY to sign deployer transactions.");
  }
  return deriveStacksPrivateKeyFromMnemonic(appConfig.deployerMnemonic);
}

export function assertNetwork(expected: StacksMode) {
  if (appConfig.stacksNetwork !== expected) {
    throw new Error(`This script requires STACKS_NETWORK=${expected}`);
  }
}

export function assertSafePublicDeploymentConfig() {
  if (isMockContractPrincipal(appConfig.sbtcContractPrincipal)) {
    throw new Error("SBTC_CONTRACT_PRINCIPAL cannot point to a mock contract for public testnet.");
  }

  if (appConfig.zestContractPrincipal && isMockContractPrincipal(appConfig.zestContractPrincipal)) {
    throw new Error("ZEST_CONTRACT_PRINCIPAL cannot point to a mock contract for public testnet.");
  }

  if (appConfig.zestAdapterMode === "live" && !appConfig.zestContractPrincipal) {
    throw new Error("ZEST_CONTRACT_PRINCIPAL is required when ZEST_ADAPTER_MODE=live.");
  }
}

function assertPrivateKeyMatchesAddress(address: string, privateKey: string, addressName: string, privateKeyName: string) {
  if (!privateKey) return;
  const derivedAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Testnet);
  if (derivedAddress !== address) {
    throw new Error(
      `${privateKeyName} does not match ${addressName}. Expected ${address}, derived ${derivedAddress}.`
    );
  }
}

export function assertDeploymentConfigConsistency() {
  if (appConfig.deployerMnemonic) {
    const derivedDeployerKey = deriveStacksPrivateKeyFromMnemonic(appConfig.deployerMnemonic);
    const derivedDeployerAddress = getAddressFromPrivateKey(derivedDeployerKey, TransactionVersion.Testnet);
    if (derivedDeployerAddress !== appConfig.deployerAddress) {
      throw new Error(
        `DEPLOYER_MNEMONIC derives ${derivedDeployerAddress}, but DEPLOYER_ADDRESS is ${appConfig.deployerAddress}.`
      );
    }
  }
  assertPrivateKeyMatchesAddress(
    appConfig.deployerAddress,
    appConfig.deployerPrivateKey,
    "DEPLOYER_ADDRESS",
    "DEPLOYER_PRIVATE_KEY"
  );
}

function escapeTomlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function renderTestnetSettings() {
  if (!appConfig.deployerMnemonic) {
    throw new Error("DEPLOYER_MNEMONIC is required to generate settings/Testnet.toml for deployment.");
  }

  return [
    "[network]",
    'name = "testnet"',
    `stacks_node_rpc_address = "${escapeTomlString(appConfig.stacksApiUrl)}"`,
    "deployment_fee_rate = 10",
    "",
    "[accounts.deployer]",
    `mnemonic = "${escapeTomlString(appConfig.deployerMnemonic)}"`,
    "",
    "[vaultcircle]",
    'mode = "testnet"',
    `sbtc_contract = "${escapeTomlString(appConfig.sbtcContractPrincipal)}"`,
    `zest_mode = "${escapeTomlString(appConfig.zestAdapterMode)}"`,
    `zest_contract = "${escapeTomlString(appConfig.zestContractPrincipal)}"`,
    `protocol_admin = "${escapeTomlString(appConfig.protocolAdminAddress)}"`,
    `max_zest_allocation_pct = ${appConfig.maxZestAllocationPct}`,
    `min_liquid_reserve_pct = ${appConfig.minLiquidReservePct}`,
    `min_threshold = ${appConfig.minThreshold}`,
    `default_threshold = ${appConfig.defaultThreshold}`,
    `min_proposal_expiry_blocks = ${appConfig.minProposalExpiryBlocks}`,
    `default_proposal_expiry_blocks = ${appConfig.defaultProposalExpiryBlocks}`,
    `max_proposal_expiry_blocks = ${appConfig.maxProposalExpiryBlocks}`,
    ""
  ].join("\n");
}

export function syncTestnetSettings() {
  const settingsPath = "settings/Testnet.toml";
  mkdirSync("settings", { recursive: true });
  writeFileSync(settingsPath, renderTestnetSettings());
  return settingsPath;
}

export function extractContractsFromDeploymentPlan(plan: string): ProtocolContracts {
  const contractNameMap: Record<string, keyof ProtocolContracts> = {
    "governance-params": "governanceParams",
    "proposal-manager": "proposalManager",
    "vault-registry": "vaultRegistry",
    "zest-adapter": "zestAdapter",
    "vault-circle": "vaultCircle"
  };
  const contracts = {} as Partial<ProtocolContracts>;
  const transactionBlocks = plan.split(/\r?\n(?=\s*-\s)/g);

  for (const block of transactionBlocks) {
    const contractName = block.match(/contract-name:\s*([A-Za-z0-9-]+)/)?.[1];
    const sender =
      block.match(/(?:emulated-sender|expected-sender|sender):\s*([A-Z0-9]+)/)?.[1] ||
      block.match(/contract-id:\s*([A-Z0-9]+\.[A-Za-z0-9-]+)/)?.[1]?.split(".")[0];

    if (!contractName || !sender) continue;

    const targetKey = contractNameMap[contractName];
    if (!targetKey) continue;
    contracts[targetKey] = `${sender}.${contractName}`;
  }

  const missing = Object.values(contractNameMap).filter((key) => !contracts[key]);
  if (missing.length > 0) {
    throw new Error(`Unable to resolve deployed contract principals from ${getDeploymentPlanPath()}.`);
  }

  return contracts as ProtocolContracts;
}
