import PageHeader from "@/components/PageHeader";
import InfoCard from "@/components/InfoCard";
import DocsPager from "@/components/docs/DocsPager";
import { H2, LI, P, Section, UL } from "@/components/docs/Prose";

export const metadata = {
  title: "Zest Yield - VaultCircle"
};

export default function YieldDocsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="Zest yield"
        description="How a vault can put idle sBTC to work, and why any yield it earns belongs to the whole group rather than individual members."
      />

      <Section>
        <H2>What Zest is</H2>
        <P>
          Zest is an external yield strategy a vault can optionally route part of its idle balance
          into, so funds sitting unused in the vault can still earn something instead of doing nothing.
          It&rsquo;s entirely opt-in: a vault only touches Zest if the group explicitly votes to enable it and
          then votes on each allocation.
        </P>
      </Section>

      <Section>
        <H2>Reward Model A: yield stays shared</H2>
        <P>
          VaultCircle deliberately does not give individual members a private claim on yield. Whatever a
          vault earns through Zest flows back into the vault&rsquo;s total value — the same balance every
          member&rsquo;s contribution share is measured against. Nobody can withdraw &ldquo;their&rdquo; yield
          separately; it&rsquo;s distributed the same way any other treasury action is, through a proposal
          the group votes on.
        </P>
        <InfoCard
          tone="success"
          title="Why this matters"
          description="It keeps the treasury's accounting simple and prevents yield from quietly concentrating with whoever deposited earliest or largest — the whole group benefits from a good position, and the whole group is exposed to a bad one."
        />
      </Section>

      <Section>
        <H2>The guardrails</H2>
        <P>Every Zest allocation is checked against two protocol-enforced limits before it can execute:</P>
        <UL>
          <LI>
            <strong className="text-ink-50">Maximum allocation: 70%</strong> of the vault&rsquo;s total
            value. A vault can never move more than this into Zest, no matter what a proposal asks for.
          </LI>
          <LI>
            <strong className="text-ink-50">Minimum liquid reserve: 30%</strong> of total value must
            always stay immediately available inside the vault contract.
          </LI>
        </UL>
        <P>
          Together these mean a vault can never allocate itself into a position where it has no liquid
          funds left for a withdrawal proposal to draw from.
        </P>
      </Section>

      <Section>
        <H2>Syncing a position</H2>
        <P>
          Once a vault has an active Zest position, its value can grow over time as yield accrues. That
          growth isn&rsquo;t reflected in the vault&rsquo;s displayed numbers automatically — any member can submit
          a <strong className="text-ink-50">Sync</strong> transaction from the vault&rsquo;s Yield page, which
          refreshes the on-chain record to match Zest&rsquo;s current position value.
        </P>
      </Section>

      <InfoCard
        tone="warning"
        title="Live Zest execution may be disabled on this deployment"
        description="Whether Zest allocations actually execute against the live Zest protocol depends on this deployment's configuration. If live mode is off, the yield flow, proposals, and guardrails above still work exactly as described — allocations just don't route to an external strategy yet. The Yield page for each vault shows the current mode."
      />

      <DocsPager
        prev={{ href: "/docs/proposals", label: "Proposals, explained" }}
        next={{ href: "/docs/glossary", label: "Glossary" }}
      />
    </>
  );
}
