import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import InfoCard from "@/components/InfoCard";
import DocsPager from "@/components/docs/DocsPager";
import { H2, H3, LI, P, Section, UL } from "@/components/docs/Prose";

export const metadata = {
  title: "How Vaults Work - VaultCircle"
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="How vaults work"
        description="The mechanics behind deposits, membership, approval thresholds, and how a treasury action actually moves funds."
      />

      <Section>
        <H2>Vaults and members</H2>
        <P>
          A <strong className="text-ink-50">vault</strong> is a shared treasury contract. It has a name,
          a list of members, and a total balance made up of everyone&rsquo;s deposits. Anyone can create a
          vault; the creator becomes its first member with no special powers — they are counted in the
          approval threshold exactly like everyone else, and cannot withdraw funds alone.
        </P>
        <P>
          A vault supports up to <strong className="text-ink-50">11 members</strong> (the creator plus
          10 invited at creation, or added later through a proposal). Membership can also change after
          launch — adding or removing a member always requires a vote, the same as any other treasury
          action.
        </P>
      </Section>

      <Section>
        <H2>Deposits and contribution share</H2>
        <P>
          Once you&rsquo;re a member, you can deposit sBTC into the vault at any time from the{" "}
          <strong className="text-ink-50">Deposit</strong> page. Each deposit does two things: it adds
          to the vault&rsquo;s liquid balance, and it adds to your personal contribution record.
        </P>
        <P>
          Your <strong className="text-ink-50">share</strong> is your contribution divided by the
          vault&rsquo;s total contributions. Share does not grant extra voting power — every active member
          gets one vote regardless of how much they&rsquo;ve deposited — but it matters for proposals that
          distribute funds proportionally (like &ldquo;Share Distribution&rdquo; withdrawals or close-out
          payouts).
        </P>
      </Section>

      <Section>
        <H2>The approval threshold</H2>
        <P>
          When a vault is created, it&rsquo;s given an approval threshold between{" "}
          <strong className="text-ink-50">51% and 100%</strong> of active members (the default is
          70%). This single number governs every treasury action from that point on — withdrawals,
          member changes, yield allocation, even changing the threshold itself.
        </P>
        <P>
          The required number of approvals is the threshold applied to the current member count,
          rounded up. For example, a 5-member vault at a 70% threshold needs{" "}
          <strong className="text-ink-50">4 approvals</strong> (5 &times; 0.7 = 3.5, rounded up to 4) —
          not a simple majority, but not unanimous either.
        </P>
        <InfoCard
          tone="brand"
          title="Why round up?"
          description="Rounding up means the threshold you set is always honored at minimum — a vault can never execute an action with fewer approvals than the percentage implies."
        />
      </Section>

      <Section>
        <H2>The proposal lifecycle</H2>
        <P>
          Nothing moves in or out of a vault except through a proposal. The flow is always the same
          four stages:
        </P>
        <UL>
          <LI>
            <strong className="text-ink-50">Proposed</strong> — an active member describes the action
            (a withdrawal, a membership change, a yield move, etc.), gives a reason, and sets how long
            voting stays open (roughly 1 to 30 days).
          </LI>
          <LI>
            <strong className="text-ink-50">Active</strong> — other members review it and vote to
            approve or reject. Each member votes once.
          </LI>
          <LI>
            <strong className="text-ink-50">Passed or Rejected</strong> — once enough approvals arrive
            to meet the threshold, the proposal is marked <em>Passed</em> and is ready to run. If it
            expires first without enough approvals, it&rsquo;s marked <em>Expired</em> instead.
          </LI>
          <LI>
            <strong className="text-ink-50">Executed</strong> — a passed proposal still needs one more
            step: any member submits an execution transaction that actually carries out the action
            on-chain. Passing a vote and executing it are deliberately separate, so the final on-chain
            change always happens as its own visible transaction.
          </LI>
        </UL>
        <Link href="/docs/proposals" className="inline-flex font-semibold text-orange-700 underline dark:text-orange-300">
          See every proposal type in detail &rarr;
        </Link>
      </Section>

      <Section>
        <H3>Closing a vault</H3>
        <P>
          A vault can be closed permanently through a &ldquo;Close Vault&rdquo; proposal, but only once
          its treasury balance is exactly zero — every member needs to withdraw or distribute the
          remaining funds first. Once closed, the vault becomes a read-only historical record: no more
          deposits, proposals, votes, or executions.
        </P>
      </Section>

      <DocsPager
        prev={{ href: "/docs/getting-started", label: "Getting started" }}
        next={{ href: "/docs/proposals", label: "Proposals, explained" }}
      />
    </>
  );
}
