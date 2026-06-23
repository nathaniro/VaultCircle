import {
  AnchorMode,
  PostConditionMode,
  TransactionVersion,
  boolCV,
  broadcastTransaction,
  callReadOnlyFunction,
  contractPrincipalCV,
  cvToValue,
  getAddressFromPrivateKey,
  listCV,
  makeContractCall,
  noneCV,
  principalCV,
  someCV,
  stringAsciiCV,
  uintCV,
  type ClarityValue
} from "@stacks/transactions";
import { StacksTestnet } from "@stacks/network";
import { appConfig, parseContractPrincipal } from "./config.js";

export function getNetwork() {
  return new StacksTestnet({ url: appConfig.stacksApiUrl });
}

export function getTxVersion() {
  return TransactionVersion.Testnet;
}

export function addressFromPrivateKey(privateKey: string) {
  return getAddressFromPrivateKey(privateKey, getTxVersion());
}

export function tokenContractArg(contractPrincipal: string) {
  const { contractAddress, contractName } = parseContractPrincipal(contractPrincipal);
  return contractPrincipalCV(contractAddress, contractName);
}

export async function callReadonly(contractPrincipal: string, functionName: string, functionArgs: ClarityValue[], senderAddress = appConfig.deployerAddress) {
  const network = getNetwork();
  const { contractAddress, contractName } = parseContractPrincipal(contractPrincipal);
  let lastError: unknown;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const result = await callReadOnlyFunction({
        contractAddress,
        contractName,
        functionName,
        functionArgs,
        network,
        senderAddress
      });
      return cvToValue(result);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isTransient =
        message.includes("429") ||
        message.includes("504") ||
        message.toLowerCase().includes("rate limit") ||
        message.toLowerCase().includes("gateway timeout");
      if (!isTransient || attempt === 5) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 12000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function broadcastContractCall(
  senderKey: string,
  contractPrincipal: string,
  functionName: string,
  functionArgs: ClarityValue[]
) {
  const network = getNetwork();
  const { contractAddress, contractName } = parseContractPrincipal(contractPrincipal);
  let lastError: unknown;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const transaction = await makeContractCall({
        contractAddress,
        contractName,
        functionName,
        functionArgs,
        senderKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Deny
      });
      return broadcastTransaction(transaction, network);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimited = message.includes("429") || message.toLowerCase().includes("rate limit");
      if (!isRateLimited || attempt === 5) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 12000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function waitForTx(txid: string, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const response = await fetch(`${appConfig.stacksApiUrl.replace(/\/$/, "")}/extended/v1/tx/${txid}`);
    if (response.ok) {
      const json = await response.json();
      if (json.tx_status === "success") return json;
      if (json.tx_status === "abort_by_response" || json.tx_status === "abort_by_post_condition" || json.tx_status === "dropped_replace_by_fee") {
        throw new Error(`Transaction ${txid} failed with status ${json.tx_status}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Timed out waiting for transaction ${txid}`);
}

export async function getSbtcBalance(contractPrincipal: string, owner: string) {
  const raw = await callReadonly(contractPrincipal, "get-balance", [principalCV(owner)], owner);
  if (typeof raw === "object" && raw !== null && "value" in raw) {
    return Number((raw as { value: bigint | number }).value);
  }
  return Number(raw);
}

export async function getStxBalance(address: string) {
  const response = await fetch(`${appConfig.stacksApiUrl.replace(/\/$/, "")}/extended/v1/address/${address}/balances`);
  if (!response.ok) throw new Error(`Failed to fetch STX balance for ${address}`);
  const json = await response.json();
  return Number(json.stx?.balance || 0);
}

export const ClarityArgs = {
  bool: boolCV,
  uint: uintCV,
  ascii: stringAsciiCV,
  principal: principalCV,
  contractPrincipal: contractPrincipalCV,
  some: someCV,
  none: noneCV,
  list: listCV
};
