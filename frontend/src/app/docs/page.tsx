import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import InfoCard from "@/components/InfoCard";
import DocsPager from "@/components/docs/DocsPager";
import { H2, LI, P, Section, UL } from "@/components/docs/Prose";

export const metadata = {
  title: "Documentation - VaultCircle"
};

export default function DocsIndexPage() {
  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="What is VaultCircle?"
        description="A plain-language guide to pooling sBTC with a group, approving treasury moves by vote, and (optionally) putting idle funds to work — no blockchain background required."
      />

      <Section>
        <H2>The short version</H2>
        <P>
          VaultCircle is a shared treasury for groups. A family, a friend group, a small team, or a
          community can pool <strong className="text-ink-50">sBTC</strong> (a Bitcoin-backed token that
          runs on the Stacks blockchain) into a single <strong className="text-ink-50">vault</strong>.
          Nobody can move money out of the vault alone — every withdrawal, payout, or policy change has
          to be proposed and approved by a vote before it happens.
        </P>
        <P>
          Think of it like a joint bank account where every withdrawal needs several signatures, except
          the rules are enforced by code instead of a bank, and anyone in the group can check the balance
          and history at any time.
        </P>
      </Section>

      <Section>
        <H2>Why groups use it</H2>
        <UL>
          <LI>
            <strong className="text-ink-50">No single point of failure.</strong> The person who creates
            the vault does not get special withdrawal rights — they are just the first member.
          </LI>
          <LI>
            <strong className="text-ink-50">Transparent by default.</strong> Every member sees the same
            balance, the same contribution history, and the same vote record. Nothing lives in a
            spreadsheet or a screenshot.
          </LI>
          <LI>
            <strong className="text-ink-50">Flexible approval rules.</strong> Each vault sets its own
            approval threshold, from a simple majority up to requiring everyone to agree.
          </LI>
          <LI>
            <strong className="text-ink-50">Optional yield.</strong> A vault can vote to put idle funds
            to work through Zest, with any yield flowing back to the shared balance.
          </LI>
        </UL>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <InfoCard
          tone="brand"
          title="New to crypto wallets?"
          description="Start with Getting Started — it walks through installing a wallet, getting free testnet funds, and connecting, in order."
        />
        <InfoCard
          title="Already have a wallet connected?"
          description="Jump to How Vaults Work to understand deposits, proposals, and voting, or open the Vault Dashboard to create your first vault."
        />
      </div>

      <Section>
        <H2>This runs on Stacks Testnet</H2>
        <P>
          Everything in this deployment of VaultCircle uses <strong className="text-ink-50">Stacks
          Testnet</strong> — a practice network. The sBTC and STX used here are test assets with no real
          value, obtained for free from a faucet. That makes it a safe place to learn how the protocol
          works before any real funds are ever involved.
        </P>
        <Link href="/docs/getting-started" className="btn-primary inline-flex w-fit">
          Get started &rarr;
        </Link>
      </Section>

      <DocsPager next={{ href: "/docs/getting-started", label: "Getting started" }} />
    </>
  );
}
