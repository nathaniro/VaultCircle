"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { satsTosBTC } from "@/types";

function shortAddr(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function WalletMenu() {
  const { walletReady, connected, address, sbtcBalance, networkLabel, selectedWalletName, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleCopy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard permission denied or unavailable; ignore silently
    }
  }

  if (!walletReady) {
    return <div className="h-11 w-32 rounded-full border border-overlay/10 bg-overlay/[0.04]" />;
  }

  if (!connected) {
    return (
      <button onClick={() => connect()} className="btn-primary">
        Connect Wallet
      </button>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className="btn-secondary gap-2.5"
      >
        <span className="glow-dot bg-orange-500" aria-hidden="true" />
        <span className="tabular-nums">{satsTosBTC(sbtcBalance)} sBTC</span>
        <span className="hidden font-mono text-xs text-ink-400 sm:inline">{address && shortAddr(address)}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-[24px] border border-overlay/10 bg-ink-950 p-4 shadow-[0_24px_60px_rgba(2,6,23,0.18)] dark:shadow-[0_24px_60px_rgba(2,6,23,0.5)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700 dark:text-orange-300">
            {selectedWalletName ?? "Stacks Wallet"}
          </p>
          <p className="mt-1 text-xs text-ink-500">{networkLabel}</p>

          <div className="mt-3 rounded-2xl border border-overlay/10 bg-overlay/[0.04] px-4 py-3">
            <p className="stat-label">Balance</p>
            <p className="mt-1 text-xl font-semibold text-ink-50 tabular-nums">{satsTosBTC(sbtcBalance)} sBTC</p>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 flex w-full items-center justify-between rounded-2xl border border-overlay/10 bg-overlay/[0.04] px-4 py-3 text-left transition hover:border-overlay/20"
          >
            <span className="truncate font-mono text-xs text-ink-300">{address}</span>
            <span className="ml-3 shrink-0 text-xs font-semibold text-orange-600 dark:text-orange-300">{copied ? "Copied" : "Copy"}</span>
          </button>

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                connect();
              }}
              className="btn-secondary w-full"
            >
              Switch Wallet
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                disconnect();
              }}
              className="btn-secondary w-full text-rose-700 hover:border-rose-400/30 hover:text-rose-800 dark:text-rose-300 dark:hover:text-rose-200"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
