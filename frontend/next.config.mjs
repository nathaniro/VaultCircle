import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(projectDir, "..");
loadEnvConfig(projectDir);
loadEnvConfig(repoRoot);

function rootContract(contractName) {
  const deployerAddress = process.env.NEXT_PUBLIC_DEPLOYER_ADDRESS || process.env.DEPLOYER_ADDRESS;
  return deployerAddress ? `${deployerAddress}.${contractName}` : "";
}

const publicEnv = {
  NEXT_PUBLIC_STACKS_NETWORK: process.env.NEXT_PUBLIC_STACKS_NETWORK || process.env.STACKS_NETWORK || "testnet",
  NEXT_PUBLIC_STACKS_API_URL: process.env.NEXT_PUBLIC_STACKS_API_URL || process.env.STACKS_API_URL || "https://api.testnet.hiro.so",
  NEXT_PUBLIC_EXPLORER_BASE_URL:
    process.env.NEXT_PUBLIC_EXPLORER_BASE_URL ||
    process.env.STACKS_EXPLORER_URL ||
    process.env.NEXT_PUBLIC_STACKS_EXPLORER_URL ||
    "https://explorer.hiro.so",
  NEXT_PUBLIC_DEPLOYER_ADDRESS:
    process.env.NEXT_PUBLIC_DEPLOYER_ADDRESS ||
    process.env.DEPLOYER_ADDRESS ||
    "",
  NEXT_PUBLIC_VAULT_CIRCLE_CONTRACT:
    process.env.NEXT_PUBLIC_VAULT_CIRCLE_CONTRACT ||
    rootContract("vault-circle"),
  NEXT_PUBLIC_PROPOSAL_MANAGER_CONTRACT:
    process.env.NEXT_PUBLIC_PROPOSAL_MANAGER_CONTRACT ||
    rootContract("proposal-manager"),
  NEXT_PUBLIC_VAULT_REGISTRY_CONTRACT:
    process.env.NEXT_PUBLIC_VAULT_REGISTRY_CONTRACT ||
    rootContract("vault-registry"),
  NEXT_PUBLIC_GOVERNANCE_PARAMS_CONTRACT:
    process.env.NEXT_PUBLIC_GOVERNANCE_PARAMS_CONTRACT ||
    rootContract("governance-params"),
  NEXT_PUBLIC_ZEST_ADAPTER_CONTRACT:
    process.env.NEXT_PUBLIC_ZEST_ADAPTER_CONTRACT ||
    process.env.ZEST_CONTRACT_PRINCIPAL ||
    rootContract("zest-adapter"),
  NEXT_PUBLIC_SBTC_CONTRACT:
    process.env.NEXT_PUBLIC_SBTC_CONTRACT ||
    process.env.SBTC_CONTRACT_PRINCIPAL ||
    "",
  NEXT_PUBLIC_ZEST_MODE:
    process.env.NEXT_PUBLIC_ZEST_MODE ||
    process.env.ZEST_ADAPTER_MODE ||
    "disabled"
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: repoRoot,
  env: publicEnv,
  async rewrites() {
    return [
      {
        source: "/api/hiro/:path*",
        destination: "https://api.testnet.hiro.so/:path*"
      }
    ];
  }
};

export default nextConfig;
