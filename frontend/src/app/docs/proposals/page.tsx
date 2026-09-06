import PageHeader from "@/components/PageHeader";
import InfoCard from "@/components/InfoCard";
import DocsPager from "@/components/docs/DocsPager";
import { H2, P, Section, Term } from "@/components/docs/Prose";

export const metadata = {
  title: "Proposals - VaultCircle"
};

export default function ProposalsDocsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="Proposals, explained"
        description="Every treasury action goes through one of these proposal types. Here's what each one does, what it asks for, and any guardrails it enforces."
      />

      <Section>
        <H2>Moving funds</H2>
        <Term term="Single Withdrawal">
          Sends a specific amount of sBTC to one address — a member, or any external testnet address.
          Blocked if the amount requested is more than the vault&rsquo;s total value.
        </Term>
        <Term term="Share Distribution">
          Splits a specified amount of sBTC across all members proportionally to each member&rsquo;s
          contribution share, in a single proposal. Useful for payouts at the end of a savings cycle.
        </Term>
      </Section>

      <Section>
        <H2>Membership</H2>
        <Term term="Add Member">
          Adds a new address as an active vault member. Blocked if that address is already a member.
        </Term>
        <Term term="Remove Member">
          Removes an existing active member. A member cannot propose removing themselves — another
          active member has to propose it, so removal is always a group decision, not a unilateral one.
        </Term>
      </Section>

      <Section>
        <H2>Governance</H2>
        <Term term="Change Threshold">
          Changes the approval percentage required for future proposals, within the protocol&rsquo;s 51%–100%
          range. Takes effect immediately once executed.
        </Term>
        <Term term="Close Vault">
          Permanently archives the vault. Only allowed once the treasury balance is exactly zero sBTC —
          distribute or withdraw everything first. Once executed, the vault becomes read-only: no more
          deposits, proposals, or votes.
        </Term>
      </Section>

      <Section>
        <H2>Yield (Zest)</H2>
        <Term term="Deposit to Zest">
          Moves a portion of the vault&rsquo;s liquid balance into the Zest yield strategy. Only available if
          the vault enabled the yield path at creation. Two caps apply automatically: the vault can
          never allocate more than 70% of its total value to Zest, and must keep at least 30% liquid at
          all times.
        </Term>
        <Term term="Withdraw from Zest">
          Brings capital back from Zest into the vault&rsquo;s liquid balance. Blocked if the amount requested
          is larger than the vault&rsquo;s current Zest position.
        </Term>
      </Section>

      <InfoCard
        tone="warning"
        title="A reason is always required"
        description="Every proposal needs a short explanation of why it's needed, visible to the whole group before anyone votes — VaultCircle will not let a proposal be created without one."
      />

      <P>
        Whatever the type, the same rule always applies: a proposal only changes anything once it has
        enough approvals <em>and</em> a member submits the separate execution transaction. See{" "}
        <a href="/docs/how-it-works" className="font-semibold text-orange-700 underline dark:text-orange-300">
          How Vaults Work
        </a>{" "}
        for the full lifecycle.
      </P>

      <DocsPager
        prev={{ href: "/docs/how-it-works", label: "How vaults work" }}
        next={{ href: "/docs/yield", label: "Zest yield" }}
      />
    </>
  );
}
