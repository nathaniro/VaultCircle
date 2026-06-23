import type { ReactNode } from "react";

interface ActionPanelProps {
  title: string;
  description: string;
  actions?: ReactNode;
  footer?: ReactNode;
}

export default function ActionPanel({ title, description, actions, footer }: ActionPanelProps) {
  return (
    <div className="surface-card">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
      {footer && <div className="mt-5 border-t border-white/10 pt-5">{footer}</div>}
    </div>
  );
}
