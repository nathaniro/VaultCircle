"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import InfoCard from "@/components/InfoCard";
import PageHeader from "@/components/PageHeader";
import StepIndicator from "@/components/StepIndicator";
import TxStatus from "@/components/TxStatus";
import { DEFAULT_PROPOSAL_DURATION, PROTOCOL } from "@/lib/contracts";
import { getVault } from "@/lib/stacks";
import { txCreateProposal } from "@/lib/transactions";
import { formatAppError, isValidStacksAddress, normalizeUint } from "@/lib/validation";
import { useWallet } from "@/lib/wallet";
import { PROPOSAL_TYPE_IDS, PROPOSAL_TYPE_LABELS, sBTCToSats, satsTosBTC, type ProposalType } from "@/types";
import type { Vault } from "@/types";

const MVP_PROPOSAL_TYPES: ProposalType[] = [
  "WITHDRAW_SINGLE",
  "WITHDRAW_BY_SHARE",
  "DEPOSIT_TO_ZEST",
  "WITHDRAW_FROM_ZEST",
  "ADD_MEMBER",
  "REMOVE_MEMBER",
  "CHANGE_THRESHOLD",
  "CLOSE_VAULT"
];

const LABELS: Record<ProposalType, string> = {
  WITHDRAW_SINGLE: "Send a specific amount of sBTC to one recipient",
  WITHDRAW_BY_SHARE: "Distribute sBTC across members using contribution share",
  ADD_MEMBER: "Add a new vault member to future treasury decisions",
  REMOVE_MEMBER: "Remove an existing member from future treasury decisions",
  CHANGE_THRESHOLD: "Change how much approval the vault needs to pass actions",
  ENABLE_YIELD: "Enable future Zest allocations",
  DISABLE_YIELD: "Disable future Zest allocations",
  DEPOSIT_TO_ZEST: "Allocate part of the treasury into Zest",
  WITHDRAW_FROM_ZEST: "Bring Zest capital back into the vault",
  CHANGE_BENEFICIARY: "Change the default beneficiary address",
  CLOSE_VAULT: "Close the vault and distribute the remaining treasury"
};

