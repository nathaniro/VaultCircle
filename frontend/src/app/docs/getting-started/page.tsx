import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import InfoCard from "@/components/InfoCard";
import DocsPager from "@/components/docs/DocsPager";
import { OL, P, Section, Step } from "@/components/docs/Prose";

export const metadata = {
  title: "Getting Started - VaultCircle"
};

export default function GettingStartedPage() {
  return (
    <>
      <PageHeader
        eyebrow="Documentation"
        title="Getting started"
        description="Five steps from 'never used a crypto wallet' to your first vault deposit. Each step explains what you're doing and why."
      />

      <Section>
        <OL>
          <Step n={1} title="Install a Stacks wallet">
            <P>
              A wallet is a browser extension that holds your keys and signs transactions on your
              behalf — VaultCircle never touches your keys directly. Install one of:
            </P>
            <ul className="mt-2 space-y-1">
              <li>
                <a href="https://leather.io/install-extension" target="_blank" rel="noreferrer" className="font-semibold text-orange-700 underline dark:text-orange-300">
                  Leather Wallet
                </a>
              </li>
              <li>
                <a href="https://www.xverse.app/download" target="_blank" rel="noreferrer" className="font-semibold text-orange-700 underline dark:text-orange-300">
                  Xverse Wallet
                </a>
              </li>
            </ul>
            <P>
              Follow the extension&rsquo;s own setup flow to create a wallet and write down its recovery
              (seed) phrase.
            </P>
          </Step>

          <Step n={2} title="Switch the wallet to Testnet">
            <P>
              Open your wallet extension&rsquo;s network settings and switch from &ldquo;Mainnet&rdquo; to
              &ldquo;Testnet&rdquo;. VaultCircle only works with testnet addresses — if the wallet stays
              on Mainnet, VaultCircle will not be able to read a balance for it.
            </P>
          </Step>

          <Step n={3} title="Get free testnet funds">
            <P>
              Testnet STX and sBTC have no real value — they exist purely for practicing. Get some from
              the Stacks testnet faucet:
            </P>
            <a
              href="https://explorer.hiro.so/sandbox/faucet?chain=testnet"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex font-semibold text-orange-700 underline dark:text-orange-300"
            >
              explorer.hiro.so/sandbox/faucet
            </a>
            <P>
              Paste in your wallet&rsquo;s testnet address (copy it from the wallet extension) and request
              funds. You&rsquo;ll want a small amount of STX (covers transaction fees) and some testnet sBTC
              (what you&rsquo;ll actually deposit into a vault).
            </P>
          </Step>

          <Step n={4} title="Connect your wallet to VaultCircle">
            <P>
              Click <strong className="text-ink-50">Connect Wallet</strong> in the top-right corner of
              any page. Choose Leather or Xverse, then approve the connection request the extension
              shows you. VaultCircle will display your address and sBTC balance once connected.
            </P>
          </Step>

          <Step n={5} title="Join or create a vault">
            <P>
              If someone already invited you to a vault, they add your address as a member through a
              proposal — once approved, it appears in your{" "}
              <Link href="/vaults" className="font-semibold text-orange-700 underline dark:text-orange-300">
                Dashboard
              </Link>{" "}
              automatically. If you&rsquo;re starting a new group treasury, use{" "}
              <Link href="/create-vault" className="font-semibold text-orange-700 underline dark:text-orange-300">
                Create Vault
              </Link>{" "}
              — you&rsquo;ll name it, invite the first members, and set an approval threshold.
            </P>
          </Step>
        </OL>
      </Section>

      <InfoCard
        tone="warning"
        title="Keep your recovery phrase private"
        description="Anyone with your wallet's recovery phrase can control its funds. VaultCircle will never ask you for it — the only thing you ever approve is a transaction popup inside your wallet extension itself."
      />

      <DocsPager
        prev={{ href: "/docs", label: "What is VaultCircle?" }}
        next={{ href: "/docs/how-it-works", label: "How vaults work" }}
      />
    </>
  );
}
