import {
  AnchorMode,
  PostConditionMode,
  boolCV,
  contractPrincipalCV,
  listCV,
  noneCV,
  principalCV,
  serializeCV,
  someCV,
  stringAsciiCV,
  uintCV,
  type ClarityValue
} from "@stacks/transactions";
import { openContractCall } from "@stacks/connect";
import { CONTRACTS, DEFAULT_PROPOSAL_DURATION, getStacksNetwork, splitContractId } from "./contracts";
import { debugLog } from "./debug";
import { APP_DETAILS, userSession } from "./app-session";
import { getSelectedWalletProvider } from "./wallet-provider";
import { isSafeUint, isValidStacksAddress } from "./validation";

type TxCallback = (result: { txId: string }) => void;
type ErrCallback = (error: unknown) => void;

const network = getStacksNetwork();
const vaultCircle = splitContractId(CONTRACTS.vaultCircle);
const sbtcContract = splitContractId(CONTRACTS.sbtc);

function logTransaction(message: string, details?: Record<string, unknown>) {
  debugLog("Transactions", message, details);
}

function tokenTraitArg() {
  return contractPrincipalCV(sbtcContract.address, sbtcContract.name);
}

function makeCancelHandler(onCancel?: ErrCallback) {
  if (!onCancel) return undefined;
  return () => onCancel(new Error("Transaction cancelled by wallet"));
}

function requireUint(value: number, label: string, minimum = 0) {
  if (!isSafeUint(value, minimum)) {
    throw new Error(`${label} must be a whole number ${minimum > 0 ? `of at least ${minimum}` : "that is zero or greater"}.`);
  }

  return value;
}

function requireStacksAddress(value: string, label: string) {
  const normalized = value.trim();
  if (!isValidStacksAddress(normalized)) {
    throw new Error(`${label} must be a valid Stacks testnet address.`);
  }

  return normalized;
}

type CallOptions = Parameters<typeof openContractCall>[0];
type CallResult = Parameters<NonNullable<CallOptions["onFinish"]>>[0];
type LeatherCallResult = { txId?: string; txid?: string; transaction?: { txId?: string; txid?: string } } | string | null;
type LeatherRpcResponse = {
  result?: LeatherCallResult;
  error?: { code?: number; message?: string };
};
type LeatherProvider = NonNullable<ReturnType<typeof getSelectedWalletProvider>> & {
  request: (method: string, params?: Record<string, unknown>) => Promise<LeatherRpcResponse>;
  isLeather?: boolean;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

function nestedErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== "object") return String(error ?? "");

  const candidate = error as Record<string, unknown>;
  if (typeof candidate.message === "string") return candidate.message;

  const nested = candidate.error;
  if (nested && typeof nested === "object" && typeof (nested as Record<string, unknown>).message === "string") {
    return (nested as Record<string, unknown>).message as string;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "[unparseable wallet error]";
  }
}

function isWalletCancellation(error: unknown) {
  const message = getErrorMessage(error);
  return /cancel|reject|denied|dismiss/i.test(message);
}

function nestedErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as Record<string, unknown>;
  if (typeof candidate.code === "number") return candidate.code;
  const nested = candidate.error;
  if (nested && typeof nested === "object" && typeof (nested as Record<string, unknown>).code === "number") {
    return (nested as Record<string, unknown>).code as number;
  }
  return undefined;
}

function isLeatherProvider(provider: NonNullable<ReturnType<typeof getSelectedWalletProvider>>): provider is LeatherProvider {
  return Boolean(provider.isLeather && typeof provider.request === "function");
}

function clarityValueToHex(value: ClarityValue | string) {
  if (typeof value === "string") return value;
  const bytes = serializeCV(value);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function extractLeatherTxId(result: LeatherCallResult): string | null {
  if (!result) return null;
  if (typeof result === "string") return result.replace(/^0x/, "");

  const txId = result.txId ?? result.txid ?? result.transaction?.txId ?? result.transaction?.txid ?? null;
  return txId ? txId.replace(/^0x/, "") : null;
}

async function callLeatherRpcMethod(
  provider: LeatherProvider,
  method: string,
  params?: Record<string, unknown>
) {
  logTransaction("callLeatherRpcMethod(): invoking provider.request()", {
    method,
    paramKeys: params ? Object.keys(params) : []
  });

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`WALLET_TIMEOUT:${method}`)), 20_000);
  });

  return Promise.race([provider.request(method, params), timeout]);
}

async function reconnectLeather(provider: LeatherProvider, functionName: string, onCancel?: CallOptions["onCancel"]) {
  try {
    await callLeatherRpcMethod(provider, "getAddresses");
    logTransaction("call(): Leather getAddresses resolved", { functionName });
    return true;
  } catch (error) {
    console.error("[VaultCircle][Transactions] call(): Leather getAddresses failed", error);
    if (isWalletCancellation(error)) {
      onCancel?.();
      return false;
    }
    if (error instanceof Error && error.message.startsWith("WALLET_TIMEOUT:")) {
      throw new Error("Leather did not respond to the reconnect request. Unlock the extension, approve the prompt, and try again.");
    }
    throw new Error(nestedErrorMessage(error) || "Leather could not refresh the wallet session.");
  }
}

