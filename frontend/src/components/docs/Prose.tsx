import type { ReactNode } from "react";

export function Section({ children }: { children: ReactNode }) {
  return <section className="surface-card space-y-4">{children}</section>;
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-2xl font-semibold tracking-tight text-ink-50">{children}</h2>;
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="text-lg font-semibold text-ink-50">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-7 text-ink-300">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="space-y-2 text-sm leading-7 text-ink-300">{children}</ul>;
}

export function LI({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
      <span>{children}</span>
    </li>
  );
}

export function OL({ children }: { children: ReactNode }) {
  return <ol className="space-y-5">{children}</ol>;
}

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-400/30 bg-orange-400/10 text-sm font-bold text-orange-700 dark:text-orange-300">
        {n}
      </span>
      <div className="space-y-1.5 pt-0.5">
        <p className="font-semibold text-ink-50">{title}</p>
        <div className="text-sm leading-7 text-ink-300">{children}</div>
      </div>
    </li>
  );
}

export function Term({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="border-t border-overlay/10 py-4 first:border-t-0 first:pt-0">
      <p className="font-semibold text-ink-50">{term}</p>
      <p className="mt-1.5 text-sm leading-7 text-ink-300">{children}</p>
    </div>
  );
}

export function QA({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div className="border-t border-overlay/10 py-5 first:border-t-0 first:pt-0">
      <p className="font-semibold text-ink-50">{q}</p>
      <div className="mt-2 text-sm leading-7 text-ink-300">{children}</div>
    </div>
  );
}
