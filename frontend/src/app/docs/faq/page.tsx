import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import DocsPager from "@/components/docs/DocsPager";
import { QA, Section } from "@/components/docs/Prose";

export const metadata = {
  title: "FAQ - VaultCircle"
};

export default function FaqPage() {
  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="Frequently asked questions"
        description="Answers to the questions that come up most when trying VaultCircle for the first time."
      />

      <Section>
        <QA q="Is this real money?">
          No. This deployment runs on Stacks Testnet, a practice network. The sBTC and STX involved are
          test assets obtained free from a faucet and have no real-world value.
        </QA>
        <QA q="Why do I need STX if the vault holds sBTC?">
          Every blockchain transaction — a deposit, a vote, creating a proposal — needs a small STX fee
          to be processed by the network. sBTC is what the vault actually holds and moves; STX just pays
          for the transaction itself, similar to a stamp on an envelope.
        </QA>
        <QA q="Can the person who created the vault withdraw funds alone?">
          No. The creator is added as the first member with no special powers. They&rsquo;re counted in the
          approval threshold exactly like everyone else and cannot move funds without the group&rsquo;s vote.
        </QA>
        <QA q="What happens if a proposal doesn't get enough votes in time?">
          It expires and simply has no effect — the treasury stays exactly as it was. A new proposal can
          always be created afterward if the group still wants to take that action.
        </QA>
        <QA q="Can I remove myself from a vault?">
          No — removal always has to be proposed by another active member and approved by the group,
          the same as adding or removing anyone else. This prevents a member from unilaterally pulling
          themselves (and their voting weight) out at a moment that suits only them.
        </QA>
        <QA q="What if my wallet won't connect?">
          Make sure the extension is installed, unlocked, and switched to the Testnet network — a wallet
          set to Mainnet will not show a testnet balance. If it still doesn&rsquo;t connect, try disconnecting
          and reconnecting from the wallet menu in the top-right corner, or switching between Leather and
          Xverse if you have both installed.
        </QA>
        <QA q="Is my deposit and voting history private?">
          No — vault balances, member lists, contribution amounts, and proposal/vote history are all
          visible on-chain to anyone who looks up the vault. That transparency is intentional: it&rsquo;s what
          lets every member verify the treasury&rsquo;s state without trusting a single record-keeper.
        </QA>
        <QA q="What happens after I click 'Execute' on a passed proposal?">
          Your wallet asks you to sign one more transaction, which carries out the actual on-chain
          change (moving funds, updating membership, etc.). Any member can execute a passed proposal —
          it doesn&rsquo;t have to be the person who created it.
        </QA>
        <QA q="Can I get my sBTC back if I change my mind after depositing?">
          A deposit itself isn&rsquo;t reversible, but nothing stops the group from later approving a
          withdrawal or share-distribution proposal that returns funds — it just goes through the same
          vote as any other treasury action, rather than being an individual &ldquo;undo&rdquo; button.
        </QA>
      </Section>

      <p className="text-sm leading-7 text-ink-400">
        Question not covered here? Re-read{" "}
        <Link href="/docs/how-it-works" className="font-semibold text-orange-700 underline dark:text-orange-300">
          How Vaults Work
        </Link>{" "}
        or check the{" "}
        <Link href="/docs/glossary" className="font-semibold text-orange-700 underline dark:text-orange-300">
          Glossary
        </Link>{" "}
        for any unfamiliar term.
      </p>

      <DocsPager prev={{ href: "/docs/glossary", label: "Glossary" }} />
    </>
  );
}
