"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import ActionPanel from "@/components/ActionPanel";
import EmptyState from "@/components/EmptyState";
import InfoCard from "@/components/InfoCard";
import PageHeader from "@/components/PageHeader";
import ProposalBadge from "@/components/ProposalBadge";
import StatCard from "@/components/StatCard";
import TxStatus from "@/components/TxStatus";
import VaultMembershipBadge from "@/components/VaultMembershipBadge";
import { clearPendingVaultCreation } from "@/lib/pending-vault";
import { useVaultMembership } from "@/lib/use-vault-membership";
import { useWallet } from "@/lib/wallet";
import { getProposal, getRequiredApprovals, getVault, getVaultProposals } from "@/lib/stacks";
import { txSyncZestYield } from "@/lib/transactions";
import { formatAppError, normalizeUint } from "@/lib/validation";
import type { Proposal, Vault } from "@/types";
import { PROPOSAL_TYPE_LABELS, satsTosBTC } from "@/types";

export default function VaultDashboard() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const vaultId = normalizeUint(id);
  const { address, connected, connect } = useWallet();
  const createdFlow = searchParams.get("created") === "1";
  const createdTxId = searchParams.get("txId") || undefined;
  const { isMember } = useVaultMembership(vaultId, address);

  const [vault, setVault] = useState<Vault | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [requiredApprovals, setRequiredApprovals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [syncFeedback, setSyncFeedback] = useState<{ state: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setPageError("");

      if (vaultId === null) {
        setVault(null);
        setProposals([]);
        setRequiredApprovals(0);
        setPageError("We could not load this vault because the vault ID in the URL is invalid.");
        setLoading(false);
        return;
      }

      try {
        const currentVault = await getVault(vaultId);
        if (cancelled) return;

        setVault(currentVault);

        if (currentVault) {
          const [approvals, proposalIds] = await Promise.all([getRequiredApprovals(vaultId), getVaultProposals(vaultId)]);
          if (cancelled) return;
          setRequiredApprovals(approvals);

          const recentProposals = await Promise.all(proposalIds.slice(-5).map((proposalId) => getProposal(proposalId)));
          if (cancelled) return;
          setProposals((recentProposals.filter((proposal): proposal is Proposal => proposal !== null)).reverse());
        } else {
          setProposals([]);
          setRequiredApprovals(0);
          setPageError("The vault could not be found on the selected Stacks Testnet deployment.");
        }
      } catch (error) {
        if (cancelled) return;
        setVault(null);
        setProposals([]);
        setRequiredApprovals(0);
        setPageError(formatAppError(error, "We could not load the vault dashboard right now."));
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
  }, [vaultId]);

  useEffect(() => {
    if (!createdFlow || !createdTxId) return;
    clearPendingVaultCreation(createdTxId);
  }, [createdFlow, createdTxId]);

  async function handleSync() {
    if (!vault || vaultId === null) return;
    if (!connected || !address) {
      connect();
      return;
    }
    if (!isMember) {
      setSyncFeedback({
        state: "error",
        message: "Only active vault members can submit a Zest sync transaction for this treasury."
      });
      return;
    }

    setSyncing(true);
    setSyncFeedback(null);
    try {
      await txSyncZestYield(
        vaultId,
        async () => {
          const currentVault = await getVault(vaultId);
          setVault(currentVault);

          if (currentVault) {
            const approvals = await getRequiredApprovals(vaultId);
            setRequiredApprovals(approvals);

            const proposalIds = await getVaultProposals(vaultId);
            const recentProposals = await Promise.all(proposalIds.slice(-5).map((proposalId) => getProposal(proposalId)));
            setProposals((recentProposals.filter((proposal): proposal is Proposal => proposal !== null)).reverse());
          }

          setLoading(false);
          setSyncing(false);
          setSyncFeedback({
            state: "success",
            message: "The sync transaction was submitted. Updated treasury values will appear after the network confirms it."
          });
        },
        () => {
          setSyncing(false);
          setSyncFeedback({
            state: "error",
            message: "The wallet request was cancelled before the sync transaction was submitted."
          });
        }
      );
    } catch (error) {
      setSyncing(false);
      setSyncFeedback({
        state: "error",
        message: formatAppError(error, "The sync transaction could not be prepared for this vault.")
      });
    }
  }

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="grid gap-6 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="surface-card h-40">
              <div className="skeleton-line-sm w-24" />
              <div className="mt-4 skeleton-line w-32" />
              <div className="mt-3 skeleton-line-sm w-4/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="page-wrap">
        <EmptyState
          title={vaultId === null ? "Vault route is invalid" : `Vault #${vaultId} was not found`}
          description={pageError || "The vault may not exist on this testnet deployment yet, or the route may point to a different vault id than the one that was created."}
          actionHref="/vaults"
          actionLabel="Back to Vault Dashboard"
        />
      </div>
    );
  }

  const yieldEarned = vault.yieldEarned || 0;
  const zestPosition = vault.zestPositionValue || 0;
  const totalValue = vault.totalVaultValue || vault.liquidBalance;
  const vaultIsActive = vault.status === "ACTIVE";

  return (
    <div className="page-wrap space-y-8">
      <PageHeader
        eyebrow={`Vault #${vaultId}`}
        title={vault.name}
        description="This page shows the treasury status, the current decision-making threshold, and the next actions members can take."
        backHref="/vaults"
        backLabel="Back to all vaults"
        actions={
          !connected ? (
            <button type="button" onClick={() => connect()} className="btn-primary">
              Connect Wallet
            </button>
          ) : isMember && vaultIsActive ? (
            <>
              <Link href={`/vault/${vaultId}/deposit`} className="btn-primary">
                Deposit sBTC
              </Link>
              <Link href={`/vault/${vaultId}/create-proposal`} className="btn-secondary">
                New Proposal
              </Link>
            </>
          ) : (
            <>
              <Link href={`/vault/${vaultId}/proposals`} className="btn-primary">
                Review Proposals
              </Link>
              <Link href={`/vault/${vaultId}/members`} className="btn-secondary">
                View Members
              </Link>
            </>
          )
        }
        meta={
          <div className="flex flex-wrap gap-3 text-sm text-slate-400">
            {isMember && <VaultMembershipBadge creator={vault.creator === address} />}
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              Creator {vault.creator.slice(0, 12)}...
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              {requiredApprovals} of {vault.memberCount} approvals required
            </span>
            <span className={vault.status === "ACTIVE" ? "badge-active" : "badge-executed"}>{vault.status}</span>
          </div>
        }
      />

      {syncFeedback && (
        <TxStatus
          state={syncFeedback.state}
          title={syncFeedback.state === "success" ? "Sync submitted" : "Sync not submitted"}
          description={syncFeedback.message}
        />
      )}

      {!connected && (
        <TxStatus
          state="pending"
          title="Connect a wallet to take member actions"
          description="You can inspect treasury state in read-only mode, but deposits, proposal creation, voting, execution, and sync actions unlock only after connecting an active member wallet."
        />
      )}

      {connected && !isMember && (
        <TxStatus
          state="error"
          title="Read-only wallet access"
          description="This wallet is not an active member of the vault. It can review treasury activity, but member-only actions stay locked."
        />
      )}

      {vault.status !== "ACTIVE" && (
        <TxStatus
          state="error"
          title="Vault archived"
          description="This vault is closed. Deposits, proposal creation, voting, execution, and yield sync are now deactivated, while the page remains available as an archive."
        />
      )}

      {createdFlow && (
        <TxStatus
          state="success"
          title="Vault created successfully"
          description="Your new treasury is live on Stacks Testnet. The next standard flow is to make the first deposit, review member access, and start proposals from this vault workspace."
          txId={createdTxId}
          actionHref={`/vault/${vaultId}/deposit`}
          actionLabel="Make First Deposit"
          statusLabel="Vault Live"
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total vault value" value={`${satsTosBTC(totalValue)} sBTC`} sub="Liquid funds plus any Zest position value" accent />
        <StatCard label="Liquid balance" value={`${satsTosBTC(vault.liquidBalance)} sBTC`} sub="Funds immediately held inside the vault contract" />
        <StatCard label="Zest position" value={`${satsTosBTC(zestPosition)} sBTC`} sub={`Principal deposited ${satsTosBTC(vault.zestAllocated)} sBTC`} />
        <StatCard label="Yield earned" value={`${satsTosBTC(yieldEarned)} sBTC`} sub="Yield remains part of the group treasury" accent={yieldEarned > 0} />
        <StatCard label="Member count" value={String(vault.memberCount)} sub={`${requiredApprovals} member approvals needed`} />
        <StatCard label="Total contributed" value={`${satsTosBTC(vault.totalContributed)} sBTC`} sub="Combined member deposits tracked by the vault" />
        <StatCard label="Yield mode" value={vault.yieldEnabled ? "Enabled" : "Disabled"} sub="Members control this path by proposal and vote" />
        <StatCard label="Vault status" value={vault.status} sub="Closed vaults can no longer accept new operations" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ActionPanel
          title="What members can do next"
          description="Members usually follow this sequence: deposit into the vault, create a proposal for a treasury action, collect enough approvals, then execute the passed proposal."
          actions={
            <>
              <Link href={`/vault/${vaultId}/proposals`} className="btn-secondary">
                Review proposals
              </Link>
              <Link href={`/vault/${vaultId}/members`} className="btn-secondary">
                View members
              </Link>
              <Link href={`/vault/${vaultId}/zest`} className="btn-secondary">
                Open yield page
              </Link>
            </>
          }
        />

        <InfoCard
          title="Connected wallet role on this page"
          tone="brand"
          description={
            !vaultIsActive
              ? "This vault is in archive mode. Treasury actions are deactivated, and the workspace now serves as a read-only record of balances, members, and proposal history."
              : isMember
              ? "Your wallet is recognized as a vault member signer. It can deposit funds, create proposals, vote on open decisions, and execute passed proposals once the threshold is met."
              : connected
                ? "This wallet is currently in read-only mode for the vault. Connect with an active member address to unlock deposits, proposal creation, voting, execution, and sync actions."
                : "Connect a member wallet to unlock deposits, proposal creation, voting, execution, and treasury sync actions from this workspace."
          }
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Latest Governance Activity</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Recent proposals</h2>
          </div>
          <Link href={`/vault/${vaultId}/proposals`} className="btn-secondary">
            View all proposals
          </Link>
        </div>

        {proposals.length === 0 ? (
          <EmptyState
            title="No proposals have been created yet"
            description="Once members want to withdraw, add participants, change the threshold, or move funds into Zest, they will create a proposal here for the group to review and vote on."
            actionHref={vaultIsActive ? `/vault/${vaultId}/create-proposal` : `/vault/${vaultId}/members`}
            actionLabel={vaultIsActive ? "Create the First Proposal" : "Review Vault Members"}
          />
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <Link
                key={proposal.proposalId}
                href={`/vault/${vaultId}/proposals`}
                className="surface-card surface-card-interactive block animate-fade-up"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold text-white">
                        Proposal #{proposal.proposalId}: {PROPOSAL_TYPE_LABELS[proposal.proposalType] || "Unknown action"}
                      </p>
                      <ProposalBadge status={proposal.status} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{proposal.reason}</p>
                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-400">
                      {proposal.amount > 0 && (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                          Amount {satsTosBTC(proposal.amount)} sBTC
                        </span>
                      )}
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                        {proposal.approvals} approval{proposal.approvals !== 1 ? "s" : ""} / {proposal.rejections} rejection{proposal.rejections !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        <span>Approval progress</span>
                        <span>{Math.min(100, Math.round((proposal.approvals / Math.max(requiredApprovals, 1)) * 100))}%</span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill transition-all duration-500"
                          style={{ width: `${Math.min(100, (proposal.approvals / Math.max(requiredApprovals, 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">Expires at block {proposal.expiresAt}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {vault.yieldEnabled && zestPosition > 0 && vaultIsActive && (
        <ActionPanel
          title="Refresh Zest position values"
          description="If yield has accrued since the last update, submit a sync transaction so the treasury value shown in the dashboard reflects the latest on-chain position."
          actions={
            !connected ? (
              <button type="button" onClick={() => connect()} className="btn-secondary">
                Connect to Sync
              </button>
            ) : isMember ? (
              <button onClick={handleSync} disabled={syncing} className="btn-secondary">
                {syncing ? "Syncing position..." : "Sync Yield"}
              </button>
            ) : (
              <button type="button" disabled className="btn-secondary opacity-60">
                Members Only
              </button>
            )
          }
        />
      )}
    </div>
  );
}
