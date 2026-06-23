import type { ReactNode } from "react";

type InfoTone = "default" | "brand" | "success" | "warning" | "danger";

const toneClasses: Record<InfoTone, string> = {
  default: "border-white/10 bg-white/[0.03] text-slate-200",
  brand: "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-50",
  success: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-50",
  warning: "border-amber-400/25 bg-amber-400/[0.1] text-amber-50",
  danger: "border-rose-400/25 bg-rose-400/[0.1] text-rose-50"
};

interface InfoCardProps {
  title: string;
  description: ReactNode;
  tone?: InfoTone;
}

export default function InfoCard({ title, description, tone = "default" }: InfoCardProps) {
  return (
    <div className={`rounded-2xl border p-5 shadow-[0_12px_40px_rgba(2,6,23,0.22)] ${toneClasses[tone]}`}>
      <p className="text-sm font-semibold tracking-wide">{title}</p>
      <div className="mt-2 text-sm leading-6 opacity-90">{description}</div>
    </div>
  );
}