export default function CreateProposalPage() {
  const { id } = useParams<{ id: string }>();
  const vaultId = normalizeUint(id);
  const { connected, address, connect, selectedWalletName } = useWallet();
  const router = useRouter();

  const [vault, setVault] = useState<Vault | null>(null);
  const [proposalType, setProposalType] = useState<ProposalType>("WITHDRAW_SINGLE");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<number>(DEFAULT_PROPOSAL_DURATION);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadVault() {
      setLoading(true);
      setPageError("");

      if (vaultId === null) {
        setVault(null);
        setPageError("We could not load this proposal form because the vault ID in the URL is invalid.");
        setLoading(false);
        return;
      }

      try {
        const currentVault = await getVault(vaultId, { skipZest: true });
        if (cancelled) return;
        setVault(currentVault);
        if (!currentVault) {
          setPageError("The vault could not be found on the selected Stacks Testnet deployment.");
        }
      } catch (error) {
        if (cancelled) return;
        setVault(null);
        setPageError(formatAppError(error, "We could not load the vault needed to prepare this proposal."));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadVault();
    return () => {
      cancelled = true;
    };
  }, [vaultId]);

  const needsAmount = [
    "WITHDRAW_SINGLE",
    "WITHDRAW_BY_SHARE",
    "DEPOSIT_TO_ZEST",
    "WITHDRAW_FROM_ZEST",
    "CHANGE_THRESHOLD"
  ].includes(proposalType);

  const needsRecipient = ["WITHDRAW_SINGLE", "ADD_MEMBER", "REMOVE_MEMBER", "CHANGE_BENEFICIARY"].includes(proposalType);
  const isThresholdProposal = proposalType === "CHANGE_THRESHOLD";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (vaultId === null) {
      setFormError("This proposal link is invalid. Return to your vault dashboard and reopen the proposal flow.");
      return;
    }

    if (!connected || !address) {
      connect();
      return;
    }

    let amountValue = 0;
    if (needsAmount) {
      amountValue = isThresholdProposal ? Number(amount) : sBTCToSats(amount);
      if (Number.isNaN(amountValue) || amountValue <= 0) {
        setFormError("Enter a valid amount or threshold value before creating the proposal.");
        return;
      }
    }

    if (isThresholdProposal && (amountValue < PROTOCOL.minThreshold || amountValue > PROTOCOL.maxThreshold)) {
      setFormError(`Threshold proposals must stay between ${PROTOCOL.minThreshold}% and ${PROTOCOL.maxThreshold}%.`);
      return;
    }

    if (needsRecipient && !recipient.trim()) {
      setFormError("Enter the member or recipient address this proposal should target.");
      return;
    }

    if (needsRecipient && recipient.trim() && !isValidStacksAddress(recipient.trim())) {
      setFormError("Recipient address must be a valid Stacks Testnet address.");
      return;
    }

    if (!reason.trim()) {
      setFormError("Add a reason so every member understands why this proposal should be approved.");
      return;
    }

    setSubmitting(true);
    try {
      await txCreateProposal(
        vaultId,
        PROPOSAL_TYPE_IDS[proposalType],
        amountValue,
        needsRecipient && recipient.trim() ? recipient.trim() : null,
        reason.trim(),
        duration,
        () => {
          router.push(`/vault/${vaultId}/proposals?created=1`);
        },
        () => {
          setFormError("The wallet request was cancelled before the proposal was submitted.");
          setSubmitting(false);
        }
      );
    } catch (error) {
      setFormError(formatAppError(error, "The proposal could not be submitted. Review the details and try again."));
      setSubmitting(false);
    }
  }

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
          title="Proposal form unavailable"
          description={pageError || "The vault could not be loaded for this route, so the proposal flow cannot continue."}
          actionHref="/vaults"
          actionLabel="Back to Vault Dashboard"
        />
      </div>
    );
  }

  const amountPreview =
    amount && needsAmount
      ? isThresholdProposal
        ? `${amount}% threshold`
        : `${amount} sBTC (${Number.isNaN(sBTCToSats(amount)) ? 0 : sBTCToSats(amount).toLocaleString()} sats)`
      : "No amount entered yet";

  return (
    <div className="page-wrap space-y-8">
      <PageHeader
        eyebrow="Proposal Builder"
        title={`Create a proposal for ${vault.name}`}
        description="Draft the exact treasury action members should vote on, review the impact, then sign a proposal creation transaction with your connected wallet."
        backHref={`/vault/${vaultId}/proposals`}
        backLabel="Back to proposals"
        meta={
          <div className="flex flex-wrap gap-3 text-sm text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              Current vault threshold {vault.thresholdPercent}%
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              Wallet role: proposer
            </span>
          </div>
        }
      />

      <StepIndicator
        currentStep={2}
        steps={[
          {
            title: "Choose the action type",
            description: "Select the exact treasury or governance action the group should review."
          },
          {
            title: "Define the payload",
            description: "Set the amount, recipient, duration, and reason that members will vote on."
          },
          {
            title: "Sign the proposal transaction",
            description: "Your wallet submits the proposal on-chain so other members can approve or reject it."
          }
        ]}
      />

      <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
        <form onSubmit={handleSubmit} className="surface-card space-y-6">
          <div>
            <label className="label">Proposal type</label>
            <select
              className="select"
              value={proposalType}
              onChange={(e) => {
                setProposalType(e.target.value as ProposalType);
                setAmount("");
                setRecipient("");
              }}
            >
              {MVP_PROPOSAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PROPOSAL_TYPE_LABELS[PROPOSAL_TYPE_IDS[type]]}
                </option>
              ))}
            </select>
            <p className="helper-text">{LABELS[proposalType]}</p>
          </div>

          {needsAmount && (
            <div>
              <label className="label">{isThresholdProposal ? "New threshold (%)" : "Amount (sBTC)"}</label>
              <input
                className="input"
                type="number"
                step={isThresholdProposal ? "1" : "0.00000001"}
                min={isThresholdProposal ? PROTOCOL.minThreshold : "0.00000001"}
                max={isThresholdProposal ? PROTOCOL.maxThreshold : undefined}
                placeholder={isThresholdProposal ? "70" : "0.10000000"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              {proposalType === "DEPOSIT_TO_ZEST" && (
                <p className="helper-text">
                  VaultCircle caps Zest allocation to {PROTOCOL.maxZestAllocationPct}% of total treasury value. Current approximate cap:{" "}
                  {satsTosBTC(Math.floor((vault.totalVaultValue || vault.liquidBalance) * 0.7))} sBTC.
                </p>
              )}
            </div>
          )}

          {needsRecipient && (
            <div>
              <label className="label">
                {proposalType === "ADD_MEMBER" || proposalType === "REMOVE_MEMBER"
                  ? "Member address"
                  : proposalType === "CHANGE_BENEFICIARY"
                    ? "New beneficiary address"
                    : "Recipient address"}
              </label>
              <input
                className="input"
                placeholder="ST... testnet address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required={["WITHDRAW_SINGLE", "ADD_MEMBER", "REMOVE_MEMBER"].includes(proposalType)}
              />
            </div>
          )}

          <div>
            <label className="label">Reason for members</label>
            <textarea
              className="textarea"
              placeholder="Explain why this action is needed and what outcome the group should expect."
              maxLength={256}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <p className="mt-2 text-right text-sm text-slate-500">{reason.length}/256</p>
          </div>

          <div>
            <label className="label">
              Voting duration: {duration} blocks (~{((duration * 10) / 1440).toFixed(1)} days)
            </label>
            <input
              type="range"
              min={144}
              max={4320}
              step={144}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full accent-cyan-400"
            />
            <p className="helper-text">
              A longer duration gives members more time to review and vote before the proposal expires.
            </p>
          </div>

          {proposalType === "CLOSE_VAULT" && (
            <div className="notice-danger">
              <strong>Warning:</strong> Closing a vault is irreversible. The contract will settle the vault, distribute funds by contribution share, and prevent future treasury operations.
            </div>
          )}

          {proposalType === "DEPOSIT_TO_ZEST" && (
            <div className="notice-brand">
              <strong>Reward Model A:</strong> Any Zest yield belongs to the vault balance as a whole. Members benefit later through group distributions, not through private yield claims.
            </div>
          )}

          {formError && <TxStatus state="error" title="Proposal not submitted" description={formError} />}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Awaiting wallet confirmation..." : "Create Proposal"}
          </button>
          <p className="text-center text-sm text-slate-500">
            When you submit, {selectedWalletName ?? "your wallet"} will sign the proposal creation request exactly as shown above.
          </p>
        </form>

        <div className="space-y-6">
          <InfoCard
            title="Transaction preview"
            tone="brand"
            description={
              <>
                <p>Action type: <strong className="text-white">{PROPOSAL_TYPE_LABELS[PROPOSAL_TYPE_IDS[proposalType]]}</strong></p>
                <p className="mt-2">Amount or threshold: <strong className="text-white">{amountPreview}</strong></p>
                <p className="mt-2">Target address: <strong className="text-white">{recipient || "No address needed yet"}</strong></p>
                <p className="mt-2">Voting window: <strong className="text-white">{duration} blocks</strong></p>
              </>
            }
          />

          <InfoCard
            title="What members see next"
            description="After submission, the proposal appears in the vault's proposal list. Members can review the reason, approve or reject it, and execute it after the threshold is reached."
          />
        </div>
      </div>
    </div>
  );
}
