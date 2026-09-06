"use client";

import { useWallet } from "@/lib/wallet";

export default function WalletPickerModal() {
  const { connect, walletOptions, walletPickerOpen, closeWalletPicker, selectedWalletId, connectError } = useWallet();

  if (!walletPickerOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-8">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-[30px] border border-overlay/10 bg-ink-950 shadow-[0_30px_120px_rgba(2,6,23,0.65)]">
        <div className="flex items-start justify-between gap-4 border-b border-overlay/10 px-6 py-6 md:px-8">
          <div className="min-w-0">
            <p className="eyebrow">Wallet Access</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink-50 sm:text-3xl">Choose your Stacks Testnet signer</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-ink-400">
              Pick the wallet that will create vaults, sign deposits, vote on proposals, and execute approved actions.
            </p>
          </div>
          <button
            type="button"
            onClick={closeWalletPicker}
            className="btn-secondary shrink-0 px-4 py-2"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-6 py-6 md:px-8">
          {connectError ? (
            <div className="rounded-[18px] border border-rose-400/30 bg-rose-400/10 px-5 py-4 text-sm leading-6 text-rose-800 dark:text-rose-200">
              {connectError}
            </div>
          ) : null}
          {walletOptions.map((wallet) => {
            const isSelected = selectedWalletId === wallet.id;

            return (
              <div
                key={wallet.id}
                className={`rounded-[24px] border p-5 transition-colors ${
                  isSelected ? "border-orange-400/30 bg-orange-400/[0.08]" : "border-overlay/10 bg-overlay/[0.04]"
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-ink-50">{wallet.name}</h3>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                          wallet.installed
                            ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-800 dark:text-emerald-200"
                            : "border border-amber-400/20 bg-amber-400/10 text-amber-800 dark:text-amber-200"
                        }`}
                      >
                        {wallet.installed ? "Installed" : "Install required"}
                      </span>
                    </div>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-ink-400">{wallet.description}</p>
                  </div>

                  {wallet.installed ? (
                    <button type="button" onClick={() => connect(wallet.id)} className="btn-primary shrink-0 md:min-w-40">
                      {isSelected ? "Continue with wallet" : `Use ${wallet.name}`}
                    </button>
                  ) : (
                    <a
                      href={wallet.installUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary shrink-0 text-center md:min-w-40"
                    >
                      Install {wallet.name}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
