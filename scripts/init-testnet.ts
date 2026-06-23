import { contractPrincipalCV, noneCV, principalCV, someCV, uintCV, type ClarityValue } from "@stacks/transactions";
import {
  appConfig,
  assertDeploymentConfigConsistency,
  assertNetwork,
  assertSafePublicDeploymentConfig,
  isMockContractPrincipal,
  resolveDeployerSenderKey,
  resolveProtocolDeployerAddress,
  resolveProtocolContracts,
  zestModeToClarity
} from "./lib/config.js";
import { broadcastContractCall, callReadonly, waitForTx } from "./lib/stacks.js";
import { mkdirSync, writeFileSync } from "node:fs";

const contracts = resolveProtocolContracts();
const protocolDeployerAddress = resolveProtocolDeployerAddress();
const artifactDir = "artifacts/testnet";
const initSummaryPath = `${artifactDir}/init-summary.json`;

function contractArg(contractPrincipal: string) {
  const [address, name] = contractPrincipal.split(".");
  if (!address || !name) throw new Error(`Invalid contract principal: ${contractPrincipal}`);
  return contractPrincipalCV(address, name);
}

async function send(senderKey: string, contractPrincipal: string, functionName: string, functionArgs: ClarityValue[]) {
  const response = await broadcastContractCall(senderKey, contractPrincipal, functionName, functionArgs);
  if ("error" in response) {
    throw new Error(`Failed to broadcast ${functionName}: ${response.reason || response.error}`);
  }
  console.log(`${functionName} broadcast: ${response.txid}`);
  await waitForTx(response.txid);
  return response.txid;
}

function sameValue(current: unknown, expected: unknown) {
  return JSON.stringify(normalizeValue(current)) === JSON.stringify(normalizeValue(expected));
}

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return value.toString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("type" in record && "value" in record && Object.keys(record).length === 2) {
      return normalizeValue(record.value);
    }
    return Object.fromEntries(Object.entries(record).map(([key, nested]) => [key, normalizeValue(nested)]));
  }
  return value;
}

async function sendIfNeeded(
  txs: Record<string, string>,
  key: string,
  txLabel: string,
  description: string,
  contractPrincipal: string,
  functionName: string,
  functionArgs: ClarityValue[],
  currentValue: unknown,
  expectedValue: unknown
) {
  if (sameValue(currentValue, expectedValue)) {
    console.log(`Skipping ${description}; already configured.`);
    return;
  }
  console.log(description);
  txs[txLabel] = await send(key, contractPrincipal, functionName, functionArgs);
}

