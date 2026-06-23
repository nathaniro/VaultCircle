import { StacksTestnet } from "@stacks/network";

const PUBLIC_ENV = {
  NEXT_PUBLIC_STACKS_API_URL: process.env.NEXT_PUBLIC_STACKS_API_URL,
  NEXT_PUBLIC_EXPLORER_BASE_URL: process.env.NEXT_PUBLIC_EXPLORER_BASE_URL,
  NEXT_PUBLIC_STACKS_EXPLORER_URL: process.env.NEXT_PUBLIC_STACKS_EXPLORER_URL,
  NEXT_PUBLIC_ZEST_MODE: process.env.NEXT_PUBLIC_ZEST_MODE,
  NEXT_PUBLIC_VAULT_CIRCLE_CONTRACT: process.env.NEXT_PUBLIC_VAULT_CIRCLE_CONTRACT,
  NEXT_PUBLIC_PROPOSAL_MANAGER_CONTRACT: process.env.NEXT_PUBLIC_PROPOSAL_MANAGER_CONTRACT,
  NEXT_PUBLIC_ZEST_ADAPTER_CONTRACT: process.env.NEXT_PUBLIC_ZEST_ADAPTER_CONTRACT,
  NEXT_PUBLIC_GOVERNANCE_PARAMS_CONTRACT: process.env.NEXT_PUBLIC_GOVERNANCE_PARAMS_CONTRACT,
  NEXT_PUBLIC_VAULT_REGISTRY_CONTRACT: process.env.NEXT_PUBLIC_VAULT_REGISTRY_CONTRACT,
  NEXT_PUBLIC_SBTC_CONTRACT: process.env.NEXT_PUBLIC_SBTC_CONTRACT,
  NEXT_PUBLIC_DEPLOYER_ADDRESS: process.env.NEXT_PUBLIC_DEPLOYER_ADDRESS
} as const;

function required(name: keyof typeof PUBLIC_ENV, fallback?: string) {
  const value = PUBLIC_ENV[name] || fallback;
  if (!value) throw new Error(`Missing required frontend environment variable: ${name}`);
  return value;
}

function rootContract(contractName: string) {
  const deployerAddress = PUBLIC_ENV.NEXT_PUBLIC_DEPLOYER_ADDRESS || process.env.DEPLOYER_ADDRESS;
  return deployerAddress ? `${deployerAddress}.${contractName}` : undefined;
}

function parseContractId(contractId: string) {
  const [address, name] = contractId.split(".");
  if (!address || !name) {
    throw new Error(`Invalid contract id: ${contractId}`);
  }
  return { address, name };
}

export const APP_NETWORK = "testnet" as const;
export const STACKS_API_URL =
  PUBLIC_ENV.NEXT_PUBLIC_STACKS_API_URL ||
  process.env.STACKS_API_URL ||
  "https://api.testnet.hiro.so";
export const STACKS_EXPLORER_URL =
  PUBLIC_ENV.NEXT_PUBLIC_EXPLORER_BASE_URL ||
  process.env.STACKS_EXPLORER_URL ||
  PUBLIC_ENV.NEXT_PUBLIC_STACKS_EXPLORER_URL ||
  "https://explorer.hiro.so";
export const ZEST_MODE =
  PUBLIC_ENV.NEXT_PUBLIC_ZEST_MODE ||
  process.env.ZEST_ADAPTER_MODE ||
  "disabled";

export const CONTRACT_IDS = {
  vaultCircle: required("NEXT_PUBLIC_VAULT_CIRCLE_CONTRACT", rootContract("vault-circle")),
  proposalManager: required("NEXT_PUBLIC_PROPOSAL_MANAGER_CONTRACT", rootContract("proposal-manager")),
  zestAdapter: required("NEXT_PUBLIC_ZEST_ADAPTER_CONTRACT", process.env.ZEST_CONTRACT_PRINCIPAL || rootContract("zest-adapter")),
  governanceParams: required("NEXT_PUBLIC_GOVERNANCE_PARAMS_CONTRACT", rootContract("governance-params")),
  vaultRegistry: required("NEXT_PUBLIC_VAULT_REGISTRY_CONTRACT", rootContract("vault-registry")),
  sbtc: required("NEXT_PUBLIC_SBTC_CONTRACT", process.env.SBTC_CONTRACT_PRINCIPAL || rootContract("sbtc-token"))
} as const;

export const CONTRACTS = {
  vaultCircle: CONTRACT_IDS.vaultCircle,
  proposalManager: CONTRACT_IDS.proposalManager,
  zestAdapter: CONTRACT_IDS.zestAdapter,
  governanceParams: CONTRACT_IDS.governanceParams,
  vaultRegistry: CONTRACT_IDS.vaultRegistry,
  sbtc: CONTRACT_IDS.sbtc
} as const;

export const DEPLOYER_ADDRESS =
  PUBLIC_ENV.NEXT_PUBLIC_DEPLOYER_ADDRESS ||
  process.env.DEPLOYER_ADDRESS ||
  parseContractId(CONTRACT_IDS.vaultCircle).address;

export const PROTOCOL = {
  minThreshold: 51,
  maxThreshold: 100,
  defaultThreshold: 70,
  maxZestAllocationPct: 70,
  minLiquidReservePct: 30
} as const;

export const DEFAULT_PROPOSAL_DURATION = 1008;

export function getStacksNetwork() {
  return new StacksTestnet({ url: STACKS_API_URL });
}

export function splitContractId(contractId: string) {
  return parseContractId(contractId);
}
