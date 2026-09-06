import Link from "next/link";

type TxState = "pending" | "success" | "error";

const toneStyles: Record<TxState, string> = {
  pending: "tone-brand",
  success: "tone-success",
  error: "tone-danger"
};

interface TxStatusProps {
  state: TxState;
  title: string;
  description: string;
  txId?: string;
  actionHref?: string;
  actionLabel?: string;
  statusLabel?: string;
}

export default function TxStatus({ state, title, description, txId, actionHref, actionLabel, statusLabel }: TxStatusProps) {
  const indicatorClass =
    state === "pending" ? "bg-orange-300" : state === "success" ? "bg-emerald-300" : "bg-rose-300";
  const defaultLabel =
    state === "pending"
      ? "Awaiting Confirmation"
      : state === "success"
        ? "Transaction Submitted"
        : "Action Not Completed";

  return (
    <div className={toneStyles[state]}>
      <div className="flex items-center gap-3">
        <span className={`glow-dot ${indicatorClass}`} />
        <p className="text-sm font-semibold uppercase tracking-[0.2em]">{statusLabel || defaultLabel}</p>
      </div>
      <h3 className="mt-3 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 opacity-90">{description}</p>
      {txId && (
        <p className="mt-4 break-all rounded-xl border border-overlay/10 bg-overlay/[0.06] px-4 py-3 font-mono text-xs opacity-90">
          {txId}
        </p>
      )}
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-secondary mt-5 inline-flex">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
