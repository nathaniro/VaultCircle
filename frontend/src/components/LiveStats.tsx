"use client";

import { useEffect, useState } from "react";
import { getProtocolOverview, type ProtocolOverview } from "@/lib/stacks";
import { useCountUp } from "@/lib/use-count-up";
import { useInView } from "@/lib/use-in-view";

export default function LiveStats() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [overview, setOverview] = useState<ProtocolOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProtocolOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setOverview({ totalVaults: 0, activeVaults: 0, totalTrackedValue: 0, yieldEnabledVaults: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = inView && overview !== null;
  // Tracked value displayed to 4 decimals of sBTC; animate the underlying integer
  // (value * 10,000) so the count-up eases smoothly instead of jumping per-satoshi.
  const trackedUnits = overview ? Math.round((overview.totalTrackedValue / 1e8) * 1e4) : 0;

  const totalVaults = useCountUp(overview?.totalVaults ?? 0, ready);
  const activeVaults = useCountUp(overview?.activeVaults ?? 0, ready);
  const trackedDisplay = useCountUp(trackedUnits, ready);

  return (
    <div ref={ref} className="grid gap-4 sm:grid-cols-3">
      <div className="relative">
        <div className="surface-card">
          <p className="stat-label">Vaults created</p>
          <p className="stat-value">{totalVaults.toLocaleString()}</p>
          <p className="mt-2 text-sm text-ink-400">Across the whole protocol</p>
        </div>
        {!overview && <div className="skeleton absolute inset-0 rounded-[28px]" />}
      </div>

      <div className="relative">
        <div className="surface-card">
          <p className="stat-label">Active vaults</p>
          <p className="stat-value">{activeVaults.toLocaleString()}</p>
          <p className="mt-2 text-sm text-ink-400">Still open for deposits and votes</p>
        </div>
        {!overview && <div className="skeleton absolute inset-0 rounded-[28px]" />}
      </div>

      <div className="relative">
        <div className="surface-card">
          <p className="stat-label">Tracked treasury value</p>
          <p className="stat-value">{(trackedDisplay / 1e4).toFixed(4)} sBTC</p>
          <p className="mt-2 text-sm text-ink-400">
            {overview
              ? `${overview.yieldEnabledVaults} vault${overview.yieldEnabledVaults === 1 ? "" : "s"} with yield enabled`
              : "Loading protocol totals"}
          </p>
        </div>
        {!overview && <div className="skeleton absolute inset-0 rounded-[28px]" />}
      </div>
    </div>
  );
}
