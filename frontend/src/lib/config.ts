import { StacksTestnet } from "@stacks/network";

const DEFAULT_DEPLOYER_ADDRESS = "ST000000000000000000002AMW42H";
const DEFAULT_STACKS_API_URL = "https://api.testnet.hiro.so";
const DEFAULT_STACKS_EXPLORER_URL = "https://explorer.hiro.so";

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

const missingPublicEnv = new Set<keyof typeof PUBLIC_ENV>();

function resolveEnv(name: keyof typeof PUBLIC_ENV, fallback?: string, defaultValue?: string) {
  const value = PUBLIC_ENV[name] || fallback;
  if (value) return value;

  if (defaultValue) return defaultValue;

  missingPublicEnv.add(name);
  throw new Error(`Missing required frontend environment variable: ${name}`);
}

function rootContract(contractName: string, deployerAddress?: string) {
  return `${deployerAddress || DEFAULT_DEPLOYER_ADDRESS}.${contractName}`;
}

function parseContractId(contractId: string) {
  const [address, name] = contractId.split(".");
  if (!address || !name) {
    throw new Error(`Invalid contract id: ${contractId}`);
  }
  return { address, name };
}

const configuredDeployerAddress =
  PUBLIC_ENV.NEXT_PUBLIC_DEPLOYER_ADDRESS ||
  process.env.DEPLOYER_ADDRESS ||
  DEFAULT_DEPLOYER_ADDRESS;
const hasConfiguredDeployerAddress = Boolean(PUBLIC_ENV.NEXT_PUBLIC_DEPLOYER_ADDRESS || process.env.DEPLOYER_ADDRESS);
const resolvedSbtcContract =
  PUBLIC_ENV.NEXT_PUBLIC_SBTC_CONTRACT ||
  process.env.SBTC_CONTRACT_PRINCIPAL ||
  (hasConfiguredDeployerAddress ? rootContract("sbtc-token", configuredDeployerAddress) : rootContract("sbtc-token"));

if (!hasConfiguredDeployerAddress) {
  missingPublicEnv.add("NEXT_PUBLIC_DEPLOYER_ADDRESS");
  missingPublicEnv.add("NEXT_PUBLIC_VAULT_CIRCLE_CONTRACT");
  missingPublicEnv.add("NEXT_PUBLIC_PROPOSAL_MANAGER_CONTRACT");
  missingPublicEnv.add("NEXT_PUBLIC_ZEST_ADAPTER_CONTRACT");
  missingPublicEnv.add("NEXT_PUBLIC_GOVERNANCE_PARAMS_CONTRACT");
  missingPublicEnv.add("NEXT_PUBLIC_VAULT_REGISTRY_CONTRACT");
}

if (!(PUBLIC_ENV.NEXT_PUBLIC_SBTC_CONTRACT || process.env.SBTC_CONTRACT_PRINCIPAL)) {
  missingPublicEnv.add("NEXT_PUBLIC_SBTC_CONTRACT");
}

export const APP_NETWORK = "testnet" as const;
export const STACKS_API_URL =
  PUBLIC_ENV.NEXT_PUBLIC_STACKS_API_URL ||
  process.env.STACKS_API_URL ||
  DEFAULT_STACKS_API_URL;
export const STACKS_EXPLORER_URL =
  PUBLIC_ENV.NEXT_PUBLIC_EXPLORER_BASE_URL ||
  process.env.STACKS_EXPLORER_URL ||
  PUBLIC_ENV.NEXT_PUBLIC_STACKS_EXPLORER_URL ||
  DEFAULT_STACKS_EXPLORER_URL;
export const ZEST_MODE =
  PUBLIC_ENV.NEXT_PUBLIC_ZEST_MODE ||
  process.env.ZEST_ADAPTER_MODE ||
  "disabled";

export const CONTRACT_IDS = {
  vaultCircle: resolveEnv(
    "NEXT_PUBLIC_VAULT_CIRCLE_CONTRACT",
    hasConfiguredDeployerAddress ? rootContract("vault-circle", configuredDeployerAddress) : undefined,
    rootContract("vault-circle")
  ),
  proposalManager: resolveEnv(
    "NEXT_PUBLIC_PROPOSAL_MANAGER_CONTRACT",
    hasConfiguredDeployerAddress ? rootContract("proposal-manager", configuredDeployerAddress) : undefined,
    rootContract("proposal-manager")
  ),
  zestAdapter: resolveEnv(
    "NEXT_PUBLIC_ZEST_ADAPTER_CONTRACT",
    process.env.ZEST_CONTRACT_PRINCIPAL || (hasConfiguredDeployerAddress ? rootContract("zest-adapter", configuredDeployerAddress) : undefined),
    rootContract("zest-adapter")
  ),
  governanceParams: resolveEnv(
    "NEXT_PUBLIC_GOVERNANCE_PARAMS_CONTRACT",
    hasConfiguredDeployerAddress ? rootContract("governance-params", configuredDeployerAddress) : undefined,
    rootContract("governance-params")
  ),
  vaultRegistry: resolveEnv(
    "NEXT_PUBLIC_VAULT_REGISTRY_CONTRACT",
    hasConfiguredDeployerAddress ? rootContract("vault-registry", configuredDeployerAddress) : undefined,
    rootContract("vault-registry")
  ),
  sbtc: resolveEnv(
    "NEXT_PUBLIC_SBTC_CONTRACT",
    resolvedSbtcContract,
    rootContract("sbtc-token")
  )
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

export const FRONTEND_ENV_WARNING = Object.freeze(Array.from(missingPublicEnv));
export const HAS_FRONTEND_ENV_FALLBACKS = FRONTEND_ENV_WARNING.length > 0;

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
