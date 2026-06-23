"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import { satsTosBTC } from "@/types";

function shortAddr(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const NAV_LINKS = [
  { href: "/vaults", label: "Vault Dashboard" },
  { href: "/create-vault", label: "Create Vault" }
];

export default function Navbar() {
  const pathname = usePathname();
  const { walletReady, connected, address, sbtcBalance, networkLabel, selectedWalletName, connect, disconnect } = useWallet();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-200">
              VC
            </div>
            <div>
              <p className="text-sm font-semibold text-white">VaultCircle</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">sBTC Coordination</p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
              {networkLabel}
            </span>
            {walletReady && connected && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                Acting as member signer
              </span>
            )}
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {walletReady &&
            connected &&
            NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  pathname === link.href
                    ? "bg-white/[0.08] text-white"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
        </div>

        <div className="flex items-center gap-3">
          {!walletReady ? (
            <>
              <div className="hidden h-[70px] w-44 rounded-2xl border border-white/10 bg-white/[0.04] md:block" />
              <div className="h-11 w-32 rounded-full border border-white/10 bg-white/[0.04]" />
            </>
          ) : connected ? (
            <>
              <div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right md:block">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  {selectedWalletName ?? "Stacks Wallet"}
                </p>
                <p className="mt-1 text-sm font-medium text-white">{satsTosBTC(sbtcBalance)} sBTC</p>
                <p className="mt-1 text-xs text-slate-400">{address && shortAddr(address)}</p>
              </div>
              <button onClick={() => connect()} className="btn-secondary hidden sm:inline-flex">
                Switch Wallet
              </button>
              <button onClick={disconnect} className="btn-secondary">
                Disconnect
              </button>
            </>
          ) : (
            <button onClick={() => connect()} className="btn-primary">
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
