"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const DOC_SECTIONS = [
  {
    heading: "Start here",
    links: [
      { href: "/docs", label: "What is VaultCircle?" },
      { href: "/docs/getting-started", label: "Getting started" }
    ]
  },
  {
    heading: "Using the protocol",
    links: [
      { href: "/docs/how-it-works", label: "How vaults work" },
      { href: "/docs/proposals", label: "Proposals, explained" },
      { href: "/docs/yield", label: "Zest yield" }
    ]
  },
  {
    heading: "Reference",
    links: [
      { href: "/docs/glossary", label: "Glossary" },
      { href: "/docs/faq", label: "FAQ" }
    ]
  }
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="page-wrap">
      <div className="grid gap-8 lg:grid-cols-[240px_1fr] lg:items-start">
        <nav
          aria-label="Documentation"
          className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
        >
          <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
            {DOC_SECTIONS.flatMap((section) => section.links).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
                  pathname === link.href
                    ? "border-orange-400/30 bg-orange-400/10 text-orange-800 dark:text-orange-200"
                    : "border-overlay/10 bg-overlay/[0.03] text-ink-400 hover:text-ink-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden space-y-6 lg:block">
            {DOC_SECTIONS.map((section) => (
              <div key={section.heading}>
                <p className="stat-label">{section.heading}</p>
                <div className="mt-3 flex flex-col gap-1">
                  {section.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                        pathname === link.href
                          ? "bg-orange-400/10 text-orange-800 dark:text-orange-200"
                          : "text-ink-400 hover:bg-overlay/[0.04] hover:text-ink-50"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-8 pb-16">{children}</div>
      </div>
    </div>
  );
}
