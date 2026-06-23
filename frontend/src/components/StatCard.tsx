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
      <p className={`stat-value ${accent ? "text-amber-300" : "text-white"}`}>{value}</p>
      {sub && <p className="mt-2 text-sm leading-6 text-slate-400">{sub}</p>}
    </div>
  );
}
