import type { ReactNode } from "react";

type InfoTone = "default" | "brand" | "success" | "warning" | "danger";

const toneClasses: Record<InfoTone, string> = {
  default: "tone-default",
  brand: "tone-brand",
  success: "tone-success",
  warning: "tone-warning",
  danger: "tone-danger"
};

interface InfoCardProps {
  title: string;
  description: ReactNode;
  tone?: InfoTone;
}

export default function InfoCard({ title, description, tone = "default" }: InfoCardProps) {
  return (
    <div className={toneClasses[tone]}>
      <p className="text-sm font-semibold tracking-wide">{title}</p>
      <div className="mt-2 text-sm leading-6 opacity-90">{description}</div>
    </div>
  );
}
