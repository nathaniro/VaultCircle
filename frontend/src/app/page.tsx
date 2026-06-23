"use client";

import Link from "next/link";
import ActionPanel from "@/components/ActionPanel";
import InfoCard from "@/components/InfoCard";
import RoleCard from "@/components/RoleCard";
import { useWallet } from "@/lib/wallet";

const steps = [
  {
    title: "Create a shared vault",
    description: "A member creates a vault, sets the approval threshold, and invites the initial participants."
  },
  {
    title: "Contribute sBTC",
    description: "Members deposit sBTC into the vault, building a shared treasury with transparent balances."
  },
  {
    title: "Propose actions",
    description: "Any active member can propose a withdrawal, share distribution, threshold change, or Zest allocation."
  },
  {
    title: "Vote and execute",
    description: "Once enough members approve, the vault executes the proposal on-chain with the connected wallet."
  }
];

export default function LandingPage() {
  const { walletReady, connected, connect } = useWallet();

  return (
    <div className="page-wrap space-y-12 lg:space-y-16">
      <section className="hero-panel">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="eyebrow">Bitcoin DeFi Coordination</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-white md:text-6xl">
              Premium group treasury management for sBTC on Stacks Testnet.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              VaultCircle lets families, communities, founders, and on-chain teams pool sBTC into a
              shared vault where withdrawals require group approval before funds move.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {!walletReady ? (
                <>
                  <div className="h-12 w-44 rounded-full border border-white/10 bg-white/[0.04]" />
                  <div className="h-12 w-44 rounded-full border border-white/10 bg-white/[0.04]" />
                </>
              ) : connected ? (
                <>
                  <Link href="/create-vault" className="btn-primary">
                    Create Your First Vault
                  </Link>
                  <Link href="/vaults" className="btn-secondary">
                    Open Vault Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <button onClick={() => connect()} className="btn-primary">
                    Connect Wallet
                  </button>
                  <Link href="/create-vault" className="btn-secondary">
                    Preview Vault Creation
                  </Link>
                </>
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Xverse and Leather supported
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Testnet-first onboarding
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                Vote-gated treasury movement
              </span>
            </div>
          </div>

          <div className="surface-card">
            <p className="stat-label">Protocol Snapshot</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="surface-card-muted">
                <p className="stat-label">Primary Use Case</p>
                <p className="mt-2 text-lg font-semibold text-white">Shared vault treasury</p>
                <p className="mt-2 text-sm text-slate-400">Coordinate deposits, approvals, and payouts without a single controller.</p>
              </div>
              <div className="surface-card-muted">
                <p className="stat-label">Asset Layer</p>
                <p className="mt-2 text-lg font-semibold text-white">sBTC on Stacks</p>
                <p className="mt-2 text-sm text-slate-400">Keep Bitcoin-denominated treasury activity visible and programmable.</p>
              </div>
              <div className="surface-card-muted">
                <p className="stat-label">Governance Logic</p>
                <p className="mt-2 text-lg font-semibold text-white">51% to 100%</p>
                <p className="mt-2 text-sm text-slate-400">Each vault sets its own approval threshold for treasury actions.</p>
              </div>
              <div className="surface-card-muted">
                <p className="stat-label">Yield Option</p>
                <p className="mt-2 text-lg font-semibold text-white">Optional Zest path</p>
                <p className="mt-2 text-sm text-slate-400">Idle funds can be routed to Zest if members approve the allocation.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <RoleCard
          title="For savings groups"
          description="Create a transparent treasury for a family fund, rotating savings club, or community reserve."
          bullets={[
            "Every member sees the same vault balance and vote history.",
            "No organizer can withdraw alone once the threshold is set.",
            "Contribution share is recorded for later distribution."
          ]}
        />
        <RoleCard
          title="For teams and treasuries"
          description="Run an operational testnet treasury where spending requests are proposed and approved on-chain."
          bullets={[
            "Use proposals to manage payouts, membership changes, and treasury policies.",
            "Make the connected wallet act as a signer, not a hidden admin.",
            "Keep the approval trail readable for new contributors."
          ]}
        />
        <RoleCard
          title="For beginner users"
          description="The interface explains what a user is doing before each important contract interaction."
          bullets={[
            "Clear helper text before deposits, proposals, and approvals.",
            "Warnings for irreversible actions like closing a vault.",
            "Transaction status messaging after wallet actions succeed or fail."
          ]}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="surface-card">
          <p className="eyebrow">How It Works</p>
          <div className="mt-6 space-y-5">
            {steps.map((step, index) => (
              <div key={step.title} className="flex gap-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-200">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <InfoCard
            title="What the connected wallet does"
            tone="brand"
            description="The wallet you connect becomes your on-chain identity. It signs deposits, casts votes, creates proposals, and executes approved treasury actions."
          />
          <InfoCard
            title="What happens after a vote passes"
            description="A passed proposal is not finished until a member executes it. The app will show when a proposal is approved and prompt a signer to submit the execution transaction."
          />
          <InfoCard
            title="Why this feels safer than a group wallet spreadsheet"
            tone="success"
            description="Balances, contributions, approval thresholds, and proposal outcomes all live on-chain, so the treasury rules do not depend on memory, screenshots, or one operator."
          />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <InfoCard
          title="Protocol guarantees"
          description={
            <>
              VaultCircle keeps proposal payloads fixed after creation, enforces threshold math on-chain,
              and routes yield back to the group balance instead of individual claim accounts.
            </>
          }
        />
        <InfoCard
          title="Beginner note"
          tone="warning"
          description="This deployment runs on Stacks Testnet. Use testnet wallets and assets while learning the flow before any mainnet-style rollout."
        />
      </section>

      <ActionPanel
        title="Start with a vault creation walkthrough"
        description="The vault creation screen now explains the role of the connected wallet, the meaning of the threshold, and what the signer will approve when submitting the transaction."
        actions={
          !walletReady ? (
            <div className="h-12 w-40 rounded-full border border-white/10 bg-white/[0.04]" />
          ) : connected ? (
            <Link href="/create-vault" className="btn-primary">
              Create Vault
            </Link>
          ) : (
            <button onClick={() => connect()} className="btn-primary">
              Connect to Begin
            </button>
          )
        }
      />
    </div>
  );
}
