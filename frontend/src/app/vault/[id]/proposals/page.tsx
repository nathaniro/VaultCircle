"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import InfoCard from "@/components/InfoCard";
import PageHeader from "@/components/PageHeader";
import ProposalBadge from "@/components/ProposalBadge";
import TxStatus from "@/components/TxStatus";
import VaultMembershipBadge from "@/components/VaultMembershipBadge";
import { getProposal, getRequiredApprovals, getVault, getVaultProposals, hasVoted } from "@/lib/stacks";
import { txExecuteProposal, txVote } from "@/lib/transactions";
import { useVaultMembership } from "@/lib/use-vault-membership";
import { formatAppError, normalizeUint } from "@/lib/validation";
import { useWallet } from "@/lib/wallet";
import type { Proposal, ProposalStatus, Vault } from "@/types";
import { PROPOSAL_TYPE_LABELS, satsTosBTC } from "@/types";

interface TxFeedback {
  state: "success" | "error";
  title: string;
  description: string;
  txId?: string;
}

function ProposalsPageContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const vaultId = normalizeUint(id);
  const { address, connected, connect } = useWallet();
  const { isMember } = useVaultMembership(vaultId, address);

  const [vault, setVault] = useState<Vault | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [voted, setVoted] = useState<Record<number, boolean>>({});
  const [required, setRequired] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<number | null>(null);
  const [txFeedback, setTxFeedback] = useState<TxFeedback | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setLoadError("");

      if (vaultId === null) {
        setVault(null);
        setProposals([]);
        setRequired(0);
        setVoted({});
        setLoadError("We could not load these proposals because the vault ID in the URL is invalid.");
        setLoading(false);
        return;
      }

      try {
        const currentVault = await getVault(vaultId, { skipZest: true });
        if (cancelled) return;

        setVault(currentVault);
        if (!currentVault) {
          setProposals([]);
          setRequired(0);
          setVoted({});
          setLoadError("The vault could not be found on the selected Stacks Testnet deployment.");
          setLoading(false);
          return;
        }

        const [approvals, proposalIds] = await Promise.all([getRequiredApprovals(vaultId), getVaultProposals(vaultId)]);
        if (cancelled) return;
        setRequired(approvals);
        const loadedProposals = await Promise.all(proposalIds.map((proposalId) => getProposal(proposalId)));
        const validProposals = loadedProposals.filter((proposal): proposal is Proposal => proposal !== null);
        validProposals.sort((a, b) => b.proposalId - a.proposalId);
        if (cancelled) return;
        setProposals(validProposals);

        if (address) {
          const votedMap: Record<number, boolean> = {};
          await Promise.all(
            validProposals.map(async (proposal) => {
              votedMap[proposal.proposalId] = await hasVoted(proposal.proposalId, address);
            })
          );
          if (cancelled) return;
          setVoted(votedMap);
        } else {
          setVoted({});
        }
      } catch (error) {
        if (cancelled) return;
        setVault(null);
        setProposals([]);
        setRequired(0);
        setVoted({});
        setLoadError(formatAppError(error, "We could not load this vault's proposals right now."));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [vaultId, address]);

  async function handleVote(proposalId: number, approve: boolean) {
    if (vaultId === null) return;
    if (!connected || !address) {
      connect();
      return;
    }
    if (!isMember) {
      setTxFeedback({
        state: "error",
        title: "Vote not submitted",
        description: "Only active vault members can approve or reject proposals for this treasury."
      });
      return;
    }

    setPending(proposalId);
    setTxFeedback(null);

    try {
      await txVote(
        vaultId,
        proposalId,
        approve,
        ({ txId }) => {
          setVoted((prev) => ({ ...prev, [proposalId]: true }));
          setProposals((prev) =>
            prev.map((p) => {
              if (p.proposalId !== proposalId) return p;
              const newApprovals = approve ? p.approvals + 1 : p.approvals;
              const newRejections = approve ? p.rejections : p.rejections + 1;
              const newStatus: ProposalStatus =
                approve && newApprovals >= required ? "PASSED" : p.status;
              return { ...p, approvals: newApprovals, rejections: newRejections, status: newStatus };
            })
          );
          setTxFeedback({
            state: "success",
            title: approve ? "Approval submitted" : "Rejection submitted",
            description: approve
              ? "Your approval was broadcast. Vote counts are updated locally and will be confirmed once the network processes the transaction."
              : "Your rejection was broadcast. Vote counts are updated locally and will be confirmed once the network processes the transaction.",
            txId
          });
          setPending(null);
        },
        () => {
          setTxFeedback({
            state: "error",
            title: "Vote not submitted",
            description: "The wallet request was cancelled before the vote transaction could be broadcast."
          });
          setPending(null);
        }
      );
    } catch (error) {
      setTxFeedback({
        state: "error",
        title: "Vote not submitted",
        description: formatAppError(error, "This vote could not be prepared for the selected vault.")
      });
      setPending(null);
    }
  }

  async function handleExecute(proposalId: number) {
    if (vaultId === null) return;
    if (!connected || !address) {
      connect();
      return;
    }
    if (!isMember) {
      setTxFeedback({
        state: "error",
        title: "Execution not submitted",
        description: "Only active vault members can execute a passed proposal for this treasury."
      });
      return;
    }

    setPending(proposalId);
    setTxFeedback(null);

    try {
      await txExecuteProposal(
        vaultId,
        proposalId,
        ({ txId }) => {
          setProposals((prev) =>
            prev.map((p) =>
              p.proposalId === proposalId
                ? { ...p, status: "EXECUTED" as ProposalStatus, executed: true }
                : p
            )
          );
          setTxFeedback({
            state: "success",
            title: "Execution submitted",
            description: "The execution transaction was broadcast. The proposal is marked executed locally and will finalize once the network confirms it.",
            txId
          });
          setPending(null);
        },
        () => {
          setTxFeedback({
            state: "error",
            title: "Execution not submitted",
            description: "The wallet request was cancelled before the execution transaction could be broadcast."
          });
          setPending(null);
        }
      );
    } catch (error) {
      setTxFeedback({
        state: "error",
        title: "Execution not submitted",
        description: formatAppError(error, "This proposal could not be executed for the selected vault.")
      });
      setPending(null);
    }
  }

  const filterByStatus = (statuses: string[]) => proposals.filter((proposal) => statuses.includes(proposal.status));

  const renderProposal = (proposal: Proposal) => (
    <div key={proposal.proposalId} className="surface-card surface-card-interactive space-y-5 animate-fade-up">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xl font-semibold text-white">
              Proposal #{proposal.proposalId}: {PROPOSAL_TYPE_LABELS[proposal.proposalType] || "Unknown action"}
            </p>
            <ProposalBadge status={proposal.status} />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">{proposal.reason}</p>
        </div>
        <p className="text-sm text-slate-500">Expires at block {proposal.expiresAt}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-card-muted">
          <p className="stat-label">Approvals</p>
          <p className="mt-2 text-xl font-semibold text-emerald-300">{proposal.approvals}</p>
        </div>
        <div className="surface-card-muted">
          <p className="stat-label">Rejections</p>
          <p className="mt-2 text-xl font-semibold text-rose-300">{proposal.rejections}</p>
        </div>
        <div className="surface-card-muted">
          <p className="stat-label">Needed to pass</p>
          <p className="mt-2 text-xl font-semibold text-white">{required}</p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          <span>Approval progress</span>
          <span>{Math.min(100, Math.round((proposal.approvals / Math.max(required, 1)) * 100))}%</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill transition-all duration-500"
            style={{ width: `${Math.min(100, (proposal.approvals / Math.max(required, 1)) * 100)}%` }}
          />
        </div>
      </div>

      {(proposal.amount > 0 || proposal.recipient) && (
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
          {proposal.amount > 0 && <p>Amount involved: <strong className="text-white">{satsTosBTC(proposal.amount)} sBTC</strong></p>}
          {proposal.recipient && <p className="mt-2 break-all">Recipient or target address: <span className="font-mono text-slate-200">{proposal.recipient}</span></p>}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">Created at block {proposal.createdAt}</span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
          {proposal.status === "ACTIVE"
            ? "Next step: gather votes"
            : proposal.status === "PASSED"
              ? "Next step: execute on-chain"
              : proposal.status === "EXECUTED"
                ? "Completed on-chain"
                : "No further action"}
        </span>
      </div>

      {proposal.status === "ACTIVE" && address && isMember && !voted[proposal.proposalId] && (
        <div className="flex flex-col gap-3 md:flex-row">
          <button
            onClick={() => handleVote(proposal.proposalId, true)}
            disabled={pending === proposal.proposalId}
            className="btn-success flex-1"
          >
            {pending === proposal.proposalId ? "Submitting approval..." : "Approve Proposal"}
          </button>
          <button
            onClick={() => handleVote(proposal.proposalId, false)}
            disabled={pending === proposal.proposalId}
            className="btn-danger flex-1"
          >
            {pending === proposal.proposalId ? "Submitting rejection..." : "Reject Proposal"}
          </button>
        </div>
      )}

      {proposal.status === "ACTIVE" && address && !isMember && (
        <InfoCard
          title="Read-only access"
          description="This wallet can monitor proposal progress, but only active vault members can cast votes on open proposals."
        />
      )}

      {proposal.status === "ACTIVE" && voted[proposal.proposalId] && (
        <InfoCard
          title="Vote already recorded"
          description="This wallet has already voted on the proposal. The next step is to wait for the remaining members or review other active proposals."
        />
      )}

      {proposal.status === "PASSED" && !proposal.executed && (
        <InfoCard
          title="Ready for execution"
          tone="success"
          description="This proposal has enough approvals. A member can now submit the execution transaction so the approved vault action happens on-chain."
        />
      )}

      {proposal.status === "PASSED" && !proposal.executed && isMember && (
        <button
          onClick={() => handleExecute(proposal.proposalId)}
          disabled={pending === proposal.proposalId}
          className="btn-primary w-full"
        >
          {pending === proposal.proposalId ? "Submitting execution..." : "Execute Proposal"}
        </button>
      )}

      {proposal.status === "PASSED" && !proposal.executed && address && !isMember && (
        <InfoCard
          title="Execution reserved for members"
          description="This proposal is ready, but only active vault members can submit the execution transaction."
        />
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="surface-card h-96 skeleton" />
      </div>
    );
  }

  if (!vault || vaultId === null) {
    return (
      <div className="page-wrap">
        <EmptyState
          title="Proposal list unavailable"
          description={loadError || "The vault could not be loaded for this route, so proposals cannot be shown right now."}
          actionHref="/vaults"
          actionLabel="Back to Vault Dashboard"
        />
      </div>
    );
  }

  return (
    <div className="page-wrap space-y-8">
      <PageHeader
        eyebrow="Governance Flow"
        title={`Proposals for ${vault.name}`}
        description="Review every requested treasury action, see how many approvals it has, and decide whether the connected wallet should vote or execute."
        backHref={`/vault/${vaultId}`}
        backLabel="Back to vault overview"
        actions={
          !connected ? (
            <button type="button" onClick={() => connect()} className="btn-primary">
              Connect to Propose
            </button>
          ) : isMember ? (
            <Link href={`/vault/${vaultId}/create-proposal`} className="btn-primary">
              Create Proposal
            </Link>
          ) : (
            <button type="button" disabled className="btn-primary opacity-60">
              Members Only
            </button>
          )
        }
        meta={
          <div className="flex flex-wrap gap-3 text-sm text-slate-400">
            {isMember && vault && <VaultMembershipBadge creator={vault.creator === address} />}
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              {required} approval{required !== 1 ? "s" : ""} required to pass
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              Connected wallet role: {isMember ? "voter and potential executor" : connected ? "read-only viewer" : "connect wallet to participate"}
            </span>
          </div>
        }
      />

      {!connected && (
        <TxStatus
          state="pending"
          title="Connect a wallet to participate"
          description="You can review proposal activity without a wallet, but voting, execution, and proposal creation are unlocked only after connecting an active member wallet."
        />
      )}

      {connected && !isMember && (
        <TxStatus
          state="error"
          title="Member action locked"
          description="This wallet can monitor proposal activity, but only active vault members can create, vote on, or execute proposals."
        />
      )}

      {searchParams.get("created") === "1" && (
        <TxStatus
          state="success"
          title="Proposal creation request submitted"
          description="The proposal transaction was broadcast from your wallet. It will appear in the list below after the network confirms it."
        />
      )}

      {txFeedback && (
        <TxStatus
          state={txFeedback.state}
          title={txFeedback.title}
          description={txFeedback.description}
          txId={txFeedback.txId}
        />
      )}

      {proposals.length === 0 && (
        <EmptyState
          title="No proposals yet"
          description="When members want to withdraw, distribute funds, add a new participant, or manage Zest allocation, they create a proposal here for group review."
          actionHref={connected && isMember ? `/vault/${vaultId}/create-proposal` : `/vault/${vaultId}/members`}
          actionLabel={connected && isMember ? "Create the First Proposal" : "Review Vault Members"}
        />
      )}

      {filterByStatus(["ACTIVE"]).length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="eyebrow">Open Decisions</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Active proposals</h2>
          </div>
          <div className="space-y-4">{filterByStatus(["ACTIVE"]).map(renderProposal)}</div>
        </section>
      )}

      {filterByStatus(["PASSED"]).length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="eyebrow">Execution Queue</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Passed proposals</h2>
          </div>
          <div className="space-y-4">{filterByStatus(["PASSED"]).map(renderProposal)}</div>
        </section>
      )}

      {filterByStatus(["EXECUTED"]).length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="eyebrow">Completed</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Executed proposals</h2>
          </div>
          <div className="space-y-4">{filterByStatus(["EXECUTED"]).map(renderProposal)}</div>
        </section>
      )}

      {filterByStatus(["REJECTED", "EXPIRED"]).length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="eyebrow">Closed Without Execution</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Rejected or expired proposals</h2>
          </div>
          <div className="space-y-4">{filterByStatus(["REJECTED", "EXPIRED"]).map(renderProposal)}</div>
        </section>
      )}
    </div>
  );
}

export default function ProposalsPage() {
  return (
    <Suspense
      fallback={
        <div className="page-wrap">
          <div className="surface-card h-96 skeleton" />
        </div>
      }
    >
      <ProposalsPageContent />
    </Suspense>
  );
}
