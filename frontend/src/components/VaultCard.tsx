import Link from "next/link";
import VaultMembershipBadge from "@/components/VaultMembershipBadge";
import type { Vault } from "@/types";
import { satsTosBTC } from "@/types";

interface VaultCardProps {
  vault: Vault;
  showMembershipBadge?: boolean;
  creatorMember?: boolean;
}

export default function VaultCard({
  vault,
  showMembershipBadge = false,
  creatorMember = false
}: VaultCardProps) {
  return (
    <Link
      href={`/vault/${vault.vaultId}`}
      className="surface-card surface-card-interactive group block"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">Vault #{vault.vaultId}</p>
          <h3 className="mt-3 text-2xl font-semibold text-ink-50 transition group-hover:text-orange-600 dark:group-hover:text-orange-100">{vault.name}</h3>
          <p className="mt-2 text-sm leading-6 text-ink-400">
            Shared treasury with {vault.memberCount} member{vault.memberCount !== 1 ? "s" : ""} and a{" "}
            {vault.thresholdPercent}% approval threshold before assets move.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          {showMembershipBadge && <VaultMembershipBadge compact creator={creatorMember} />}
          <span className={vault.status === "ACTIVE" ? "badge-active" : "badge-executed"}>{vault.status}</span>
        </div>
      </div>

      <div className="divider mt-6 pt-6" />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="stat-label">Total Vault Value</p>
          <p className="mt-3 text-2xl font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
            {satsTosBTC(vault.totalVaultValue || vault.liquidBalance)} sBTC
          </p>
        </div>
        <div>
          <p className="stat-label">Liquid Balance</p>
          <p className="mt-3 text-2xl font-semibold text-ink-50 tabular-nums">{satsTosBTC(vault.liquidBalance)} sBTC</p>
        </div>
        <div>
          <p className="stat-label">Yield Configuration</p>
          <p className={`mt-3 text-sm font-semibold ${vault.yieldEnabled ? "text-emerald-700 dark:text-emerald-300" : "text-ink-400"}`}>
            {vault.yieldEnabled ? "Zest voting enabled" : "Yield kept disabled"}
          </p>
        </div>
        <div>
          <p className="stat-label">Member Coordination</p>
          <p className="mt-3 text-sm font-semibold text-ink-50">
            {vault.thresholdPercent}% threshold across {vault.memberCount} signers
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm text-ink-400">
        <span>Open vault details and next actions</span>
        <span className="transition duration-200 group-hover:translate-x-1 group-hover:text-orange-600 dark:group-hover:text-orange-200">-&gt;</span>
      </div>
    </Link>
  );
}
