import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";
import Navbar from "@/components/Navbar";
import ProtocolNotice from "@/components/ProtocolNotice";
import WalletPickerModal from "@/components/WalletPickerModal";

export const metadata: Metadata = {
  title: "VaultCircle - Group sBTC Savings",
  description: "Decentralized group savings vaults with sBTC, multisig approvals, and optional Zest yield"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="app-shell">
        <WalletProvider>
          <Navbar />
          <ProtocolNotice />
          <main className="min-h-screen">{children}</main>
          <WalletPickerModal />
        </WalletProvider>
      </body>
    </html>
  );
}
