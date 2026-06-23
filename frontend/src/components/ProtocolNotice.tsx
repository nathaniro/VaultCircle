"use client";

import { useWallet } from "@/lib/wallet";

export default function ProtocolNotice() {
  const { networkLabel } = useWallet();

  return (
    <section className="border-b border-white/10 bg-white/[0.03]">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">{networkLabel}</p>
            <p className="mt-1 text-sm text-slate-200">
              VaultCircle is a group savings and treasury coordination protocol where members pool
              sBTC, approve withdrawals by vote, and can optionally deploy idle funds into Zest.
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Use testnet wallets and testnet assets only while exploring the protocol.
          </p>
        </div>
      </div>
    </section>
  );
}