async function main() {
  assertNetwork("testnet");
  assertSafePublicDeploymentConfig();
  assertDeploymentConfigConsistency();

  if (isMockContractPrincipal(appConfig.sbtcContractPrincipal)) {
    throw new Error("Refusing to initialize testnet with mock-sbtc.");
  }

  const deployerSenderKey = resolveDeployerSenderKey();
  const txs: Record<string, string> = {};
  const proposalManagerContract = await callReadonly(contracts.proposalManager, "get-vault-circle-contract", []);
  const adapterVaultCircle = await callReadonly(contracts.zestAdapter, "get-vault-circle-contract", []);
  const registryContract = await callReadonly(contracts.vaultRegistry, "get-vault-circle-contract", []);
  const governanceSummary = await callReadonly(contracts.governanceParams, "get-config-summary", []);
  const configuredSbtc = await callReadonly(contracts.vaultCircle, "get-configured-sbtc-contract", []);
  const adapterMode = await callReadonly(contracts.zestAdapter, "get-adapter-mode", []);
  const configuredZest = await callReadonly(contracts.zestAdapter, "get-configured-zest-contract", []);

  await sendIfNeeded(
    txs,
    deployerSenderKey,
    "initializeProposalManager",
    "Initializing proposal manager...",
    contracts.proposalManager,
    "initialize",
    [contractArg(contracts.vaultCircle)],
    proposalManagerContract,
    contracts.vaultCircle
  );

  await sendIfNeeded(
    txs,
    deployerSenderKey,
    "initializeZestAdapter",
    "Initializing zest adapter...",
    contracts.zestAdapter,
    "initialize",
    [contractArg(contracts.vaultCircle)],
    adapterVaultCircle,
    contracts.vaultCircle
  );

  await sendIfNeeded(
    txs,
    deployerSenderKey,
    "registerVaultCircle",
    "Registering vault-circle in vault-registry...",
    contracts.vaultRegistry,
    "set-vault-circle-contract",
    [contractArg(contracts.vaultCircle)],
    registryContract,
    contracts.vaultCircle
  );

  console.log("Applying governance defaults...");
  await sendIfNeeded(
    txs,
    deployerSenderKey,
    "setMinThreshold",
    "Setting minimum threshold...",
    contracts.governanceParams,
    "set-min-threshold",
    [uintCV(appConfig.minThreshold)],
    governanceSummary["min-threshold"],
    appConfig.minThreshold
  );
  await sendIfNeeded(
    txs,
    deployerSenderKey,
    "setDefaultThreshold",
    "Setting default threshold...",
    contracts.governanceParams,
    "set-default-threshold",
    [uintCV(appConfig.defaultThreshold)],
    governanceSummary["default-threshold"],
    appConfig.defaultThreshold
  );
  await sendIfNeeded(
    txs,
    deployerSenderKey,
    "setMaxZestAllocation",
    "Setting max Zest allocation...",
    contracts.governanceParams,
    "set-max-zest-allocation-pct",
    [uintCV(appConfig.maxZestAllocationPct)],
    governanceSummary["max-zest-allocation-pct"],
    appConfig.maxZestAllocationPct
  );
  await sendIfNeeded(
    txs,
    deployerSenderKey,
    "setMinLiquidReserve",
    "Setting minimum liquid reserve...",
    contracts.governanceParams,
    "set-min-liquid-reserve-pct",
    [uintCV(appConfig.minLiquidReservePct)],
    governanceSummary["min-liquid-reserve-pct"],
    appConfig.minLiquidReservePct
  );
  await sendIfNeeded(
    txs,
    deployerSenderKey,
    "setMinProposalExpiry",
    "Setting minimum proposal expiry...",
    contracts.governanceParams,
    "set-min-proposal-expiry-blocks",
    [uintCV(appConfig.minProposalExpiryBlocks)],
    governanceSummary["min-proposal-expiry-blocks"],
    appConfig.minProposalExpiryBlocks
  );
  await sendIfNeeded(
    txs,
    deployerSenderKey,
    "setMaxProposalExpiry",
    "Setting maximum proposal expiry...",
    contracts.governanceParams,
    "set-max-proposal-expiry-blocks",
    [uintCV(appConfig.maxProposalExpiryBlocks)],
    governanceSummary["max-proposal-expiry-blocks"],
    appConfig.maxProposalExpiryBlocks
  );
  await sendIfNeeded(
    txs,
    deployerSenderKey,
    "setDefaultProposalExpiry",
    "Setting default proposal expiry...",
    contracts.governanceParams,
    "set-default-proposal-expiry-blocks",
    [uintCV(appConfig.defaultProposalExpiryBlocks)],
    governanceSummary["default-proposal-expiry-blocks"],
    appConfig.defaultProposalExpiryBlocks
  );

  await sendIfNeeded(
    txs,
    deployerSenderKey,
    "initializeProtocol",
    "Configuring VaultCircle with the chosen sBTC contract...",
    contracts.vaultCircle,
    "initialize-protocol",
    [contractArg(appConfig.sbtcContractPrincipal)],
    configuredSbtc,
    appConfig.sbtcContractPrincipal
  );

  await sendIfNeeded(
    txs,
    deployerSenderKey,
    "configureAdapter",
    "Configuring adapter mode...",
    contracts.zestAdapter,
    "configure-adapter",
    [
      uintCV(zestModeToClarity(appConfig.zestAdapterMode)),
      appConfig.zestContractPrincipal ? someCV(contractArg(appConfig.zestContractPrincipal)) : noneCV()
    ],
    {
      mode: adapterMode,
      zest: configuredZest
    },
    {
      mode: zestModeToClarity(appConfig.zestAdapterMode),
      zest: appConfig.zestContractPrincipal || null
    }
  );

  if (appConfig.protocolAdminAddress !== protocolDeployerAddress) {
    console.log("Transferring adapter admin...");
    txs.setAdapterAdmin = await send(
      deployerSenderKey,
      contracts.zestAdapter,
      "set-adapter-admin",
      [principalCV(appConfig.protocolAdminAddress)]
    );

    console.log("Transferring governance admin...");
    txs.setProtocolAdmin = await send(
      deployerSenderKey,
      contracts.governanceParams,
      "set-protocol-admin",
      [principalCV(appConfig.protocolAdminAddress)]
    );
  }

  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(
    initSummaryPath,
    JSON.stringify(
      {
        network: "testnet",
        sbtcContractPrincipal: appConfig.sbtcContractPrincipal,
        protocolAdminAddress: appConfig.protocolAdminAddress,
        zestAdapterMode: appConfig.zestAdapterMode,
        zestContractPrincipal: appConfig.zestContractPrincipal || null,
        transactions: txs,
        generatedAt: new Date().toISOString()
      },
      null,
      2
    )
  );

  console.log("Protocol initialization complete.");
  console.log(`Initialization summary saved to ${initSummaryPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
