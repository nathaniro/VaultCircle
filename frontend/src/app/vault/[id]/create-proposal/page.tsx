"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import InfoCard from "@/components/InfoCard";
import PageHeader from "@/components/PageHeader";
import StepIndicator from "@/components/StepIndicator";
import TxStatus from "@/components/TxStatus";
import VaultMembershipBadge from "@/components/VaultMembershipBadge";
import { DEFAULT_PROPOSAL_DURATION, PROTOCOL } from "@/lib/contracts";
import { getMember, getVault } from "@/lib/stacks";
import { txCreateProposal } from "@/lib/transactions";
import { useVaultMembership } from "@/lib/use-vault-membership";
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
  CLOSE_VAULT: "Close an empty vault and archive all treasury activity"
};

function normalizeProposalReasonInput(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getProposalGuardrail(
  proposalType: ProposalType,
  vault: Vault,
  amountValue: number,
  hasTypedAmount: boolean
) {
  const totalVaultValue = vault.totalVaultValue || vault.liquidBalance;
  const zestPosition = vault.zestPositionValue || 0;

  if (vault.status !== "ACTIVE") {
    return "This vault has already been closed, so proposal creation is locked and the page is now read-only.";
  }

  if (proposalType === "CLOSE_VAULT" && totalVaultValue > 0) {
    return `Close vault is locked until the treasury reaches 0 sBTC. Withdraw or distribute the remaining ${satsTosBTC(totalVaultValue)} sBTC first.`;
  }

  if (!hasTypedAmount || Number.isNaN(amountValue) || amountValue <= 0) {
    return null;
  }

  if ((proposalType === "WITHDRAW_SINGLE" || proposalType === "WITHDRAW_BY_SHARE") && amountValue > totalVaultValue) {
    return `This vault currently tracks ${satsTosBTC(totalVaultValue)} sBTC, so the requested withdrawal exceeds the available treasury value.`;
  }

  if (proposalType === "DEPOSIT_TO_ZEST") {
    if (!vault.yieldEnabled) {
      return "Yield is currently disabled for this vault. Enable the yield path before proposing a Zest allocation.";
    }

    if (amountValue > vault.liquidBalance) {
      return `Only ${satsTosBTC(vault.liquidBalance)} sBTC is liquid in the vault right now, so the requested Zest deposit is too large.`;
    }

    const newLiquidBalance = vault.liquidBalance - amountValue;
    const newZestPosition = zestPosition + amountValue;
    const maxZestAllowed = Math.floor((totalVaultValue * PROTOCOL.maxZestAllocationPct) / 100);
    const minLiquidReserve = Math.ceil((totalVaultValue * PROTOCOL.minLiquidReservePct) / 100);

    if (newZestPosition > maxZestAllowed) {
      return `This vault can allocate at most ${satsTosBTC(maxZestAllowed)} sBTC to Zest under the current ${PROTOCOL.maxZestAllocationPct}% cap.`;
    }

    if (newLiquidBalance < minLiquidReserve) {
      return `This allocation would break the ${PROTOCOL.minLiquidReservePct}% liquid reserve rule. Keep at least ${satsTosBTC(minLiquidReserve)} sBTC liquid.`;
    }
  }

  if (proposalType === "WITHDRAW_FROM_ZEST") {
    if (zestPosition <= 0) {
      return "There is no active Zest position in this vault yet, so there is nothing available to withdraw.";
    }

    if (amountValue > zestPosition) {
      return `The vault currently has ${satsTosBTC(zestPosition)} sBTC in Zest, so the requested withdrawal exceeds the live position.`;
    }
  }

  return null;
}

export default function CreateProposalPage() {
  const { id } = useParams<{ id: string }>();
  const vaultId = normalizeUint(id);
  const { connected, address, connect, selectedWalletId, selectedWalletName } = useWallet();
  const router = useRouter();
  const { isMember } = useVaultMembership(vaultId, address);

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
        const currentVault = await getVault(vaultId);
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
  const totalVaultValue = vault ? vault.totalVaultValue || vault.liquidBalance : 0;
  const hasTypedAmount = amount.trim().length > 0;
  const parsedAmountValue = needsAmount ? (isThresholdProposal ? Number(amount) : sBTCToSats(amount)) : 0;
  const proposalGuardrail = vault ? getProposalGuardrail(proposalType, vault, parsedAmountValue, hasTypedAmount) : null;
  const submitBlocked =
    submitting ||
    (connected && !isMember) ||
    !vault ||
    vault.status !== "ACTIVE" ||
    proposalGuardrail !== null;

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

    if (!selectedWalletId) {
      setFormError("Reconnect and choose the wallet that should sign this proposal before submitting it.");
      connect();
      return;
    }

    if (!isMember) {
      setFormError("This connected wallet is not an active vault member, so it cannot create proposals for this treasury.");
      return;
    }

    if (!vault || vault.status !== "ACTIVE") {
      setFormError("This vault has already been closed, so new proposals cannot be created from this page.");
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

    if (proposalGuardrail) {
      setFormError(proposalGuardrail);
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

    const normalizedReason = normalizeProposalReasonInput(reason);
    if (!normalizedReason) {
      setFormError("Add a reason so every member understands why this proposal should be approved.");
      return;
    }

    if (proposalType === "ADD_MEMBER" || proposalType === "REMOVE_MEMBER") {
      const recipientAddress = recipient.trim();
      const recipientMember = await getMember(vaultId, recipientAddress);

      if (proposalType === "ADD_MEMBER" && recipientMember) {
        setFormError("This address is already recorded in the vault membership set, so it cannot be added again through a new proposal.");
        return;
      }

      if (proposalType === "REMOVE_MEMBER") {
        if (recipientAddress === address) {
          setFormError("Self-removal is blocked by the protocol. Ask another active member to propose a membership change if needed.");
          return;
        }

        if (!recipientMember?.active) {
          setFormError("This address is not an active member of the vault, so it cannot be removed through this proposal.");
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      await txCreateProposal(
        vaultId,
        PROPOSAL_TYPE_IDS[proposalType],
        amountValue,
        needsRecipient && recipient.trim() ? recipient.trim() : null,
        normalizedReason,
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
  const normalizedReasonPreview = normalizeProposalReasonInput(reason);

  return (
    <div className="page-wrap space-y-8">
      <PageHeader
        eyebrow="Proposal Builder"
        title={`Create a proposal for ${vault.name}`}
        description="Draft the exact treasury action members should vote on, review the impact, then sign a proposal creation transaction with your connected wallet."
        backHref={`/vault/${vaultId}/proposals`}
        backLabel="Back to proposals"
        meta={
          <div className="flex flex-wrap gap-3 text-sm text-ink-400">
            {isMember && vault && <VaultMembershipBadge creator={vault.creator === address} />}
            <span className="rounded-full border border-overlay/10 bg-overlay/[0.04] px-4 py-2">
              Current vault threshold {vault.thresholdPercent}%
            </span>
            <span className={vault.status === "ACTIVE" ? "badge-active" : "badge-executed"}>{vault.status}</span>
            <span className="rounded-full border border-overlay/10 bg-overlay/[0.04] px-4 py-2">
              Wallet role: {isMember ? "proposer" : connected ? "read-only viewer" : "connect wallet to propose"}
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
            description: "Your wallet submits the proposal on-chain only after the payload passes client-side protocol checks."
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
                  {satsTosBTC(Math.floor((vault.totalVaultValue || vault.liquidBalance) * (PROTOCOL.maxZestAllocationPct / 100)))} sBTC.
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
            <p className="mt-2 text-right text-sm text-ink-500">{reason.length}/256</p>
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
              className="w-full accent-orange-400"
            />
            <p className="helper-text">
              A longer duration gives members more time to review and vote before the proposal expires.
            </p>
          </div>

          {proposalType === "CLOSE_VAULT" && (
            <div className="notice-danger">
              <strong>Warning:</strong> Closing a vault is irreversible. VaultCircle now allows close-out only when the treasury is fully empty, after which deposits, proposal creation, voting, and execution are all deactivated.
            </div>
          )}

          {proposalType === "DEPOSIT_TO_ZEST" && (
            <div className="notice-brand">
              <strong>Reward Model A:</strong> Any Zest yield belongs to the vault balance as a whole. Members benefit later through group distributions, not through private yield claims.
            </div>
          )}

          {!connected && (
            <TxStatus
              state="pending"
              title="Connect a wallet to continue"
              description="Only connected vault members can create governance proposals. The draft stays here while you connect."
            />
          )}

          {connected && !isMember && (
            <TxStatus
              state="error"
              title="Member action locked"
              description="This wallet can review the proposal builder, but only active vault members can submit new proposals."
            />
          )}

          {vault.status !== "ACTIVE" && (
            <TxStatus
              state="error"
              title="Vault archived"
              description="This vault has already been closed. Proposal creation is disabled because the treasury is now in archive mode."
            />
          )}

          {proposalGuardrail && (
            <TxStatus
              state="error"
              title={proposalType === "CLOSE_VAULT" ? "Vault must be empty before close-out" : "Proposal guardrail triggered"}
              description={proposalGuardrail}
            />
          )}

          {formError && <TxStatus state="error" title="Proposal not submitted" description={formError} />}

          <button type="submit" className="btn-primary w-full" disabled={submitBlocked}>
            {submitting
              ? "Awaiting wallet confirmation..."
              : vault.status !== "ACTIVE"
                ? "Vault Archived"
                : connected && !isMember
                  ? "Only Members Can Propose"
                  : proposalType === "CLOSE_VAULT" && totalVaultValue > 0
                    ? "Empty Treasury Before Closing"
                    : "Create Proposal"}
          </button>
          <p className="text-center text-sm text-ink-500">
            When you submit, {selectedWalletName ?? "your wallet"} will sign the proposal creation request only after VaultCircle confirms the action is valid for the vault&apos;s current treasury state.
          </p>
        </form>

        <div className="space-y-6">
          <InfoCard
            title="Transaction preview"
            tone="brand"
            description={
              <>
                <p>Action type: <strong className="text-ink-50">{PROPOSAL_TYPE_LABELS[PROPOSAL_TYPE_IDS[proposalType]]}</strong></p>
                <p className="mt-2">Amount or threshold: <strong className="text-ink-50">{amountPreview}</strong></p>
                <p className="mt-2">Target address: <strong className="text-ink-50">{recipient || "No address needed yet"}</strong></p>
                <p className="mt-2">Voting window: <strong className="text-ink-50">{duration} blocks</strong></p>
                <p className="mt-2">Reason payload: <strong className="text-ink-50">{normalizedReasonPreview || "Add a reason to preview the final on-chain payload"}</strong></p>
              </>
            }
          />

          <InfoCard
            title="What members see next"
            description="After submission, the proposal appears in the vault's proposal list. Members can review the reason, approve or reject it, and execute it after the threshold is reached."
          />

          {proposalType === "CLOSE_VAULT" && (
            <InfoCard
              title="Close-out policy"
              tone="warning"
              description={
                totalVaultValue > 0
                  ? `This vault still tracks ${satsTosBTC(totalVaultValue)} sBTC, so close-out is blocked until the treasury is fully emptied.`
                  : "This vault is empty, so a close-out proposal can safely archive it and deactivate future treasury activity."
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
