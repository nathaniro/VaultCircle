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
        <div className="max-w-3xl">
          {backHref && (
            <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-gray-400 transition hover:text-white">
              <span aria-hidden="true">←</span>
              <span>{backLabel}</span>
            </Link>
          )}
          {eyebrow && <p className="eyebrow mt-5">{eyebrow}</p>}
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">{description}</p>
          {meta && <div className="mt-5">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </section>
  );
}
