import Link from "next/link";
import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}

export default function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = "Back",
  actions,
  meta
}: PageHeaderProps) {
  return (
    <section className="page-header">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          {backHref && (
            <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-ink-400 transition hover:text-ink-50">
              <span aria-hidden="true">←</span>
              <span>{backLabel}</span>
            </Link>
          )}
          {eyebrow && <p className="eyebrow mt-5">{eyebrow}</p>}
          <h1 className="mt-3 break-words text-4xl font-semibold tracking-tight text-ink-50 md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-300 md:text-lg">{description}</p>
          {meta && <div className="mt-5">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </section>
  );
}
