/**
 * Deploys only the v2 contracts that are not yet on-chain.
 * Skips contracts that are already deployed (ContractAlreadyExists).
 * Run: tsx scripts/deploy-v2-remaining.ts
 */
import "dotenv/config";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import {
  AnchorMode,
  PostConditionMode,
  broadcastTransaction,
  makeContractDeploy
} from "@stacks/transactions";
import { StacksTestnet } from "@stacks/network";
import { appConfig, resolveDeployerSenderKey } from "./lib/config.js";

const network = new StacksTestnet({ url: appConfig.stacksApiUrl });

const CONTRACTS_TO_DEPLOY = [
  { name: "sip-010-ft-trait-v2",   path: "contracts/sip-010-ft-trait-v2.clar" },
  { name: "governance-params-v2",   path: "contracts/governance-params-v2.clar" },
  { name: "vault-registry-v2",      path: "contracts/vault-registry-v2.clar" },
  { name: "proposal-manager-v2",    path: "contracts/proposal-manager-v2.clar" },
  { name: "zest-adapter-v2",        path: "contracts/zest-adapter-testnet-v2.clar" },
  { name: "vault-circle-v2",        path: "contracts/vault-circle-v2.clar" },
];

async function isDeployed(contractName: string): Promise<boolean> {
  const url = `${appConfig.stacksApiUrl}/v2/contracts/interface/${appConfig.deployerAddress}/${contractName}`;
  try {
    const res = await fetch(url);
    return res.status === 200;
  } catch {
    return false;
  }
}

async function waitForTx(txid: string, label: string): Promise<void> {
  console.log(`  Waiting for ${label} (${txid})…`);
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 8_000));
    try {
      const res = await fetch(`${appConfig.stacksApiUrl}/extended/v1/tx/${txid}`);
      if (res.ok) {
        const json = await res.json() as { tx_status: string };
        if (json.tx_status === "success") {
          console.log(`  ✅ ${label} confirmed`);
          return;
        }
        if (["abort_by_response", "abort_by_post_condition", "dropped_replace_by_fee"].includes(json.tx_status)) {
          throw new Error(`${label} failed: ${json.tx_status}`);
        }
        process.stdout.write(".");
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith(label)) throw e;
    }
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function main() {
  const senderKey = resolveDeployerSenderKey();
  const results: Record<string, string> = {};

  for (const { name, path } of CONTRACTS_TO_DEPLOY) {
    const already = await isDeployed(name);
    if (already) {
      console.log(`⏭  ${name} already deployed — skipping`);
      results[name] = "already-deployed";
      continue;
    }

    console.log(`🚀 Deploying ${name}…`);
    const codeBody = readFileSync(path, "utf8");

    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const tx = await makeContractDeploy({
          contractName: name,
          codeBody,
          senderKey,
          network,
          anchorMode: AnchorMode.Any,
          postConditionMode: PostConditionMode.Deny,
          clarityVersion: 3,
          fee: 50_000,  // 0.05 STX — fixed fee avoids node fee-estimation spikes
        });
        const broadcast = await broadcastTransaction(tx, network) as { txid?: string; error?: string; reason?: string };
        if (broadcast.error) {
          if (broadcast.reason === "ContractAlreadyExists") {
            console.log(`  ⏭  ${name} already exists on-chain`);
            results[name] = "already-deployed";
          } else {
            throw new Error(`Broadcast error: ${broadcast.reason ?? broadcast.error}`);
          }
        } else {
          const txid = broadcast.txid!;
          await waitForTx(txid, name);
          results[name] = txid;
        }
        break;
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("ContractAlreadyExists") || msg.includes("already-deployed")) break;
        const isRate = msg.includes("429") || /rate.?limit/i.test(msg);
        if (isRate && attempt < 3) {
          console.warn(`  Rate-limited, waiting 30s before retry ${attempt}/3…`);
          await new Promise(r => setTimeout(r, 30_000));
          continue;
        }
        throw e;
      }
    }
    if (results[name] === undefined) throw lastErr;

    // Brief pause between deploys to avoid bursting the mempool
    await new Promise(r => setTimeout(r, 3_000));
  }

  mkdirSync("artifacts/testnet", { recursive: true });
  writeFileSync("artifacts/testnet/deploy-v2-remaining.json", JSON.stringify({ results, generatedAt: new Date().toISOString() }, null, 2));
  console.log("\nDone. Results:");
  for (const [k, v] of Object.entries(results)) console.log(`  ${k}: ${v}`);
}

main().catch(e => { console.error(e); process.exit(1); });
