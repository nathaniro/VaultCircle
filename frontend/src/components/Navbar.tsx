"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import WalletMenu from "@/components/WalletMenu";
import { useWallet } from "@/lib/wallet";

const NAV_LINKS = [
  { href: "/vaults", label: "Dashboard" },
  { href: "/create-vault", label: "Create Vault" },
  { href: "/docs", label: "Docs" }
];

export default function Navbar() {
  const pathname = usePathname();
  const { networkLabel } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuClosedForPathname, setMenuClosedForPathname] = useState(pathname);

  if (pathname !== menuClosedForPathname) {
    setMenuClosedForPathname(pathname);
    setMobileMenuOpen(false);
  }

  useEffect(() => {
    if (!mobileMenuOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  function isActive(href: string) {
    return href === "/docs" ? pathname.startsWith("/docs") : pathname === href;
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-overlay/10 bg-ink-950/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 text-sm font-semibold text-orange-800 dark:text-orange-200">
            VC
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-none text-ink-50">VaultCircle</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-ink-500">{networkLabel}</p>
          </div>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive(link.href) ? "bg-overlay/[0.08] text-ink-50" : "text-ink-400 hover:bg-overlay/[0.04] hover:text-ink-50"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <div className="hidden sm:block">
            <WalletMenu />
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            className="btn-secondary h-11 w-11 shrink-0 !px-0 md:hidden"
          >
            <span className="relative flex h-4 w-4 items-center justify-center">
              <span
                className={`absolute h-0.5 w-4 rounded-full bg-current transition ${
                  mobileMenuOpen ? "rotate-45" : "-translate-y-1.5"
                }`}
              />
              <span className={`absolute h-0.5 w-4 rounded-full bg-current transition ${mobileMenuOpen ? "opacity-0" : "opacity-100"}`} />
              <span
                className={`absolute h-0.5 w-4 rounded-full bg-current transition ${
                  mobileMenuOpen ? "-rotate-45" : "translate-y-1.5"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-overlay/10 bg-ink-950/95 backdrop-blur-xl md:hidden">
          <div className="space-y-5 px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive(link.href) ? "bg-overlay/[0.08] text-ink-50" : "text-ink-300 hover:bg-overlay/[0.04] hover:text-ink-50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <WalletMenu />
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
