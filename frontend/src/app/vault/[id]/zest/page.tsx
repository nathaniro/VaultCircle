"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ActionPanel from "@/components/ActionPanel";
import EmptyState from "@/components/EmptyState";
import InfoCard from "@/components/InfoCard";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import TxStatus from "@/components/TxStatus";
import { PROTOCOL, ZEST_MODE } from "@/lib/contracts";
import { getVault, getYieldEarned, getZestPosition } from "@/lib/stacks";
import { txSyncZestYield } from "@/lib/transactions";
import { formatAppError, normalizeUint } from "@/lib/validation";
import { useWallet } from "@/lib/wallet";
import { satsTosBTC } from "@/types";
import type { Vault } from "@/types";

export default function ZestPage() {
  const { id } = useParams<{ id: string }>();
  const vaultId = normalizeUint(id);
  const { address } = useWallet();

  const [vault, setVault] = useState<Vault | null>(null);
  const [zestPosition, setZestPosition] = useState(0);
  const [yieldEarned, setYieldEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncSuccess, setSyncSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setLoadError("");

      if (vaultId === null) {
        setVault(null);
        setZestPosition(0);
        setYieldEarned(0);
        setLoadError("We could not load this yield page because the vault ID in the URL is invalid.");
        setLoading(false);
        return;
      }

      try {
        const currentVault = await getVault(vaultId);
        if (cancelled) return;

        setVault(currentVault);

        if (currentVault) {
          const position = await getZestPosition(vaultId);
          const earned = await getYieldEarned(vaultId);
          if (cancelled) return;
          setZestPosition(position);
          setYieldEarned(earned);
        } else {
          setLoadError("The vault could not be found on the selected Stacks Testnet deployment.");
        }
      } catch (error) {
        if (cancelled) return;
        setVault(null);
        setZestPosition(0);
        setYieldEarned(0);
        setLoadError(formatAppError(error, "We could not load the yield details for this vault."));
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

  async function handleSync() {
    if (!address || vaultId === null) return;
    setSyncing(true);
    setSyncError("");
    setSyncSuccess("");
    try {
      await txSyncZestYield(
        vaultId,
        async () => {
          const currentVault = await getVault(vaultId);
          setVault(currentVault);

          if (currentVault) {
            const position = await getZestPosition(vaultId);
            const earned = await getYieldEarned(vaultId);
            setZestPosition(position);
            setYieldEarned(earned);
          }
          setSyncing(false);
          setSyncSuccess("The position sync transaction was submitted. Refreshed values now reflect the latest on-chain read.");
        },
        () => {
          setSyncing(false);
          setSyncError("The wallet request was cancelled before the sync transaction was sent.");
        }
      );
    } catch (error) {
      setSyncing(false);
      setSyncError(formatAppError(error, "The sync transaction could not be prepared for this vault."));
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
          title="Yield view unavailable"
          description={loadError || "The vault could not be loaded for this route, so the Zest view cannot be shown."}
          actionHref="/vaults"
          actionLabel="Back to Vault Dashboard"
        />
      </div>
    );
  }

  const totalValue = (vault.liquidBalance || 0) + zestPosition;
  const zestCap = Math.floor((totalValue * PROTOCOL.maxZestAllocationPct) / 100);
  const principalDeposited = vault.zestAllocated || 0;
  const liveZestEnabled = ZEST_MODE === "live";

  return (
    <div className="page-wrap space-y-8">
      <PageHeader
        eyebrow="Yield Configuration"
        title={`Zest view for ${vault.name}`}
        description="Track how much treasury value is allocated to Zest, how much yield has accrued, and what the group must vote on before funds move in or out."
        backHref={`/vault/${vaultId}`}
        backLabel="Back to vault overview"
      />

      {!liveZestEnabled && (
        <InfoCard
          title="Live Zest mode is disabled in this deployment"
          tone="warning"
          description="This frontend is not configured for live Zest testnet execution yet. Members can still understand the yield flow, but actual live adapter behavior depends on contract and environment readiness."
        />
      )}

      {syncError && <TxStatus state="error" title="Sync not submitted" description={syncError} />}
      {syncSuccess && <TxStatus state="success" title="Sync submitted" description={syncSuccess} />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Zest position value" value={`${satsTosBTC(zestPosition)} sBTC`} sub="Current position value including any accrued yield" accent />
        <StatCard label="Principal deposited" value={`${satsTosBTC(principalDeposited)} sBTC`} sub="Original amount the vault allocated to Zest" />
        <StatCard label="Yield earned" value={`${satsTosBTC(yieldEarned)} sBTC`} sub="Additional value that stays inside the group treasury" accent={yieldEarned > 0} />
        <StatCard label="Allocation cap" value={`${satsTosBTC(zestCap)} sBTC`} sub={`${PROTOCOL.maxZestAllocationPct}% of total treasury value`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <InfoCard
            title="How Reward Model A works"
            tone="brand"
            description={
              <>
                <p>1. Members vote on whether a portion of idle sBTC should be moved into Zest.</p>
                <p className="mt-2">2. If the proposal passes, the vault allocates only within its configured cap and reserve rules.</p>
                <p className="mt-2">3. Any yield grows the total vault value instead of creating individual member claim balances.</p>
              </>
            }
          />

          <InfoCard
            title="What the next transaction would do"
            description="A deposit-to-Zest proposal asks the group to move treasury capital into the external strategy. A withdraw-from-Zest proposal brings that capital back into the vault's liquid balance."
          />
        </div>

        <ActionPanel
          title="Treasury actions for yield"
          description="Members do not move funds directly from this page. They create governance proposals, the group votes, and a signer executes the approved result."
          actions={
            <>
              <Link href={`/vault/${vaultId}/create-proposal`} className="btn-primary">
                Create Yield Proposal
              </Link>
              {zestPosition > 0 && (
                <button onClick={handleSync} disabled={syncing} className="btn-secondary">
                  {syncing ? "Syncing..." : "Sync Position"}
                </button>
              )}
            </>
          }
          footer={
            <div className="notice-danger">
              <strong>Risk notice:</strong> Any live yield allocation introduces external smart contract risk. VaultCircle keeps allocations proposal-gated so the group explicitly approves that tradeoff first.
            </div>
          }
        />
      </div>
    </div>
  );
}
