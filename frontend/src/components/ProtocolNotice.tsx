"use client";

import { FRONTEND_ENV_WARNING, HAS_FRONTEND_ENV_FALLBACKS } from "@/lib/contracts";
import { useWallet } from "@/lib/wallet";

export default function ProtocolNotice() {
  const { networkLabel } = useWallet();

  return (
    <section className="border-b border-overlay/10 bg-overlay/[0.03]">
      <div className="mx-auto max-w-7xl space-y-3 px-4 py-4 sm:px-6 lg:px-8">
        {HAS_FRONTEND_ENV_FALLBACKS && (
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.08] px-4 py-3 text-sm text-amber-800 dark:text-amber-100">
            <p className="font-semibold text-amber-800 dark:text-amber-200">Deployment setup incomplete</p>
            <p className="mt-1">
              This frontend is using example fallback values because these Vercel env vars are still missing:
              {" "}
              <span className="font-mono text-xs text-amber-800 dark:text-amber-200">{FRONTEND_ENV_WARNING.join(", ")}</span>.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-700 dark:text-orange-300">{networkLabel}</p>
            <p className="mt-1 text-sm text-ink-200">
              VaultCircle is a group savings and treasury coordination protocol where members pool
              sBTC, approve withdrawals by vote, and can optionally deploy idle funds into Zest.
            </p>
          </div>
          <p className="text-xs text-ink-400">
            Use testnet wallets and testnet assets only while exploring the protocol.
          </p>
        </div>
      </div>
    </section>
  );
}
