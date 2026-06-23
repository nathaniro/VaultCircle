import { STACKS_API_URL } from "./contracts";
import { normalizeUint } from "./validation";

const FAILED_TX_STATUSES = new Set([
  "abort_by_response",
  "abort_by_post_condition",
  "dropped_replace_by_fee",
  "dropped_replaced",
  "dropped_too_expensive",
  "dropped_stale_garbage_collect"
]);

export interface StacksTransactionStatus {
  tx_id: string;
  tx_status: string;
  tx_result?: {
    hex?: string;
    repr?: string;
  };
}

export type CreateVaultOutcome =
  | {
      status: "success";
      txId: string;
      vaultId: number | null;
    }
  | {
      status: "failed";
      txId: string;
      message: string;
      errorCode: number | null;
    }
  | {
      status: "timeout";
      txId: string;
      message: string;
    };

function getTxStatusUrl(txId: string) {
  return `${STACKS_API_URL.replace(/\/$/, "")}/extended/v1/tx/${txId}`;
}

async function fetchTransactionStatus(txId: string): Promise<StacksTransactionStatus | null> {
  const response = await fetch(getTxStatusUrl(txId), { cache: "no-store" });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Could not load transaction status for ${txId}.`);
  }

  return (await response.json()) as StacksTransactionStatus;
}

export function extractOkUintFromTxRepr(repr: string | undefined): number | null {
  if (!repr) return null;
  const match = repr.match(/^\(ok u(\d+)\)$/);
  if (!match) return null;
  return normalizeUint(match[1], 0);
}

export function extractErrCodeFromTxRepr(repr: string | undefined): number | null {
  if (!repr) return null;
  const match = repr.match(/^\(err u(\d+)\)$/);
  if (!match) return null;
  return normalizeUint(match[1], 0);
}

export function mapCreateVaultFailure(status: string, repr?: string) {
  const errorCode = extractErrCodeFromTxRepr(repr);

  if (status === "abort_by_post_condition") {
    return {
      errorCode,
      message: "The wallet blocked the transaction before the contract could create the vault."
    };
  }

  switch (errorCode) {
    case 200:
      return {
        errorCode,
        message: "VaultCircle could not register the new vault in the protocol registry. This testnet deployment may need to be initialized again."
      };
    case 604:
      return {
        errorCode,
        message: "The contract rejected the approval threshold. Keep it within the protocol's allowed range."
      };
    case 608:
      return {
        errorCode,
        message: "Vault creation is currently paused on this Stacks Testnet deployment."
      };
    case 617:
      return {
        errorCode,
        message: "The contract rejected the vault name. Use a non-empty name and try again."
      };
    case 622:
      return {
        errorCode,
        message: "Too many initial members were submitted. Reduce the list and try again."
      };
    case 628:
      return {
        errorCode,
        message: "VaultCircle has not been initialized with its sBTC contract on this deployment yet, so new vaults cannot be created."
      };
    default:
      return {
        errorCode,
        message: "The contract rejected vault creation on the selected Stacks Testnet deployment. Please review the form values and deployment setup."
      };
  }
}

export async function waitForCreateVaultOutcome(
  txId: string,
  options?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
  }
): Promise<CreateVaultOutcome> {
  const timeoutMs = options?.timeoutMs ?? 180000;
  const pollIntervalMs = options?.pollIntervalMs ?? 4000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const tx = await fetchTransactionStatus(txId);

    if (tx) {
      if (tx.tx_status === "success") {
        return {
          status: "success",
          txId,
          vaultId: extractOkUintFromTxRepr(tx.tx_result?.repr)
        };
      }

      if (FAILED_TX_STATUSES.has(tx.tx_status)) {
        const failure = mapCreateVaultFailure(tx.tx_status, tx.tx_result?.repr);
        return {
          status: "failed",
          txId,
          message: failure.message,
          errorCode: failure.errorCode
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return {
    status: "timeout",
    txId,
    message: "The transaction was broadcast, but Stacks Testnet has not confirmed it yet. We will keep tracking it from your dashboard."
  };
}