async function callViaLeatherRpc(
  provider: LeatherProvider,
  options: CallOptions,
  onFinish: CallOptions["onFinish"],
  onCancel: CallOptions["onCancel"]
) {
  const params: Record<string, unknown> = {
    contract: `${options.contractAddress}.${options.contractName}`,
    functionName: options.functionName,
    functionArgs: (options.functionArgs ?? []).map((value) => clarityValueToHex(value as ClarityValue | string)),
    network: "testnet",
    postConditionMode: options.postConditionMode === PostConditionMode.Allow ? "allow" : "deny",
    postConditions: []
  };

  logTransaction("call(): using Leather RPC path", {
    functionName: options.functionName,
    providerId: provider.id ?? null,
    paramContract: params.contract,
    functionArgsCount: Array.isArray(params.functionArgs) ? params.functionArgs.length : 0
  });

  let response: LeatherRpcResponse;
  try {
    response = await callLeatherRpcMethod(provider, "stx_callContract", params);
  } catch (error) {
    const errorCode = nestedErrorCode(error);

    if (errorCode === 16) {
      console.warn("[VaultCircle][Transactions] call(): Leather stx_callContract reported an expired session", error);
      logTransaction("call(): Leather session expired, reconnecting wallet", {
        functionName: options.functionName
      });
      const reconnected = await reconnectLeather(provider, options.functionName, onCancel);
      if (!reconnected) return;
      try {
        response = await callLeatherRpcMethod(provider, "stx_callContract", params);
      } catch (retryError) {
        console.error("[VaultCircle][Transactions] call(): Leather retry after reconnect failed", retryError);
        if (isWalletCancellation(retryError)) {
          onCancel?.();
          return;
        }
        if (retryError instanceof Error && retryError.message.startsWith("WALLET_TIMEOUT:")) {
          throw new Error("Leather did not finish the signing request after reconnecting. Bring the wallet window to the front and try again.");
        }
        throw new Error(
          nestedErrorMessage(retryError) ||
            "Leather reconnected, but the contract call still did not complete. Please retry the transaction."
        );
      }
    } else if (isWalletCancellation(error)) {
      console.warn("[VaultCircle][Transactions] call(): Leather stx_callContract was cancelled", error);
      onCancel?.();
      return;
    } else {
      console.error("[VaultCircle][Transactions] call(): Leather stx_callContract failed", error);
      if (error instanceof Error && error.message.startsWith("WALLET_TIMEOUT:")) {
        throw new Error("Leather did not respond to the signing request. Open the wallet extension and try again.");
      }
      throw new Error(nestedErrorMessage(error) || "Leather could not complete the contract call.");
    }
  }

  if (response.error) {
    console.error("[VaultCircle][Transactions] call(): Leather RPC returned error payload", response.error);
    if (isWalletCancellation(response.error.message ?? "")) {
      onCancel?.();
      return;
    }
    throw new Error(response.error.message ?? "Leather returned an unexpected RPC error.");
  }

  const txId = extractLeatherTxId(response.result ?? null);
  logTransaction("call(): Leather RPC response received", {
    functionName: options.functionName,
    txId,
    hasResult: Boolean(response.result)
  });

  if (!txId) {
    onCancel?.();
    return;
  }

  const txFinish = onFinish as ((result: { txId: string }) => void) | undefined;
  txFinish?.({ txId });
}

async function call(options: CallOptions): Promise<void> {
  const selectedProvider = getSelectedWalletProvider();
  const originalOnFinish = options.onFinish;
  const originalOnCancel = options.onCancel;
  logTransaction("call(): preparing contract call", {
    contractAddress: options.contractAddress,
    contractName: options.contractName,
    functionName: options.functionName,
    functionArgsCount: options.functionArgs?.length ?? 0,
    hasOnFinish: typeof options.onFinish === "function",
    hasOnCancel: typeof options.onCancel === "function",
    providerFound: Boolean(selectedProvider),
    providerId: selectedProvider?.id ?? null,
    providerIsLeather: Boolean(selectedProvider?.isLeather)
  });

  if (!selectedProvider) {
    console.error("[VaultCircle][Transactions] call(): no selected provider was resolved");
    throw new Error("VaultCircle could not find the connected wallet signer. Use Connect Wallet or Switch Wallet, then try again.");
  }

  let unresolvedWarning: ReturnType<typeof setTimeout> | null = null;
  try {
    unresolvedWarning = setTimeout(() => {
      console.warn("[VaultCircle][Transactions] call(): openContractCall() is still pending after 20s", {
        functionName: options.functionName,
        providerId: selectedProvider.id ?? null,
        providerIsLeather: Boolean(selectedProvider.isLeather)
      });
    }, 20_000);

    logTransaction("call(): invoking openContractCall()", {
      functionName: options.functionName,
      providerId: selectedProvider.id ?? null
    });
    const instrumentedOptions = {
      ...options,
      onFinish: originalOnFinish
        ? ((result: CallResult) => {
            logTransaction("call(): wallet onFinish callback fired", {
              functionName: options.functionName,
              txId: "txId" in result ? result.txId : null
            });
            (originalOnFinish as (callbackResult: CallResult) => void)(result);
          }) as CallOptions["onFinish"]
        : undefined,
      onCancel: originalOnCancel
        ? (() => {
            console.warn("[VaultCircle][Transactions] call(): wallet onCancel callback fired", {
              functionName: options.functionName
            });
            originalOnCancel();
          }) as CallOptions["onCancel"]
        : undefined,
      appDetails: APP_DETAILS,
      userSession
    } as CallOptions;

    if (isLeatherProvider(selectedProvider)) {
      await callViaLeatherRpc(selectedProvider, instrumentedOptions, instrumentedOptions.onFinish, instrumentedOptions.onCancel);
      logTransaction("call(): Leather RPC path resolved", {
        functionName: options.functionName
      });
      return;
    }

    await openContractCall(
      instrumentedOptions,
      selectedProvider
    );
    logTransaction("call(): openContractCall() promise resolved", {
      functionName: options.functionName
    });
  } catch (error) {
    console.error("[VaultCircle][Transactions] call(): openContractCall() threw", error);
    if (isWalletCancellation(error)) {
      console.warn("[VaultCircle][Transactions] call(): treating wallet error as cancellation", {
        functionName: options.functionName,
        message: getErrorMessage(error)
      });
      options.onCancel?.();
      return;
    }

    throw error;
  } finally {
    if (unresolvedWarning) {
      clearTimeout(unresolvedWarning);
    }
  }
}

