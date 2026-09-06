"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const tabs = [
  { key: "overview", label: "Overview", href: (id: string) => `/vault/${id}` },
  { key: "deposit", label: "Deposit", href: (id: string) => `/vault/${id}/deposit` },
  { key: "proposals", label: "Proposals", href: (id: string) => `/vault/${id}/proposals` },
  { key: "members", label: "Members", href: (id: string) => `/vault/${id}/members` },
  { key: "zest", label: "Yield", href: (id: string) => `/vault/${id}/zest` }
];

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();

  return (
    <>
      <div className="border-b border-overlay/10 bg-overlay/[0.03]">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-4 sm:px-6 lg:px-8">
          {tabs.map((tab) => {
            const href = tab.href(id);
            const active = pathname === href;
            return (
              <Link
                key={tab.key}
                href={href}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-orange-400/10 text-orange-800 dark:text-orange-200 border border-orange-400/20"
                    : "border border-transparent text-ink-400 hover:border-overlay/10 hover:bg-overlay/[0.04] hover:text-ink-50"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </>
  );
}
