import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const frontendRoot = path.join(repoRoot, "frontend");
const docsPath = path.join(repoRoot, "docs", "VERCEL_DEPLOYMENT.md");
const envExamplePath = path.join(repoRoot, ".env.example");
const frontendPackagePath = path.join(frontendRoot, "package.json");
const frontendVercelPath = path.join(frontendRoot, "vercel.json");
const rootVercelPath = path.join(repoRoot, "vercel.json");

const requiredFrontendEnvVars = [
  "NEXT_PUBLIC_STACKS_NETWORK",
  "NEXT_PUBLIC_STACKS_API_URL",
  "NEXT_PUBLIC_EXPLORER_BASE_URL",
  "NEXT_PUBLIC_DEPLOYER_ADDRESS",
  "NEXT_PUBLIC_VAULT_CIRCLE_CONTRACT",
  "NEXT_PUBLIC_PROPOSAL_MANAGER_CONTRACT",
  "NEXT_PUBLIC_VAULT_REGISTRY_CONTRACT",
  "NEXT_PUBLIC_GOVERNANCE_PARAMS_CONTRACT",
  "NEXT_PUBLIC_ZEST_ADAPTER_CONTRACT",
  "NEXT_PUBLIC_SBTC_CONTRACT",
  "NEXT_PUBLIC_ZEST_MODE"
] as const;

const frontendScanRoots = [
  path.join(frontendRoot, "src"),
  path.join(frontendRoot, "next.config.mjs"),
  path.join(frontendRoot, "package.json")
];

function fail(message: string): never {
  throw new Error(message);
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true, cwd: repoRoot });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function collectFiles(targetPath: string): string[] {
  const stats = statSync(targetPath);
  if (stats.isFile()) return [targetPath];

  const files: string[] = [];
  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    files.push(...collectFiles(path.join(targetPath, entry.name)));
  }
  return files;
}

function assertFileContains(filePath: string, pattern: string, label: string) {
  const content = readFileSync(filePath, "utf8");
  if (!content.includes(pattern)) {
    fail(`${label} is missing "${pattern}".`);
  }
}

function scanForForbiddenPatterns() {
  const forbiddenPatterns = [
    { regex: /localhost/i, label: "localhost reference" },
    { regex: /127\.0\.0\.1/, label: "127.0.0.1 reference" },
    { regex: /NEXT_PUBLIC_[A-Z0-9_]*(PRIVATE_KEY|MNEMONIC|SECRET)/, label: "public secret-like environment variable" },
    { regex: /\bDEPLOYER_PRIVATE_KEY\b/, label: "frontend private key reference" },
    { regex: /\bDEPLOYER_MNEMONIC\b/, label: "frontend mnemonic reference" }
  ];

  for (const scanRoot of frontendScanRoots) {
    for (const filePath of collectFiles(scanRoot)) {
      const relativePath = path.relative(repoRoot, filePath);
      const content = readFileSync(filePath, "utf8");
      for (const { regex, label } of forbiddenPatterns) {
        if (regex.test(content)) {
          fail(`Found ${label} in ${relativePath}.`);
        }
      }
    }
  }
}

function assertFrontendPackage() {
  const pkg = JSON.parse(readFileSync(frontendPackagePath, "utf8")) as {
    scripts?: Record<string, string>;
    engines?: Record<string, string>;
  };

  if (!pkg.scripts?.build?.includes("next/dist/bin/next build")) {
    fail("frontend/package.json must build Next.js through the local Next CLI binary.");
  }

  if (!pkg.engines?.node) {
    fail("frontend/package.json must declare a Node.js engine for Vercel.");
  }
}

function assertVercelConfig() {
  if (statSync(frontendVercelPath).isDirectory()) {
    fail("frontend/vercel.json must be a file.");
  }

  const vercelConfig = JSON.parse(readFileSync(frontendVercelPath, "utf8")) as Record<string, string>;
  if (vercelConfig.framework !== "nextjs") {
    fail('frontend/vercel.json must set "framework" to "nextjs".');
  }
  if (vercelConfig.installCommand !== "npm install") {
    fail('frontend/vercel.json must set "installCommand" to "npm install".');
  }
  if (vercelConfig.buildCommand !== "npm run build") {
    fail('frontend/vercel.json must set "buildCommand" to "npm run build".');
  }

  try {
    statSync(rootVercelPath);
    fail("Repo root vercel.json should not exist when Vercel Root Directory is frontend.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

function assertEnvDocumentation() {
  const envExample = readFileSync(envExamplePath, "utf8");
  for (const envVar of requiredFrontendEnvVars) {
    if (!envExample.includes(`${envVar}=`)) {
      fail(`.env.example is missing ${envVar}.`);
    }
  }
}

function assertDocs() {
  assertFileContains(docsPath, "Root Directory: `frontend`", "Deployment guide");
  assertFileContains(docsPath, "Build Command: `npm run build`", "Deployment guide");
  assertFileContains(docsPath, "Install Command: `npm install`", "Deployment guide");
}

function main() {
  console.log("Checking Vercel deployment configuration...");
  assertFrontendPackage();
  assertVercelConfig();
  assertEnvDocumentation();
  assertDocs();
  scanForForbiddenPatterns();

  console.log("Checking installed frontend dependencies...");
  run("npm", ["--prefix", "frontend", "ls", "--depth=0"]);

  console.log("Running frontend lint...");
  run("npm", ["--prefix", "frontend", "run", "lint"]);

  console.log("Running frontend production build...");
  run("npm", ["--prefix", "frontend", "run", "build"]);

  console.log("Vercel verification passed.");
}

main();
