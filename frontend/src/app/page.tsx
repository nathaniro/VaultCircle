"use client";

import Link from "next/link";
import ActionPanel from "@/components/ActionPanel";
import InfoCard from "@/components/InfoCard";
import LiveStats from "@/components/LiveStats";
import Reveal from "@/components/Reveal";
import RoleCard from "@/components/RoleCard";
import ThresholdPreview from "@/components/ThresholdPreview";
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
        <div className="hero-orb -left-20 -top-24 h-72 w-72 bg-orange-400/20" style={{ animationDelay: "-4s" }} />
        <div className="hero-orb hero-orb-reverse bottom-0 right-0 h-64 w-64 bg-emerald-400/10" style={{ animationDelay: "-9s" }} />

        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="eyebrow">Bitcoin DeFi Coordination</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-ink-50 md:text-6xl">
              Premium group treasury management for sBTC on Stacks Testnet.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-300">
              VaultCircle lets families, communities, founders, and on-chain teams pool sBTC into a
              shared vault where withdrawals require group approval before funds move.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {!walletReady ? (
                <>
                  <div className="h-12 w-44 rounded-full border border-overlay/10 bg-overlay/[0.04]" />
                  <div className="h-12 w-44 rounded-full border border-overlay/10 bg-overlay/[0.04]" />
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

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-ink-400">
              <span className="rounded-full border border-overlay/10 bg-overlay/[0.04] px-4 py-2">
                Xverse and Leather supported
              </span>
              <span className="rounded-full border border-overlay/10 bg-overlay/[0.04] px-4 py-2">
                Testnet-first onboarding
              </span>
              <span className="rounded-full border border-overlay/10 bg-overlay/[0.04] px-4 py-2">
                Vote-gated treasury movement
              </span>
            </div>

            <p className="mt-6 text-sm text-ink-400">
              New to crypto wallets?{" "}
              <Link href="/docs/getting-started" className="font-semibold text-orange-700 underline dark:text-orange-300">
                Read the step-by-step guide
              </Link>{" "}
              before connecting.
            </p>
          </div>

          <ThresholdPreview />
        </div>
      </section>

      <Reveal>
        <section>
          <div className="mb-6 flex items-center gap-3">
            <span className="glow-dot bg-emerald-400" />
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink-400">Live on Stacks Testnet</p>
          </div>
          <LiveStats />
        </section>
      </Reveal>

      <section className="grid gap-6 lg:grid-cols-3">
        <Reveal delay={0}>
          <RoleCard
            title="For savings groups"
            description="Create a transparent treasury for a family fund, rotating savings club, or community reserve."
            bullets={[
              "Every member sees the same vault balance and vote history.",
              "No organizer can withdraw alone once the threshold is set.",
              "Contribution share is recorded for later distribution."
            ]}
          />
        </Reveal>
        <Reveal delay={80}>
          <RoleCard
            title="For teams and treasuries"
            description="Run an operational testnet treasury where spending requests are proposed and approved on-chain."
            bullets={[
              "Use proposals to manage payouts, membership changes, and treasury policies.",
              "Make the connected wallet act as a signer, not a hidden admin.",
              "Keep the approval trail readable for new contributors."
            ]}
          />
        </Reveal>
        <Reveal delay={160}>
          <RoleCard
            title="For beginner users"
            description="The interface explains what a user is doing before each important contract interaction."
            bullets={[
              "Clear helper text before deposits, proposals, and approvals.",
              "Warnings for irreversible actions like closing a vault.",
              "A full documentation section covering every step, term, and question."
            ]}
          />
        </Reveal>
      </section>

      <Reveal>
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="surface-card">
            <p className="eyebrow">How It Works</p>
            <div className="relative mt-6 space-y-5">
              <div className="absolute bottom-5 left-9 top-5 hidden w-px bg-gradient-to-b from-orange-400/40 via-overlay/10 to-transparent sm:block" />
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className="relative flex gap-4 rounded-2xl border border-overlay/10 bg-ink-950/50 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-orange-400/25"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 text-sm font-semibold text-orange-800 dark:text-orange-200">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-ink-50">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-400">{step.description}</p>
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
      </Reveal>

      <Reveal>
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
      </Reveal>

      <Reveal>
        <ActionPanel
          title="Start with a vault creation walkthrough"
          description="The vault creation screen now explains the role of the connected wallet, the meaning of the threshold, and what the signer will approve when submitting the transaction."
          actions={
            <>
              {!walletReady ? (
                <div className="h-12 w-40 rounded-full border border-overlay/10 bg-overlay/[0.04]" />
              ) : connected ? (
                <Link href="/create-vault" className="btn-primary">
                  Create Vault
                </Link>
              ) : (
                <button onClick={() => connect()} className="btn-primary">
                  Connect to Begin
                </button>
              )}
              <Link href="/docs" className="btn-secondary">
                Read the Docs
              </Link>
            </>
          }
        />
      </Reveal>
    </div>
  );
}
