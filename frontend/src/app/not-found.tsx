import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-wrap flex min-h-[70vh] items-center justify-center">
      <div className="surface-card flex max-w-xl flex-col items-center px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-overlay/10 bg-overlay/[0.03] text-xl text-orange-700 dark:text-orange-300">
          VC
        </div>
        <p className="eyebrow mt-5">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink-50">This page does not exist</h1>
        <p className="mt-3 text-sm leading-6 text-ink-400">
          The route you followed may be out of date, or the vault link may point to an id that has not been created yet.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">
            Back to Home
          </Link>
          <Link href="/vaults" className="btn-secondary">
            Open Vault Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
