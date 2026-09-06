"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import InfoCard from "@/components/InfoCard";
import PageHeader from "@/components/PageHeader";
import RoleCard from "@/components/RoleCard";
import StepIndicator from "@/components/StepIndicator";
import TxStatus from "@/components/TxStatus";
import { MAX_ADDITIONAL_MEMBERS, getNormalizedAdditionalMembers, validateCreateVaultForm } from "@/lib/create-vault";
import { CONTRACTS, DEPLOYER_ADDRESS, PROTOCOL, STACKS_EXPLORER_URL } from "@/lib/contracts";
import { debugLog } from "@/lib/debug";
import { clearPendingVaultCreation, savePendingVaultCreation } from "@/lib/pending-vault";
import { checkProtocolStatus, type ProtocolStatus } from "@/lib/stacks";
import { txCreateVault, txInitializeProtocol } from "@/lib/transactions";
import { waitForCreateVaultOutcome } from "@/lib/tx-status";
import { devWarn, formatAppError } from "@/lib/validation";
import { useWallet } from "@/lib/wallet";

function logCreateVault(message: string, details?: Record<string, unknown>) {
  debugLog("CreateVault", message, details);
}

export default function CreateVaultPage() {
  const { walletReady, connected, address, connect, selectedWalletName } = useWallet();
  const router = useRouter();
  const isMountedRef = useRef(true);

  const [name, setName] = useState("");
  const [threshold, setThreshold] = useState<number>(PROTOCOL.defaultThreshold);
  const [yieldEnabled, setYield] = useState(false);
  const [beneficiary, setBeneficiary] = useState("");
  const [members, setMembers] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingTxId, setPendingTxId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pendingMessage, setPendingMessage] = useState("");

  // Protocol initialization state
  const [protocolStatus, setProtocolStatus] = useState<ProtocolStatus | null>(null);
  const [initializingProtocol, setInitializingProtocol] = useState(false);
  const [initTxId, setInitTxId] = useState<string | null>(null);
  const [initError, setInitError] = useState("");
  const isAdmin = connected && address?.toLowerCase() === DEPLOYER_ADDRESS.toLowerCase();

  useEffect(() => {
    logCreateVault("page mounted: checking protocol status");
    checkProtocolStatus().then(setProtocolStatus).catch(() => {
      console.warn("[VaultCircle][CreateVault] protocol status check failed; using unknown fallback");
      setProtocolStatus({ initialized: null, sbtcContract: null });
    });
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    logCreateVault("component mounted");
    return () => {
      logCreateVault("component unmounted");
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    logCreateVault("wallet state changed", {
      walletReady,
      connected,
      address,
      selectedWalletName: selectedWalletName ?? null
    });
  }, [walletReady, connected, address, selectedWalletName]);

  useEffect(() => {
    logCreateVault("submission state changed", {
      submitting,
      pendingTxId,
      hasError: Boolean(error)
    });
  }, [submitting, pendingTxId, error]);

  function addMemberField() {
    logCreateVault("addMemberField()", { currentMembers: members.length });
    if (members.length < MAX_ADDITIONAL_MEMBERS) setMembers([...members, ""]);
  }

  function updateMember(idx: number, val: string) {
    const updated = [...members];
    updated[idx] = val;
    setMembers(updated);
  }

  function removeMember(idx: number) {
    setMembers(members.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    logCreateVault("handleSubmit(): clicked Create Vault", {
      walletReady,
      connected,
      address,
      selectedWalletName: selectedWalletName ?? null,
      name,
      threshold,
      yieldEnabled,
      beneficiary,
      members
    });
    if (submitting) return;

    setError("");
    setPendingMessage("");
    setPendingTxId(null);

    if (!connected || !address) {
      console.warn("[VaultCircle][CreateVault] handleSubmit(): wallet not connected, opening wallet picker");
      connect();
      return;
    }

    const validation = validateCreateVaultForm({
      creatorAddress: address,
      name,
      threshold,
      minThreshold: PROTOCOL.minThreshold,
      maxThreshold: PROTOCOL.maxThreshold,
      members,
      beneficiary
    });

    if (validation.error) {
      console.warn("[VaultCircle][CreateVault] handleSubmit(): validation failed", {
        error: validation.error
      });
      setError(validation.error);
      return;
    }

    logCreateVault("handleSubmit(): validation passed", {
      totalMembers: validation.totalMembers,
      normalizedMembers: validation.normalizedMembers,
      beneficiary: beneficiary.trim() || null
    });
    setSubmitting(true);
    try {
      const txId = await new Promise<string>((resolve, reject) => {
        let settled = false;
        const startedAt = Date.now();
        const unresolvedWarning = window.setTimeout(() => {
          console.warn("[VaultCircle][CreateVault] handleSubmit(): txCreateVault promise still pending after 20s", {
            selectedWalletName: selectedWalletName ?? null,
            connected,
            address
          });
        }, 20_000);

        const settleResolve = (submittedTxId: string) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(unresolvedWarning);
          logCreateVault("handleSubmit(): txCreateVault onFinish fired", {
            submittedTxId,
            elapsedMs: Date.now() - startedAt
          });
          resolve(submittedTxId);
        };

        const settleReject = (reason: unknown) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(unresolvedWarning);
          console.error("[VaultCircle][CreateVault] handleSubmit(): txCreateVault rejected", reason);
          reject(reason);
        };

        logCreateVault("handleSubmit(): calling txCreateVault()", {
          selectedWalletName: selectedWalletName ?? null,
          address,
          name: name.trim(),
          threshold,
          yieldEnabled,
          normalizedMembers: validation.normalizedMembers
        });

        void txCreateVault(
          name.trim(),
          validation.normalizedMembers,
          threshold,
          yieldEnabled,
          beneficiary.trim() || null,
          ({ txId: submittedTxId }) => settleResolve(submittedTxId),
          settleReject
        ).catch((submitError) => {
          console.error("[VaultCircle][CreateVault] handleSubmit(): txCreateVault.catch()", submitError);
          settleReject(submitError);
        });
      });

      if (!isMountedRef.current) {
        logCreateVault("handleSubmit(): component unmounted before txId handling");
        return;
      }

      logCreateVault("handleSubmit(): txId resolved and saving pending vault creation", { txId });
      savePendingVaultCreation({
        txId,
        walletAddress: address,
        name: name.trim(),
        thresholdPercent: threshold,
        memberCount: validation.totalMembers,
        yieldEnabled,
        submittedAt: Date.now()
      });
      setPendingTxId(txId);
      setPendingMessage(
        "Your wallet submitted the create-vault transaction. VaultCircle is waiting for testnet confirmation and registry indexing before opening the treasury."
      );

      try {
        logCreateVault("handleSubmit(): waiting for create-vault outcome", { txId });
        const outcome = await waitForCreateVaultOutcome(txId);
        if (!isMountedRef.current) {
          logCreateVault("handleSubmit(): component unmounted while waiting for outcome", { txId });
          return;
        }

        logCreateVault("handleSubmit(): received create-vault outcome", {
          txId,
          status: outcome.status,
          vaultId: "vaultId" in outcome ? outcome.vaultId ?? null : null,
          message: "message" in outcome ? outcome.message : null
        });

        if (outcome.status === "success") {
          savePendingVaultCreation({
            txId,
            walletAddress: address,
            name: name.trim(),
            thresholdPercent: threshold,
            memberCount: validation.totalMembers,
            yieldEnabled,
            submittedAt: Date.now(),
            vaultId: outcome.vaultId
          });

          if (typeof outcome.vaultId === "number") {
            const query = new URLSearchParams({ created: "1", txId });
            router.push(`/vault/${outcome.vaultId}?${query.toString()}`);
            return;
          }

          const query = new URLSearchParams({ created: "1", txId });
          router.push(`/vaults?${query.toString()}`);
          return;
        }

        if (outcome.status === "timeout") {
          console.warn("[VaultCircle][CreateVault] handleSubmit(): outcome polling timed out", { txId });
          router.push(`/vaults?created=1&txId=${encodeURIComponent(txId)}`);
          return;
        }

        console.warn("[VaultCircle][CreateVault] handleSubmit(): create-vault outcome returned failure", outcome);
        clearPendingVaultCreation(txId);
        setPendingTxId(null);
        setPendingMessage("");
        setError(outcome.message);
        setSubmitting(false);
      } catch (statusError) {
        console.error("[VaultCircle][CreateVault] handleSubmit(): waitForCreateVaultOutcome failed", statusError);
        devWarn("Could not finish monitoring create-vault transaction status:", statusError);
        router.push(`/vaults?created=1&txId=${encodeURIComponent(txId)}`);
      }
    } catch (err) {
      if (!isMountedRef.current) {
        logCreateVault("handleSubmit(): component unmounted during error handling");
        return;
      }
      console.error("[VaultCircle][CreateVault] handleSubmit(): final catch", err);
      setError(
        err instanceof Error && err.message === "Transaction cancelled by wallet"
          ? "The wallet request was cancelled. Click Create Vault again to retry."
          : formatAppError(err, "Vault creation could not be submitted. If your wallet is not opening, make sure Leather or Xverse is installed and unlocked, then try again.")
      );
      setPendingTxId(null);
      setPendingMessage("");
      setSubmitting(false);
    }
  }

  async function handleInitializeProtocol() {
    if (!connected || !address) {
      console.warn("[VaultCircle][CreateVault] handleInitializeProtocol(): wallet not connected, opening wallet picker");
      connect();
      return;
    }
    logCreateVault("handleInitializeProtocol(): start", {
      address,
      selectedWalletName: selectedWalletName ?? null
    });
    setInitializingProtocol(true);
    setInitTxId(null);
    setInitError("");
    try {
      const txId = await new Promise<string>((resolve, reject) => {
        void txInitializeProtocol(CONTRACTS.sbtc, ({ txId }) => resolve(txId), reject).catch(reject);
      });

      logCreateVault("handleInitializeProtocol(): tx submitted", { txId });
      setInitTxId(txId);

      // Poll every 5 s until the contract confirms (blocks take ~30–60 s on testnet)
      const deadline = Date.now() + 150_000;
      while (isMountedRef.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5_000));
        if (!isMountedRef.current) return;
        const status = await checkProtocolStatus();
        if (!isMountedRef.current) return;
        if (status.initialized === true) {
          logCreateVault("handleInitializeProtocol(): protocol became initialized", status);
          setProtocolStatus(status);
          setInitTxId(null);
          return;
        }
      }

      if (isMountedRef.current) {
        setInitTxId(null);
        setInitError(
          "Initialization was broadcast but not yet confirmed. Wait a minute, then refresh the page to continue."
        );
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error("[VaultCircle][CreateVault] handleInitializeProtocol(): failed", err);
      setInitError(
        err instanceof Error && err.message === "Transaction cancelled by wallet"
          ? "The wallet request was cancelled."
          : formatAppError(err, "Protocol initialization failed. Please try again.")
      );
    } finally {
      if (isMountedRef.current) setInitializingProtocol(false);
    }
  }

  const previewMembers = getNormalizedAdditionalMembers(members, address);
  const totalMembers = 1 + previewMembers.length;
  const requiredApprovals = Math.ceil((totalMembers * threshold) / 100);
  const awaitingWallet = submitting && !pendingTxId;
  const awaitingConfirmation = submitting && Boolean(pendingTxId);
  const currentStep = awaitingConfirmation ? 3 : awaitingWallet ? 2 : 1;
  const approvalPct = totalMembers > 0 ? (requiredApprovals / totalMembers) * 100 : 0;
  // null = still loading; initialized: null = API failed (allow attempt); initialized: false = confirmed not ready
  const protocolReady = protocolStatus === null || protocolStatus.initialized !== false;

  const primaryButtonLabel = !walletReady
    ? "Checking wallet…"
    : !protocolReady
      ? "Protocol not initialized — see notice above"
      : !connected
        ? "Connect Wallet to Create Vault"
        : awaitingWallet
          ? "Awaiting wallet…"
          : awaitingConfirmation
            ? "Waiting for Stacks Testnet…"
            : "Create Vault";

  return (
    <div className="page-wrap space-y-8">
      <PageHeader
        eyebrow="Vault Creation"
        title="Create a new shared vault"
        description="Set up a treasury where members contribute sBTC and majority approval gates every withdrawal, distribution, and policy change."
        meta={
          <div className="flex flex-wrap gap-3 text-sm text-ink-400">
            <span className="rounded-full border border-overlay/10 bg-overlay/[0.04] px-4 py-2">
              Network: Stacks Testnet
            </span>
            <span className="rounded-full border border-overlay/10 bg-overlay/[0.04] px-4 py-2">
              Your wallet becomes creator and first member
            </span>
          </div>
        }
      />

      <StepIndicator
        currentStep={currentStep}
        steps={[
          {
            title: "Configure vault",
            description: "Name the treasury, invite members, and define the approval threshold."
          },
          {
            title: "Review in wallet",
            description: "Confirm the creation transaction with your connected signer."
          },
          {
            title: "Finalize on-chain",
            description: "VaultCircle waits for testnet confirmation, indexes the result, and opens your vault."
          }
        ]}
      />

      {walletReady && !connected && (
        <TxStatus
          state="pending"
          title="Connect a signer to launch the vault"
          description="Connect Leather or Xverse, then VaultCircle will route the creation request through that wallet and open the vault as soon as confirmation lands."
        />
      )}

      {/* Protocol initialization guard — only shows when we've confirmed it's NOT initialized */}
      {protocolStatus !== null && protocolStatus.initialized === false && (
        <div className="rounded-[28px] border border-amber-400/25 bg-amber-400/[0.06] p-6 md:p-8">
          <div className="flex items-center gap-3">
            <span className="glow-dot bg-amber-400" />
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">Setup Required</p>
          </div>
          <h3 className="mt-3 text-xl font-semibold text-ink-50">
            VaultCircle is not initialized on this deployment
          </h3>
          <p className="mt-2 text-sm leading-6 text-amber-800/90 dark:text-amber-100/80">
            The protocol admin must call{" "}
            <code className="rounded bg-overlay/10 px-1.5 py-0.5 font-mono text-xs">initialize-protocol</code>{" "}
            with the sBTC contract address before any vault can be created. This is a one-time setup step.
          </p>
          {isAdmin ? (
            <div className="mt-5 space-y-3">
              {initTxId ? (
                <div className="rounded-xl border border-orange-400/20 bg-orange-400/[0.06] px-4 py-3 text-sm text-orange-800 dark:text-orange-200">
                  <p className="font-semibold">Initialization broadcast — waiting for Stacks Testnet to confirm…</p>
                  <p className="mt-1 text-xs text-orange-700/70 dark:text-orange-300/70">
                    Blocks take 30–90 seconds. Checking every 5 seconds automatically.
                  </p>
                  <a
                    href={`${STACKS_EXPLORER_URL}/txid/${initTxId}?chain=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block truncate font-mono text-xs text-orange-600 underline hover:text-orange-500 dark:text-orange-400 dark:hover:text-orange-300"
                  >
                    {initTxId}
                  </a>
                </div>
              ) : (
                <>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Your wallet is the protocol admin. Click below to initialize VaultCircle with{" "}
                    <code className="font-mono text-xs">{CONTRACTS.sbtc}</code>.
                  </p>
                  {initError && (
                    <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
                      {initError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleInitializeProtocol}
                    disabled={initializingProtocol}
                    className="btn-primary"
                  >
                    {initializingProtocol ? "Awaiting wallet…" : "Initialize Protocol"}
                  </button>
                </>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-amber-700/70 dark:text-amber-200/70">
              {connected
                ? "Contact the deployer of this VaultCircle instance to complete setup before creating vaults."
                : "Connect your deployer wallet to initialize VaultCircle, or contact the deployer."}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        {/* ── Form ── */}
        <form
          onSubmit={handleSubmit}
          className="divide-y divide-overlay/[0.08] overflow-hidden rounded-[28px] border border-overlay/10 bg-overlay/[0.045] shadow-[0_24px_70px_rgba(2,6,23,0.28)] backdrop-blur-sm"
        >
          {/* 1 · Vault name */}
          <section className="p-6 md:p-8">
            <SectionHeader n={1} title="Vault name" />
            <input
              className="input mt-5"
              placeholder="e.g. Operations Reserve"
              maxLength={64}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <p className="helper-text">Pick a name members will instantly recognize across dashboard and wallet flows.</p>
          </section>

          {/* 2 · Members */}
          <section className="p-6 md:p-8">
            <SectionHeader n={2} title="Initial members" />

            {/* Creator chip */}
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-orange-400/20 bg-orange-400/[0.06] px-4 py-3">
              <span className="glow-dot shrink-0 bg-orange-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">Your wallet &middot; creator and member&nbsp;1</p>
                {address && (
                  <p className="mt-0.5 truncate font-mono text-xs text-ink-400">{address}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full border border-orange-400/20 bg-orange-400/10 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300">
                Auto-added
              </span>
            </div>

            <p className="helper-text mt-3 mb-4">
              Invite up to {MAX_ADDITIONAL_MEMBERS} additional testnet wallets now &mdash; or add more later through member proposals.
            </p>

            <div className="space-y-3">
              {members.map((member, index) => (
                <div key={index} className="flex gap-3">
                  <input
                    className="input"
                    placeholder={`Member ${index + 2} · ST… testnet address`}
                    value={member}
                    onChange={(e) => updateMember(index, e.target.value)}
                  />
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMember(index)}
                      className="btn-secondary shrink-0 px-4 text-rose-700 dark:text-rose-300 hover:border-rose-400/30 hover:text-rose-800 dark:hover:text-rose-200"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {members.length < MAX_ADDITIONAL_MEMBERS && (
              <button type="button" onClick={addMemberField} className="btn-secondary mt-4">
                <span className="mr-1.5 text-orange-400">+</span>Add another member
              </button>
            )}
          </section>

          {/* 3 · Approval threshold */}
          <section className="p-6 md:p-8">
            <SectionHeader n={3} title="Approval threshold" />

            <div className="mt-5 rounded-[20px] border border-overlay/[0.08] bg-ink-950/60 px-6 py-8 text-center">
              <p className="text-6xl font-bold tracking-tight text-ink-50 tabular-nums">{threshold}%</p>
              <p className="mt-2 text-sm text-ink-400">of members must approve each treasury action</p>
              <div className="mt-4 inline-flex items-center rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-1.5">
                <span className="text-sm font-semibold text-orange-800 dark:text-orange-100">
                  {requiredApprovals} of {totalMembers} member{totalMembers !== 1 ? "s" : ""} must approve
                </span>
              </div>
            </div>

            <input
              type="range"
              min={PROTOCOL.minThreshold}
              max={PROTOCOL.maxThreshold}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="mt-5 w-full accent-orange-400"
            />
            <div className="mt-1.5 flex justify-between text-xs text-ink-500">
              <span>Min {PROTOCOL.minThreshold}%</span>
              <span>Max {PROTOCOL.maxThreshold}%</span>
            </div>
          </section>

          {/* 4 · Settings */}
          <section className="p-6 md:p-8">
            <SectionHeader n={4} title="Settings" />

            <label className="mt-5 flex cursor-pointer items-start gap-4 rounded-[20px] border border-overlay/[0.08] bg-ink-950/50 p-5 transition duration-200 hover:border-overlay/[0.14]">
              <input
                type="checkbox"
                checked={yieldEnabled}
                onChange={(e) => setYield(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-overlay/10 bg-ink-950 accent-orange-400"
              />
              <div>
                <p className="text-sm font-semibold text-ink-50">
                  Enable Zest yield path{" "}
                  <span className="font-normal text-ink-500">(optional)</span>
                </p>
                <p className="mt-1.5 text-sm leading-6 text-ink-400">
                  Members can later vote to allocate part of the treasury into Zest. Yield accrues to the vault
                  balance &mdash; never split into private claim accounts.
                </p>
              </div>
            </label>

            <div className="mt-5">
              <label className="label">
                Beneficiary address{" "}
                <span className="font-normal text-ink-500">(optional)</span>
              </label>
              <input
                className="input"
                placeholder="ST… testnet address"
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
              />
              <p className="helper-text">
                Close-vault distributions default to this address until the group votes to change it.
              </p>
            </div>
          </section>

          {/* Status + submit */}
          <section className="space-y-4 p-6 md:p-8">
            {awaitingWallet && (
              <TxStatus
                state="pending"
                title="Review vault creation in your wallet"
                description="Approve the transaction in your connected wallet. Once signed, VaultCircle will confirm the transaction on testnet and open the new vault automatically."
                statusLabel="Signature Requested"
              />
            )}

            {error && (
              <TxStatus
                state="error"
                title="Vault creation is not ready yet"
                description={error}
                statusLabel="Needs Attention"
              />
            )}

            {pendingTxId && pendingMessage && (
              <TxStatus
                state="pending"
                title="Vault submitted to Stacks Testnet"
                description={pendingMessage}
                txId={pendingTxId}
                statusLabel="Finalizing Vault"
              />
            )}

            <button
              type="submit"
              className="btn-primary w-full py-4 text-base"
              disabled={submitting || !walletReady || !protocolReady}
            >
              {primaryButtonLabel}
            </button>

            <p className="text-center text-sm text-ink-500">
              {selectedWalletName ?? "Your wallet"} will prompt you to sign before anything is submitted on-chain.
            </p>
          </section>
        </form>

        {/* ── Sidebar ── */}
        <div className="space-y-6 xl:self-start">
          {/* Live preview */}
          <div className="surface-card">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Live Preview</p>
              <span className="glow-dot bg-orange-400" />
            </div>

            <div className="mt-5 divide-y divide-overlay/[0.07]">
              <PreviewRow label="Name">
                <span className={name ? "font-medium text-ink-50" : "italic text-ink-600"}>
                  {name || "Not set yet"}
                </span>
              </PreviewRow>
              <PreviewRow label="Members at launch">
                <span className="font-medium text-ink-50">{totalMembers}</span>
              </PreviewRow>
              <PreviewRow label="Approvals required">
                <span className="font-semibold text-orange-700 dark:text-orange-300">
                  {requiredApprovals} of {totalMembers}
                </span>
              </PreviewRow>
              <PreviewRow label="Threshold">
                <span className="font-medium text-ink-50">{threshold}%</span>
              </PreviewRow>
              <PreviewRow label="Zest yield">
                <span className={yieldEnabled ? "font-medium text-emerald-700 dark:text-emerald-300" : "text-ink-500"}>
                  {yieldEnabled ? "Enabled" : "Disabled"}
                </span>
              </PreviewRow>
              {beneficiary && (
                <div className="py-3 text-sm">
                  <p className="text-ink-400">Beneficiary</p>
                  <p className="mt-1 break-all font-mono text-xs text-ink-300">{beneficiary}</p>
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-overlay/[0.08] pt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-ink-400">
                <span>Approval requirement</span>
                <span>{requiredApprovals} / {totalMembers} members</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill transition-all duration-300"
                  style={{ width: `${Math.min(100, approvalPct)}%` }}
                />
              </div>
            </div>
          </div>

          <RoleCard
            title="What your wallet is doing"
            description="The signer you connect is not a hidden super-admin. It becomes the first vault member and submits the setup transaction — nothing more."
            bullets={[
              "Counted in the approval threshold like every other member.",
              "No special withdrawal permissions over other members.",
              "Can create proposals and vote just like the rest of the group."
            ]}
          />

          <InfoCard
            title="How it works after creation"
            description="Members deposit sBTC, then create proposals when funds need to move. Every withdrawal, allocation, and member change requires a majority vote before it executes on-chain."
          />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-orange-400/30 bg-orange-400/10 text-xs font-bold text-orange-700 dark:text-orange-300">
        {n}
      </span>
      <h2 className="text-base font-semibold text-ink-50">{title}</h2>
    </div>
  );
}

function PreviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <span className="text-ink-400">{label}</span>
      {children}
    </div>
  );
}