export async function txCreateVault(
  name: string,
  initialMembers: string[],
  thresholdPercent: number,
  yieldEnabled: boolean,
  beneficiary: string | null,
  onFinish: TxCallback,
  onCancel?: ErrCallback
) {
  const normalizedMembers = initialMembers.map((member) => requireStacksAddress(member, "Each member address"));
  const normalizedBeneficiary = beneficiary ? requireStacksAddress(beneficiary, "Beneficiary address") : null;
  logTransaction("txCreateVault()", {
    name,
    initialMembersCount: normalizedMembers.length,
    thresholdPercent,
    yieldEnabled,
    hasBeneficiary: Boolean(normalizedBeneficiary)
  });

  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "create-vault",
    functionArgs: [
      stringAsciiCV(name),
      listCV(normalizedMembers.map(principalCV)),
      uintCV(requireUint(thresholdPercent, "Approval threshold", 1)),
      boolCV(yieldEnabled),
      normalizedBeneficiary ? someCV(principalCV(normalizedBeneficiary)) : noneCV()
    ],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}

export async function txDeposit(vaultId: number, amount: number, onFinish: TxCallback, onCancel?: ErrCallback) {
  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "deposit",
    functionArgs: [tokenTraitArg(), uintCV(requireUint(vaultId, "Vault id")), uintCV(requireUint(amount, "Deposit amount", 1))],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}

export async function txCreateProposal(
  vaultId: number,
  proposalType: number,
  amount: number,
  recipient: string | null,
  reason: string,
  durationBlocks = DEFAULT_PROPOSAL_DURATION,
  onFinish: TxCallback,
  onCancel?: ErrCallback
) {
  const normalizedRecipient = recipient ? requireStacksAddress(recipient, "Recipient address") : null;

  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "create-proposal",
    functionArgs: [
      uintCV(requireUint(vaultId, "Vault id")),
      uintCV(requireUint(proposalType, "Proposal type", 1)),
      uintCV(requireUint(amount, "Proposal amount", 0)),
      normalizedRecipient ? someCV(principalCV(normalizedRecipient)) : noneCV(),
      stringAsciiCV(reason.slice(0, 256)),
      uintCV(requireUint(durationBlocks, "Voting duration", 1))
    ],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}

export async function txVote(vaultId: number, proposalId: number, approve: boolean, onFinish: TxCallback, onCancel?: ErrCallback) {
  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "vote-on-proposal",
    functionArgs: [uintCV(requireUint(vaultId, "Vault id")), uintCV(requireUint(proposalId, "Proposal id")), boolCV(approve)],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}

export async function txExecuteProposal(vaultId: number, proposalId: number, onFinish: TxCallback, onCancel?: ErrCallback) {
  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "execute-proposal",
    functionArgs: [tokenTraitArg(), uintCV(requireUint(vaultId, "Vault id")), uintCV(requireUint(proposalId, "Proposal id"))],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}

export async function txInitializeProtocol(
  sbtcContractId: string,
  onFinish: TxCallback,
  onCancel?: ErrCallback
) {
  const sbtc = splitContractId(sbtcContractId);
  logTransaction("txInitializeProtocol()", { sbtcContractId });
  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "initialize-protocol",
    functionArgs: [contractPrincipalCV(sbtc.address, sbtc.name)],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}

export async function txSyncZestYield(vaultId: number, onFinish: TxCallback, onCancel?: ErrCallback) {
  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "sync-zest-yield",
    functionArgs: [uintCV(requireUint(vaultId, "Vault id"))],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}
