import Link from "next/link";

interface DocsPagerProps {
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}

export default function DocsPager({ prev, next }: DocsPagerProps) {
  if (!prev && !next) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-overlay/10 pt-6 sm:flex-row sm:items-stretch sm:justify-between">
      {prev ? (
        <Link
          href={prev.href}
          className="group flex flex-col rounded-2xl border border-overlay/10 px-4 py-3 text-left transition hover:border-orange-400/25 hover:bg-overlay/[0.03] sm:border-0 sm:px-0 sm:py-0 sm:hover:bg-transparent"
        >
          <span className="text-xs uppercase tracking-[0.18em] text-ink-500">Previous</span>
          <span className="mt-1 text-sm font-semibold text-ink-200 transition group-hover:text-orange-700 dark:group-hover:text-orange-300">
            &larr; {prev.label}
          </span>
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group flex flex-col rounded-2xl border border-overlay/10 px-4 py-3 text-left transition hover:border-orange-400/25 hover:bg-overlay/[0.03] sm:border-0 sm:px-0 sm:py-0 sm:text-right sm:hover:bg-transparent"
        >
          <span className="text-xs uppercase tracking-[0.18em] text-ink-500">Next</span>
          <span className="mt-1 text-sm font-semibold text-ink-200 transition group-hover:text-orange-700 dark:group-hover:text-orange-300">
            {next.label} &rarr;
          </span>
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}
    </div>
  );
}
