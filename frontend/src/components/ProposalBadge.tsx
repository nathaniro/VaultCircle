import type { ProposalStatus } from "@/types";

export default function ProposalBadge({ status }: { status: ProposalStatus }) {
  const map: Record<ProposalStatus, string> = {
    ACTIVE: "badge-active",
    PASSED: "badge-passed",
    EXECUTED: "badge-executed",
    REJECTED: "badge-rejected",
    EXPIRED: "badge-expired"
  };

  return <span className={map[status]}>{status}</span>;
}
