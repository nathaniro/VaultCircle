"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import InfoCard from "@/components/InfoCard";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import StepIndicator from "@/components/StepIndicator";
import TxStatus from "@/components/TxStatus";
import VaultMembershipBadge from "@/components/VaultMembershipBadge";
import { getMember, getVault } from "@/lib/stacks";
import { txDeposit } from "@/lib/transactions";
import { formatAppError, normalizeUint } from "@/lib/validation";
import { useWallet } from "@/lib/wallet";
import { sBTCToSats, satsTosBTC } from "@/types";
import type { Member, Vault } from "@/types";

export default function DepositPage() {
  const { id } = useParams<{ id: string }>();
  const vaultId = normalizeUint(id);
  const { address, connected, connect, selectedWalletName } = useWallet();

  const [vault, setVault] = useState<Vault | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [txId, setTxId] = useState("");
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadVaultContext() {
      setLoading(true);
      setPageError("");

      if (vaultId === null) {
        setVault(null);
        setMember(null);
        setPageError("We could not load this vault because the vault ID in the URL is invalid.");
        setLoading(false);
        return;
      }

      try {
        const currentVault = await getVault(vaultId, { skipZest: true });
        if (cancelled) return;

        setVault(currentVault);
        if (!currentVault) {
          setPageError("The vault could not be found on the selected Stacks Testnet deployment.");
          setLoading(false);
          return;
        }

        if (address) {
          const currentMember = await getMember(vaultId, address);
          if (cancelled) return;
          setMember(currentMember);
        } else {
          setMember(null);
        }
      } catch (error) {
        if (cancelled) return;
        setVault(null);
        setMember(null);
        setPageError(formatAppError(error, "We could not load the vault details needed for this deposit."));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadVaultContext();

    return () => {
      cancelled = true;
    };
  }, [vaultId, address]);

  const sharePercent =
    vault && vault.totalContributed > 0 && member
      ? ((member.contributed / vault.totalContributed) * 100).toFixed(2)
      : "0.00";
  const isActiveMember = Boolean(member?.active);
  const vaultIsActive = vault?.status === "ACTIVE";

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (vaultId === null) {
      setFormError("This deposit link is invalid. Return to your dashboard and open the vault again.");
      return;
    }

    if (!connected || !address) {
      connect();
      return;
    }

    if (!vaultIsActive) {
      setFormError("This vault has been closed, so deposits are permanently disabled and the page is now read-only.");
      return;
    }

    if (!isActiveMember) {
      setFormError("This connected wallet is not an active member of the vault, so it cannot submit deposit transactions.");
      return;
    }

    const sats = sBTCToSats(amount);
    if (Number.isNaN(sats) || sats <= 0) {
      setFormError("Enter a valid sBTC amount greater than zero before continuing.");
      return;
    }

    setSubmitting(true);
    try {
      await txDeposit(
        vaultId,
        sats,
        ({ txId: submittedTxId }) => {
          setTxId(submittedTxId);
          setSubmitting(false);
        },
        () => {
          setFormError("The wallet request was cancelled before the deposit was submitted.");
          setSubmitting(false);
        }
      );
    } catch (error) {
      setFormError(formatAppError(error, "The deposit could not be submitted. Please check the amount and try again."));
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
          title="Deposit view unavailable"
          description={pageError || "The vault could not be loaded for this route, so no deposit transaction can be prepared."}
          actionHref="/vaults"
          actionLabel="Back to Vault Dashboard"
        />
      </div>
    );
  }

  return (
    <div className="page-wrap space-y-8">
      <PageHeader
        eyebrow="Vault Contribution"
        title={`Deposit into ${vault.name}`}
        description="Increase the treasury balance and your recorded contribution share by sending sBTC into this vault."
        backHref={`/vault/${vaultId}`}
        backLabel="Back to vault overview"
        meta={
          <div className="flex flex-wrap gap-3 text-sm text-slate-400">
            {isActiveMember && <VaultMembershipBadge creator={vault.creator === address} />}
            <span className={vault.status === "ACTIVE" ? "badge-active" : "badge-executed"}>{vault.status}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              Connected role: {!vaultIsActive ? "archived vault" : isActiveMember ? "depositor and member" : connected ? "read-only viewer" : "connect wallet to deposit"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              Next step: sign a deposit transaction in your wallet
            </span>
          </div>
        }
      />

      <StepIndicator
        currentStep={2}
        steps={[
          {
            title: "Review vault context",
            description: "Check your current contribution, share, and the treasury balance before adding funds."
          },
          {
            title: "Enter the deposit amount",
            description: "Choose how much sBTC you want your wallet to send into the vault."
          },
          {
            title: "Sign the deposit transaction",
            description: "Your wallet broadcasts the contribution to the vault contract."
          }
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Your contribution" value={`${satsTosBTC(member?.contributed || 0)} sBTC`} sub="Already recorded for this wallet" />
        <StatCard label="Your share" value={`${sharePercent}%`} sub="Portion of the total contributed amount" accent />
        <StatCard label="Vault liquid balance" value={`${satsTosBTC(vault.liquidBalance)} sBTC`} sub="Funds currently available in the vault" />
        <StatCard label="Total contributed" value={`${satsTosBTC(vault.totalContributed)} sBTC`} sub="Combined member deposits tracked on-chain" />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <form onSubmit={handleDeposit} className="surface-card space-y-6">
          <div>
            <label className="label">Deposit amount</label>
            <input
              className="input text-lg"
              type="number"
              step="0.00000001"
              min="0.00000001"
              placeholder="0.05000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="helper-text">
              Enter the amount in sBTC. The app converts it into satoshis before sending the transaction to the contract.
            </p>
            {amount && !Number.isNaN(sBTCToSats(amount)) && (
              <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                Transaction preview: deposit {amount} sBTC ({sBTCToSats(amount).toLocaleString()} sats) from {selectedWalletName ?? "your wallet"} into this vault.
              </p>
            )}
          </div>

          {!connected && (
            <TxStatus
              state="pending"
              title="Connect a wallet to continue"
              description="Only connected vault members can sign deposit transactions. After connecting, the deposit amount remains here for review."
            />
          )}

          {connected && !isActiveMember && (
            <TxStatus
              state="error"
              title="Member action locked"
              description="This wallet can review the vault, but only active members can sign a deposit into the shared treasury."
            />
          )}

          {!vaultIsActive && (
            <TxStatus
              state="error"
              title="Vault archived"
              description="This vault has already been closed. Deposits are permanently disabled because the treasury is now in archive mode."
            />
          )}

          {formError && <TxStatus state="error" title="Deposit not submitted" description={formError} />}

          {txId ? (
            <TxStatus
              state="success"
              title="Deposit submitted"
              description="Your contribution transaction was sent to the network. Once it confirms, the vault balance and your recorded share will update."
              txId={txId}
              actionHref={`/vault/${vaultId}`}
              actionLabel="Back to Vault Overview"
            />
          ) : (
            <button type="submit" className="btn-primary w-full" disabled={submitting || !vaultIsActive || (connected && !isActiveMember)}>
              {submitting
                ? "Awaiting wallet confirmation..."
                : !vaultIsActive
                  ? "Vault Archived"
                  : connected && !isActiveMember
                    ? "Only Members Can Deposit"
                    : "Deposit sBTC"}
            </button>
          )}
        </form>

        <div className="space-y-6">
          <InfoCard
            title="What happens after this deposit"
            tone="brand"
            description="The vault balance increases, your contribution record updates, and future share-based distributions use the latest contribution history."
          />
          <InfoCard
            title="Important note"
            description="Depositing funds does not withdraw or distribute anything. It only adds sBTC into the shared treasury for future member-approved actions."
          />
        </div>
      </div>
    </div>
  );
}
