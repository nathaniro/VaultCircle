interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

export default function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className="surface-card h-full">
      <p className="stat-label">{label}</p>
      <p className={`stat-value ${accent ? "text-amber-700 dark:text-amber-300" : "text-ink-50"}`}>{value}</p>
      {sub && <p className="mt-2 text-sm leading-6 text-ink-400">{sub}</p>}
    </div>
  );
}
