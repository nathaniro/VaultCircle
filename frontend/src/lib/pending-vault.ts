import type { Vault } from "@/types";

const STORAGE_KEY = "vaultcircle.pending-vault-creations";
const MAX_PENDING_AGE_MS = 30 * 60 * 1000;

export interface PendingVaultCreation {
  txId: string;
  walletAddress: string;
  name: string;
  thresholdPercent: number;
  memberCount: number;
  yieldEnabled: boolean;
  submittedAt: number;
  vaultId?: number | null;
}

function readAllPendingVaults(): PendingVaultCreation[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as PendingVaultCreation[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry) => Date.now() - entry.submittedAt < MAX_PENDING_AGE_MS);
  } catch {
    return [];
  }
}

function writeAllPendingVaults(entries: PendingVaultCreation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function savePendingVaultCreation(entry: PendingVaultCreation) {
  const current = readAllPendingVaults().filter((item) => item.txId !== entry.txId);
  current.unshift(entry);
  writeAllPendingVaults(current);
}

export function getPendingVaultCreation(walletAddress: string): PendingVaultCreation | null {
  return readAllPendingVaults().find((entry) => entry.walletAddress === walletAddress) ?? null;
}

export function clearPendingVaultCreation(txId: string) {
  const current = readAllPendingVaults().filter((entry) => entry.txId !== txId);
  writeAllPendingVaults(current);
}

export function matchesPendingVault(vault: Vault, pendingVault: PendingVaultCreation) {
  if (typeof pendingVault.vaultId === "number") {
    return vault.vaultId === pendingVault.vaultId;
  }

  return (
    vault.creator === pendingVault.walletAddress &&
    vault.name === pendingVault.name &&
    vault.thresholdPercent === pendingVault.thresholdPercent &&
    vault.memberCount === pendingVault.memberCount &&
    vault.yieldEnabled === pendingVault.yieldEnabled
  );
}
