"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[VaultCircle][GlobalError]", error);
  }, [error]);

  return (
    <div className="page-wrap flex min-h-[70vh] items-center justify-center">
      <div className="surface-card flex max-w-xl flex-col items-center px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10 text-xl text-rose-700 dark:text-rose-300">
          !
        </div>
        <p className="eyebrow mt-5 text-rose-700 dark:text-rose-300">Unexpected Error</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink-50">Something went wrong on this page</h1>
        <p className="mt-3 text-sm leading-6 text-ink-400">
          This did not affect any on-chain state or your wallet connection. Try again, or head back to the vault dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary">
            Try Again
          </button>
          <a href="/vaults" className="btn-secondary">
            Back to Vault Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
