import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  appConfig,
  assertDeploymentConfigConsistency,
  assertNetwork,
  assertSafePublicDeploymentConfig,
  extractContractsFromDeploymentPlan,
  getDeploymentPlanPath,
  getManifestPath,
  syncTestnetSettings
} from "./lib/config.js";

const manifestPath = getManifestPath();
const deploymentPlanPath = getDeploymentPlanPath();
const artifactDir = "artifacts/testnet";
const deploymentSummaryPath = `${artifactDir}/deployment-summary.json`;

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertGeneratedPlanIsMockFree() {
  const plan = readFileSync(deploymentPlanPath, "utf8");
  if (plan.includes("mock-sbtc") || plan.includes("mock-zest")) {
    throw new Error(`${deploymentPlanPath} contains mock contracts and cannot be used for public testnet deployment.`);
  }
}

function normalizeGeneratedPlan() {
  const plan = readFileSync(deploymentPlanPath, "utf8");
  const normalizedPlan = plan.replaceAll('path: "ontracts\\\\', 'path: "contracts\\\\');
  if (normalizedPlan !== plan) {
    writeFileSync(deploymentPlanPath, normalizedPlan);
  }
}

assertNetwork("testnet");
assertSafePublicDeploymentConfig();
assertDeploymentConfigConsistency();

const settingsPath = syncTestnetSettings();
console.log(`Generated ${settingsPath} from .env for Clarinet deployment.`);

console.log(`Generating a fresh Clarinet deployment plan from ${manifestPath}...`);
mkdirSync("deployments", { recursive: true });
if (existsSync(deploymentPlanPath)) {
  normalizeGeneratedPlan();
}
run("clarinet", ["deployments", "generate", "--testnet", "--medium-cost", "-m", manifestPath]);
normalizeGeneratedPlan();
assertGeneratedPlanIsMockFree();

const deployedContracts = extractContractsFromDeploymentPlan(readFileSync(deploymentPlanPath, "utf8"));
const deployedContractAddresses = new Set(
  Object.values(deployedContracts).map((contractPrincipal) => contractPrincipal.split(".")[0])
);

if (deployedContractAddresses.size !== 1) {
  throw new Error("Generated deployment plan contains multiple deployer addresses for protocol contracts.");
}

const [generatedDeployerAddress] = [...deployedContractAddresses];
if (generatedDeployerAddress !== appConfig.deployerAddress) {
  throw new Error(
    `Generated deployment plan uses deployer ${generatedDeployerAddress}, but DEPLOYER_ADDRESS is ${appConfig.deployerAddress}. Update DEPLOYER_ADDRESS or DEPLOYER_MNEMONIC so they match.`
  );
}

console.log(`Applying ${deploymentPlanPath} to Stacks testnet...`);
run("clarinet", [
  "deployments",
  "apply",
  "-m",
  manifestPath,
  "-p",
  deploymentPlanPath,
  "-d"
]);

mkdirSync(artifactDir, { recursive: true });
const deploymentSummary = {
  network: "testnet",
  manifestPath,
  settingsPath,
  deploymentPlanPath,
  deployerAddress: generatedDeployerAddress,
  protocolAdminAddress: appConfig.protocolAdminAddress,
  sbtcContractPrincipal: appConfig.sbtcContractPrincipal,
  zestAdapterMode: appConfig.zestAdapterMode,
  zestContractPrincipal: appConfig.zestContractPrincipal || null,
  contracts: deployedContracts,
  generatedAt: new Date().toISOString()
};

writeFileSync(deploymentSummaryPath, JSON.stringify(deploymentSummary, null, 2));

console.log("Testnet deployment command completed.");
console.log(`Deployment summary saved to ${deploymentSummaryPath}`);
