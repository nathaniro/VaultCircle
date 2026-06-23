import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  "Clarinet.toml",
  "contracts/vault-circle.clar",
  "contracts/zest-adapter-testnet.clar",
  "contracts/sip-010-ft-trait.clar",
  "frontend/package.json"
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertMockFreeManifest() {
  const manifest = readFileSync("Clarinet.toml", "utf8");
  if (manifest.includes("mock-sbtc") || manifest.includes("mock-zest")) {
    throw new Error("Clarinet.toml must not include mock-sbtc or mock-zest.");
  }
}

function assertMockFreePlanIfPresent() {
  const planPath = "deployments/default.testnet-plan.yaml";
  if (!existsSync(planPath)) return;
  const plan = readFileSync(planPath, "utf8");
  if (plan.includes("mock-sbtc") || plan.includes("mock-zest")) {
    throw new Error(`${planPath} contains mock contracts and is unsafe for public testnet deployment.`);
  }
}

console.log("Validating deployment manifests...");
assertMockFreeManifest();
assertMockFreePlanIfPresent();

console.log("Checking public testnet manifest with Clarinet...");
run("clarinet", ["check", "-m", "Clarinet.toml", "-c"]);

if (existsSync("node_modules")) {
  console.log("Running TypeScript typecheck...");
  run("npm", ["run", "typecheck"]);

  console.log("Running frontend lint...");
  run("npm", ["run", "frontend:lint"]);
} else {
  console.log("Skipping TypeScript and frontend lint because node_modules is not installed yet.");
  console.log("Run `npm install`, then `npm run typecheck`, then `npm run frontend:lint`.");
}

console.log("VaultCircle check completed successfully.");
