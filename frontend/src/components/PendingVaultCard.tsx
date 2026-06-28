import Link from "next/link";
import VaultMembershipBadge from "@/components/VaultMembershipBadge";
import type { PendingVaultCreation } from "@/lib/pending-vault";
import type { Vault } from "@/types";
import { satsTosBTC } from "@/types";

interface PendingVaultCardProps {
  pendingVault?: PendingVaultCreation | null;
  revealedVault?: Vault | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  showMembershipBadge?: boolean;
  creatorMember?: boolean;
}

export default function PendingVaultCard({
  pendingVault,
  revealedVault,
  refreshing = false,
  onRefresh,
  showMembershipBadge = false,
  creatorMember = false
}: PendingVaultCardProps) {
  if (revealedVault) {
    return (
      <Link href={`/vault/${revealedVault.vaultId}`} className="surface-card surface-card-interactive vault-morph-card vault-morph-ready group block">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Vault Ready</p>
            <h3 className="mt-3 text-2xl font-semibold text-white transition group-hover:text-emerald-100">{revealedVault.name}</h3>
            <p className="mt-2 text-sm leading-6 text-emerald-50/85">
              Testnet finished indexing this vault. The pending setup is now live in your dashboard and ready for deposits,
              proposals, and member coordination.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            {showMembershipBadge && <VaultMembershipBadge compact creator={creatorMember} label="Member Access" />}
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              Live
            </span>
          </div>
        </div>

        <div className="divider mt-6 pt-6" />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="stat-label">Vault id</p>
            <p className="mt-3 text-2xl font-semibold text-white">#{revealedVault.vaultId}</p>
          </div>
          <div>
            <p className="stat-label">Total vault value</p>
            <p className="mt-3 text-2xl font-semibold text-amber-300">
              {satsTosBTC(revealedVault.totalVaultValue || revealedVault.liquidBalance)} sBTC
            </p>
          </div>
          <div>
            <p className="stat-label">Members at launch</p>
            <p className="mt-3 text-sm font-semibold text-white">{revealedVault.memberCount} signers active</p>
          </div>
          <div>
            <p className="stat-label">Approval threshold</p>
            <p className="mt-3 text-sm font-semibold text-white">{revealedVault.thresholdPercent}% before assets move</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-6 text-sm text-emerald-50/80">
          <span>Open the new vault and continue setup</span>
          <span className="transition duration-200 group-hover:translate-x-1 group-hover:text-emerald-100">-&gt;</span>
        </div>
      </Link>
    );
  }

  if (!pendingVault) {
    return null;
  }

  return (
    <div className="surface-card vault-morph-card border-cyan-400/20 bg-cyan-400/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Pending Vault</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">{pendingVault.name}</h3>
          <p className="mt-2 text-sm leading-6 text-cyan-50/80">
            This vault creation transaction has been submitted. We are waiting for Stacks Testnet to confirm and index it
            so it can appear in your dashboard.
          </p>
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
          {refreshing ? "Indexing" : "Submitted"}
        </span>
      </div>

      <div className="divider mt-6 pt-6" />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="stat-label">Members at launch</p>
          <p className="mt-3 text-2xl font-semibold text-white">{pendingVault.memberCount}</p>
        </div>
        <div>
          <p className="stat-label">Approval threshold</p>
          <p className="mt-3 text-2xl font-semibold text-amber-300">{pendingVault.thresholdPercent}%</p>
        </div>
        <div>
          <p className="stat-label">Yield configuration</p>
          <p className={`mt-3 text-sm font-semibold ${pendingVault.yieldEnabled ? "text-emerald-300" : "text-slate-300"}`}>
            {pendingVault.yieldEnabled ? "Yield path enabled" : "Yield path disabled"}
          </p>
        </div>
        <div>
          <p className="stat-label">Submitted transaction</p>
          <p className="mt-3 break-all font-mono text-xs text-slate-300">{pendingVault.txId}</p>
        </div>
        {typeof pendingVault.vaultId === "number" && (
          <div>
            <p className="stat-label">Confirmed vault id</p>
            <p className="mt-3 text-sm font-semibold text-white">#{pendingVault.vaultId}</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-300">
          If the vault does not appear right away, you can refresh now while testnet finishes indexing it.
        </p>
        <button onClick={onRefresh} disabled={refreshing || !onRefresh} className="btn-secondary shrink-0 px-4 py-2 text-sm">
          {refreshing ? "Refreshing..." : "Refresh now"}
        </button>
      </div>
    </div>
  );
}
