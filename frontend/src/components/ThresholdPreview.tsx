"use client";

import { useState } from "react";
import { calcRequiredApprovals } from "@/types";

export default function ThresholdPreview() {
  const [threshold, setThreshold] = useState(70);
  const [memberCount, setMemberCount] = useState(5);
  const required = calcRequiredApprovals(memberCount, threshold);

  return (
    <div className="surface-card overflow-visible">
      <div className="flex items-center justify-between">
        <p className="stat-label">Try it: approval threshold</p>
        <span className="glow-dot bg-orange-500" aria-hidden="true" />
      </div>

      <div className="mt-5 text-center">
        <p className="text-6xl font-bold tracking-tight text-ink-50 tabular-nums">{threshold}%</p>
        <p className="mt-2 text-sm text-ink-400">of members must approve each treasury action</p>
      </div>

      <div className="mt-6 flex items-center justify-center gap-1.5">
        {Array.from({ length: memberCount }).map((_, index) => (
          <span
            key={index}
            className={`h-3.5 w-3.5 rounded-full transition-all duration-300 ${
              index < required ? "scale-110 bg-orange-500 shadow-[0_0_12px_rgb(var(--glow-1)/0.6)]" : "bg-overlay/15"
            }`}
            style={{ transitionDelay: `${index * 30}ms` }}
          />
        ))}
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-orange-700 dark:text-orange-300">
        {required} of {memberCount} member{memberCount !== 1 ? "s" : ""} must approve
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-ink-500">
            <span>Threshold</span>
            <span>51%–100%</span>
          </div>
          <input
            type="range"
            min={51}
            max={100}
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            className="w-full accent-orange-500"
            aria-label="Approval threshold percentage"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-ink-500">
            <span>Members</span>
            <span>2–11</span>
          </div>
          <input
            type="range"
            min={2}
            max={11}
            value={memberCount}
            onChange={(event) => setMemberCount(Number(event.target.value))}
            className="w-full accent-orange-500"
            aria-label="Number of vault members"
          />
        </div>
      </div>

      <p className="mt-5 text-xs leading-5 text-ink-500">
        This is exactly the math VaultCircle enforces on-chain — drag either slider to see how the
        required approval count changes before you create a real vault.
      </p>
    </div>
  );
}
