"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import PendingVaultCard from "@/components/PendingVaultCard";
import StatCard from "@/components/StatCard";
import TxStatus from "@/components/TxStatus";
import VaultCard from "@/components/VaultCard";
import { clearPendingVaultCreation, getPendingVaultCreation, matchesPendingVault, type PendingVaultCreation } from "@/lib/pending-vault";
import { getMemberVaults, getVault } from "@/lib/stacks";
import { devWarn, isSafeUint, normalizeUint } from "@/lib/validation";
import { useWallet } from "@/lib/wallet";
import type { Vault } from "@/types";
import { satsTosBTC } from "@/types";

const AUTO_REFRESH_INTERVAL_MS = 10000;
const AUTO_REFRESH_ATTEMPTS = 12;
const MORPH_HOLD_MS = 2400;

function VaultsPageContent() {
  const { walletReady, connected, address, connect } = useWallet();
  const searchParams = useSearchParams();

  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [pendingVault, setPendingVault] = useState<PendingVaultCreation | null>(null);
  const [refreshingPendingVault, setRefreshingPendingVault] = useState(false);
  const [createdVaultVisible, setCreatedVaultVisible] = useState(false);
  const [revealedVault, setRevealedVault] = useState<Vault | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const pendingVaultSlotRef = useRef<HTMLDivElement | null>(null);
  const createdFlow = searchParams.get("created") === "1";
  const txIdFromUrl = searchParams.get("txId") || undefined;
  const createdVaultId = normalizeUint(searchParams.get("vaultId"), 0);
  const createdVaultIdParam = searchParams.get("vaultId");

  useEffect(() => {
    if (!createdVaultIdParam || createdVaultId !== null) return;
    devWarn("Ignoring invalid created vault id query param on /vaults:", createdVaultIdParam);
  }, [createdVaultId, createdVaultIdParam]);

  useEffect(() => {
    if (!connected || !address) return;

    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const currentAddress = address;

    const pendingForAddress = getPendingVaultCreation(currentAddress);

    async function loadVaults(attempt = 0) {
      if (cancelled) return;

      if (attempt === 0) {
        setPendingVault(pendingForAddress);
        setCreatedVaultVisible(false);
        setRevealedVault(null);
      }

      setLoading(attempt === 0);
      setLoadError("");

      try {
        const vaultIds = await getMemberVaults(currentAddress);
        const validVaultIds = Array.from(new Set(vaultIds.filter((vaultId): vaultId is number => isSafeUint(vaultId))));

        if (validVaultIds.length !== vaultIds.length) {
          devWarn("Skipping invalid vault ids on /vaults:", vaultIds);
        }

        const loadedVaults = (await Promise.all(validVaultIds.map((vaultId) => getVault(vaultId, { skipZest: true })))).filter(
          (vault): vault is Vault => vault !== null
        );
        const createdVault =
          createdVaultId !== null && !validVaultIds.includes(createdVaultId) ? await getVault(createdVaultId, { skipZest: true }) : null;
        const combinedVaults = [...loadedVaults, ...(createdVault ? [createdVault] : [])];
        const dedupedVaults = Array.from(new Map(combinedVaults.map((vault) => [vault.vaultId, vault])).values());

        if (cancelled) return;
        setVaults(dedupedVaults);

        const matchedVault =
          pendingForAddress
            ? createdVaultId !== null
              ? dedupedVaults.find((vault) => vault.vaultId === createdVaultId) ||
                dedupedVaults.find((vault) => matchesPendingVault(vault, pendingForAddress))
              : dedupedVaults.find((vault) => matchesPendingVault(vault, pendingForAddress))
            : null;
        if (matchedVault && pendingForAddress) {
          clearPendingVaultCreation(pendingForAddress.txId);
          setRevealedVault(matchedVault);
          setPendingVault(null);
          setCreatedVaultVisible(true);
          setRefreshingPendingVault(false);
          setManualRefreshing(false);
          setLoading(false);
          return;
        }

        if (createdVaultId !== null && dedupedVaults.some((vault) => vault.vaultId === createdVaultId)) {
          setCreatedVaultVisible(true);
        }

        const shouldContinueRefreshing =
          (Boolean(pendingForAddress) || createdFlow) &&
          !(createdVaultId !== null && dedupedVaults.some((vault) => vault.vaultId === createdVaultId)) &&
          attempt < AUTO_REFRESH_ATTEMPTS - 1;

        setRefreshingPendingVault(shouldContinueRefreshing);
        if (attempt === 0) {
          setManualRefreshing(false);
        }
        setLoading(false);

        if (shouldContinueRefreshing) {
          refreshTimer = setTimeout(() => {
            void loadVaults(attempt + 1);
          }, AUTO_REFRESH_INTERVAL_MS);
        }
      } catch (error) {
        if (cancelled) return;

        setLoading(false);
        setLoadError("We could not load your vault dashboard right now. Please refresh and confirm your wallet is on Stacks Testnet.");
        devWarn("Failed to load /vaults dashboard:", error);

        const shouldContinueRefreshing =
          (Boolean(pendingForAddress) || createdFlow) && attempt < AUTO_REFRESH_ATTEMPTS - 1;
        setRefreshingPendingVault(shouldContinueRefreshing);
        if (attempt === 0) {
          setManualRefreshing(false);
        }

        if (shouldContinueRefreshing) {
          refreshTimer = setTimeout(() => {
            void loadVaults(attempt + 1);
          }, AUTO_REFRESH_INTERVAL_MS);
        }
      }
    }

    void loadVaults();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [address, connected, createdFlow, createdVaultId, refreshNonce]);

  useEffect(() => {
    if (!revealedVault) return;

    const timeout = setTimeout(() => {
      setRevealedVault(null);
    }, MORPH_HOLD_MS);

    return () => clearTimeout(timeout);
  }, [revealedVault]);

  useEffect(() => {
    if (!revealedVault || !createdFlow) return;

    const slot = pendingVaultSlotRef.current;
    if (!slot) return;

    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const frame = window.requestAnimationFrame(() => {
      slot.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center"
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [createdFlow, revealedVault]);

  const visibleVaults = useMemo(() => {
    if (!connected || !address) return [];

    const orderedVaults = [...vaults];
    orderedVaults.sort((left, right) => {
      if (createdVaultId !== null) {
        if (left.vaultId === createdVaultId) return -1;
        if (right.vaultId === createdVaultId) return 1;
      }

      return right.vaultId - left.vaultId;
    });

    return orderedVaults;
  }, [address, connected, createdVaultId, vaults]);
  const visibleVaultsWithoutReveal = useMemo(
    () => (revealedVault ? visibleVaults.filter((vault) => vault.vaultId !== revealedVault.vaultId) : visibleVaults),
    [revealedVault, visibleVaults]
  );
  const totalValue = useMemo(
    () => visibleVaults.reduce((sum, vault) => sum + (vault.totalVaultValue || vault.liquidBalance), 0),
    [visibleVaults]
  );
  const activeVaults = useMemo(() => visibleVaults.filter((vault) => vault.status === "ACTIVE").length, [visibleVaults]);
  const yieldEnabled = useMemo(() => visibleVaults.filter((vault) => vault.yieldEnabled).length, [visibleVaults]);
  const showPendingVaultCard = Boolean(pendingVault) || Boolean(revealedVault);
  const refreshButtonBusy = loading || manualRefreshing;

  function handleManualRefresh() {
    if (refreshButtonBusy) return;
    setManualRefreshing(true);
    setRefreshNonce((current) => current + 1);
  }

  if (!walletReady) {
    return (
      <div className="page-wrap space-y-8">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="surface-card h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="surface-card h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="page-wrap">
        <EmptyState
          title="Connect a wallet to view your vault dashboard"
          description="VaultCircle will show every vault where your testnet wallet is a member, along with treasury balances, approval thresholds, and active governance actions."
        />
        <div className="mt-6 flex justify-center">
          <button onClick={() => connect()} className="btn-primary">
            Connect Xverse or Leather
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap space-y-8">
      <PageHeader
        eyebrow="Vault Dashboard"
        title="Your shared treasuries"
        description="See the vaults connected to your wallet, understand how much value each one holds, and move into the next action with confidence."
        actions={
          <div className="flex flex-wrap gap-3">
            {pendingVault && !revealedVault && (
              <button onClick={handleManualRefresh} disabled={refreshButtonBusy} className="btn-secondary px-4 py-3 text-sm">
                {refreshButtonBusy ? "Refreshing..." : "Refresh now"}
              </button>
            )}
            <Link href="/create-vault" className="btn-primary">
              Create Vault
            </Link>
          </div>
        }
        meta={
          <div className="flex flex-wrap gap-3 text-sm text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              Connected wallet role: member signer
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              Network: Stacks Testnet
            </span>
          </div>
        }
      />

      {createdFlow && !createdVaultVisible && (
        <TxStatus
          state={refreshingPendingVault ? "pending" : "success"}
          title={refreshingPendingVault ? "Vault creation is settling on testnet" : "Vault creation request submitted"}
          description={
            refreshingPendingVault
              ? "Your wallet submitted the vault creation transaction. We are refreshing the dashboard automatically while Stacks Testnet confirms and indexes the new vault."
              : "Your wallet broadcast the vault creation transaction. If the new vault is not visible yet, give testnet a moment and refresh this page."
          }
          txId={pendingVault?.txId || txIdFromUrl}
          statusLabel={refreshingPendingVault ? "Indexing on Testnet" : "Broadcast Received"}
        />
      )}

      {createdVaultVisible && (
        <TxStatus
          state="success"
          title="Your new vault is now visible"
          description="The dashboard detected the vault that was just created. You can open it below to deposit, invite members through proposals, and start treasury coordination."
          txId={pendingVault?.txId || txIdFromUrl}
          statusLabel="Confirmed on Testnet"
        />
      )}

      {pendingVault && refreshingPendingVault && !revealedVault && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-slate-300">
          <p className="font-semibold text-white">{pendingVault.name}</p>
          <p className="mt-2">
            Waiting for a vault with {pendingVault.memberCount} member{pendingVault.memberCount !== 1 ? "s" : ""},{" "}
            {pendingVault.thresholdPercent}% approvals, and {pendingVault.yieldEnabled ? "yield enabled" : "yield disabled"}.
          </p>
        </div>
      )}

      {loadError && (
        <TxStatus
          state="error"
          title="Vault dashboard unavailable"
          description={loadError}
        />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Vaults connected" value={String(visibleVaults.length)} sub="Treasuries where this wallet is a member" />
        <StatCard label="Active vaults" value={String(activeVaults)} sub="Vaults still open for deposits, votes, and treasury actions" />
        <StatCard label="Tracked value" value={`${satsTosBTC(totalValue)} sBTC`} sub={`${yieldEnabled} vault${yieldEnabled === 1 ? "" : "s"} with yield enabled`} accent />
      </div>

      {loading && (
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="surface-card h-64">
              <div className="skeleton-line w-1/3" />
              <div className="mt-5 skeleton-line w-2/3" />
              <div className="mt-3 skeleton-line-sm w-full" />
              <div className="mt-2 skeleton-line-sm w-5/6" />
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="skeleton-line-sm w-24" />
                  <div className="mt-3 skeleton-line w-28" />
                </div>
                <div>
                  <div className="skeleton-line-sm w-24" />
                  <div className="mt-3 skeleton-line w-28" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && visibleVaultsWithoutReveal.length === 0 && !showPendingVaultCard && (
        <EmptyState
          title={refreshingPendingVault ? "Your vault is still being indexed" : "No vaults yet for this wallet"}
          description={
            refreshingPendingVault
              ? "Stacks Testnet has not returned the new vault yet. Keep this page open for a moment or refresh again shortly."
              : "Create a vault to start pooling sBTC with your group, or ask another member to add this wallet to an existing treasury."
          }
          actionHref="/create-vault"
          actionLabel={refreshingPendingVault ? "Create Another Vault Later" : "Create Your First Vault"}
        />
      )}

      {!loading && (visibleVaultsWithoutReveal.length > 0 || showPendingVaultCard) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {showPendingVaultCard && (
            <div ref={pendingVaultSlotRef}>
              <PendingVaultCard
                pendingVault={pendingVault}
                revealedVault={revealedVault}
                refreshing={refreshButtonBusy || refreshingPendingVault}
                onRefresh={handleManualRefresh}
              />
            </div>
          )}
          {visibleVaultsWithoutReveal.map((vault) => (
            <VaultCard key={vault.vaultId} vault={vault} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function VaultsPage() {
  return (
    <Suspense
      fallback={
        <div className="page-wrap">
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="surface-card h-64" />
            ))}
          </div>
        </div>
      }
    >
      <VaultsPageContent />
    </Suspense>
  );
}
