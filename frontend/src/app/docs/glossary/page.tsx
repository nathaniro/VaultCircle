import PageHeader from "@/components/PageHeader";
import DocsPager from "@/components/docs/DocsPager";
import { Section, Term } from "@/components/docs/Prose";

export const metadata = {
  title: "Glossary - VaultCircle"
};

export default function GlossaryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="Glossary"
        description="Plain-language definitions for every term you'll run into while using VaultCircle."
      />

      <Section>
        <Term term="Wallet">
          A browser extension (like Leather or Xverse) that generates and stores your keys, and shows
          you a popup to approve or reject any transaction before it&rsquo;s ever sent. VaultCircle can read
          your address and balance once connected, but it can never move funds without your explicit
          approval in the wallet itself.
        </Term>
        <Term term="Address">
          A public identifier for your wallet, similar to an account number. On Stacks Testnet,
          addresses start with &ldquo;ST&rdquo;. It&rsquo;s safe to share — it only lets people see your balance and send
          you funds, never withdraw anything.
        </Term>
        <Term term="Recovery (seed) phrase">
          A list of 12–24 words your wallet shows you once, during setup. Anyone who has it can fully
          control the wallet. Never share it, and never enter it anywhere except your wallet extension
          itself.
        </Term>
        <Term term="Testnet">
          A practice version of the Stacks blockchain. Assets on testnet have no real value and are free
          to obtain from a faucet — it exists so people can learn and test without financial risk. This
          deployment of VaultCircle runs on testnet.
        </Term>
        <Term term="Faucet">
          A free service that sends small amounts of testnet STX or sBTC to any address that requests
          them, so you have something to practice with.
        </Term>
        <Term term="sBTC">
          A token on the Stacks blockchain backed 1:1 by real Bitcoin. It&rsquo;s what VaultCircle vaults
          actually hold and move. On testnet, it has no real value.
        </Term>
        <Term term="STX">
          The native token of the Stacks blockchain, used to pay the small network fee required to
          submit any transaction (deposits, votes, proposals, etc.). You need a small amount of STX in
          your wallet even though the vault itself holds sBTC.
        </Term>
        <Term term="Transaction">
          Any action submitted to the blockchain — a deposit, a vote, creating a proposal, executing one.
          Each one needs your wallet&rsquo;s approval and a small STX fee, and takes roughly 30–90 seconds to
          confirm on testnet.
        </Term>
        <Term term="Vault">
          A shared treasury: a pool of sBTC controlled by a group of members, governed by an approval
          threshold. See How Vaults Work for the full mechanics.
        </Term>
        <Term term="Member">
          An address that&rsquo;s part of a vault. Members can deposit funds, create proposals, vote, and
          execute passed proposals. Every active member gets exactly one vote.
        </Term>
        <Term term="Approval threshold">
          The percentage of active members that must approve a proposal before it can execute. Set when
          the vault is created (51%–100%) and changeable later through its own proposal.
        </Term>
        <Term term="Proposal">
          A formal request to do something with the vault — withdraw funds, add a member, change the
          threshold, and so on. Nothing happens to a vault except through a proposal that members vote
          on. See Proposals, Explained for every type.
        </Term>
        <Term term="Execute">
          The final step after a proposal passes its vote. Passing and executing are separate actions —
          any member can submit the execution transaction once enough approvals are in, and that&rsquo;s the
          transaction that actually moves funds or changes vault state on-chain.
        </Term>
        <Term term="Contribution share">
          Your total deposits into a vault, divided by everyone&rsquo;s total deposits. Used for proportional
          payouts (like Share Distribution proposals); it does not affect voting power.
        </Term>
        <Term term="Zest">
          An external yield strategy a vault can optionally allocate idle funds into. See Zest Yield for
          details and guardrails.
        </Term>
        <Term term="Block">
          A batch of confirmed transactions on the blockchain. Voting durations and proposal expiry are
          measured in blocks rather than clock time — roughly 10 minutes per block on Stacks.
        </Term>
      </Section>

      <DocsPager prev={{ href: "/docs/yield", label: "Zest yield" }} next={{ href: "/docs/faq", label: "FAQ" }} />
    </>
  );
}
