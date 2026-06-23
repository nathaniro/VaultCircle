import { mkdirSync, writeFileSync } from "node:fs";
import {
  appConfig,
  assertDeploymentConfigConsistency,
  assertNetwork,
  assertSafePublicDeploymentConfig,
  resolveProtocolContracts,
  resolveProtocolDeployerAddress
} from "./lib/config.js";
import { callReadonly } from "./lib/stacks.js";

const contracts = resolveProtocolContracts();
const protocolDeployerAddress = resolveProtocolDeployerAddress();
const artifactDir = "artifacts/testnet";
const verifySummaryPath = `${artifactDir}/verify-summary.json`;
const frontendEnvPath = `${artifactDir}/frontend.testnet.env`;
const jsonReplacer = (_key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value);

async function main() {
  assertNetwork("testnet");
  assertSafePublicDeploymentConfig();
  assertDeploymentConfigConsistency();

  const tokenName = await callReadonly(appConfig.sbtcContractPrincipal, "get-name", []);
  const tokenSymbol = await callReadonly(appConfig.sbtcContractPrincipal, "get-symbol", []);
  const tokenDecimals = await callReadonly(appConfig.sbtcContractPrincipal, "get-decimals", []);
  const configuredSbtc = await callReadonly(contracts.vaultCircle, "get-configured-sbtc-contract", []);
  const adapterMode = await callReadonly(contracts.zestAdapter, "get-adapter-mode", []);
  const configuredZest = await callReadonly(contracts.zestAdapter, "get-configured-zest-contract", []);
  const governanceSummary = await callReadonly(contracts.governanceParams, "get-config-summary", []);
  const registryContract = await callReadonly(contracts.vaultRegistry, "get-vault-circle-contract", []);
  const proposalManagerContract = await callReadonly(contracts.proposalManager, "get-vault-circle-contract", []);
  const adapterVaultCircle = await callReadonly(contracts.zestAdapter, "get-vault-circle-contract", []);
  const vaultCount = await callReadonly(contracts.vaultRegistry, "get-vault-count", []);
  const nextVaultId = await callReadonly(contracts.vaultCircle, "get-next-vault-id", [], protocolDeployerAddress);

  const summary = {
    network: "testnet",
    token: {
      contract: appConfig.sbtcContractPrincipal,
      name: tokenName,
      symbol: tokenSymbol,
      decimals: tokenDecimals
    },
    configuredSbtc,
    adapterMode,
    configuredZest,
    governanceSummary,
    registryContract,
    proposalManagerContract,
    adapterVaultCircle,
    vaultCount,
    nextVaultId,
    generatedAt: new Date().toISOString()
  };

  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(verifySummaryPath, JSON.stringify(summary, jsonReplacer, 2));

  const frontendEnv = [
    "NEXT_PUBLIC_STACKS_NETWORK=testnet",
    `NEXT_PUBLIC_STACKS_API_URL=${appConfig.stacksApiUrl}`,
    `NEXT_PUBLIC_EXPLORER_BASE_URL=${appConfig.stacksExplorerUrl}`,
    `NEXT_PUBLIC_DEPLOYER_ADDRESS=${protocolDeployerAddress}`,
    `NEXT_PUBLIC_VAULT_CIRCLE_CONTRACT=${contracts.vaultCircle}`,
    `NEXT_PUBLIC_PROPOSAL_MANAGER_CONTRACT=${contracts.proposalManager}`,
    `NEXT_PUBLIC_VAULT_REGISTRY_CONTRACT=${contracts.vaultRegistry}`,
    `NEXT_PUBLIC_GOVERNANCE_PARAMS_CONTRACT=${contracts.governanceParams}`,
    `NEXT_PUBLIC_ZEST_ADAPTER_CONTRACT=${contracts.zestAdapter}`,
    `NEXT_PUBLIC_SBTC_CONTRACT=${appConfig.sbtcContractPrincipal}`,
    `NEXT_PUBLIC_ZEST_MODE=${appConfig.zestAdapterMode}`
  ].join("\n");

  writeFileSync(frontendEnvPath, `${frontendEnv}\n`);

  console.log("Verification complete.");
  console.log(summary);
  console.log(`Verification summary saved to ${verifySummaryPath}`);
  console.log(`Frontend env template saved to ${frontendEnvPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
