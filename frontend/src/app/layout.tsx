import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";
import { ThemeProvider } from "@/lib/theme";
import Navbar from "@/components/Navbar";
import ProtocolNotice from "@/components/ProtocolNotice";
import WalletPickerModal from "@/components/WalletPickerModal";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const favicon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23020617'/%3E%3Crect x='2' y='2' width='60' height='60' rx='14' fill='none' stroke='%23f7931a' stroke-opacity='0.5'/%3E%3Ctext x='32' y='41' font-family='Arial,Helvetica,sans-serif' font-size='24' font-weight='700' fill='%23f7931a' text-anchor='middle'%3EVC%3C/text%3E%3C/svg%3E";

const themeInitScript = `(function(){try{var t=localStorage.getItem('vaultcircle.theme');if(t!=='light'&&t!=='dark'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';}document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){}})();`;

export const metadata: Metadata = {
  title: "VaultCircle - Group sBTC Savings",
  description: "Decentralized group savings vaults with sBTC, multisig approvals, and optional Zest yield",
  icons: {
    icon: favicon,
    shortcut: favicon
  },
  openGraph: {
    title: "VaultCircle",
    description: "Group sBTC treasuries on Stacks with vote-gated withdrawals and optional Zest yield.",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "VaultCircle",
    description: "Group sBTC treasuries on Stacks with vote-gated withdrawals and optional Zest yield."
  }
};

export const viewport: Viewport = {
  themeColor: "#020617"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="app-shell">
        <ThemeProvider>
          <WalletProvider>
            <a
              href="#main-content"
              className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-ink-50 transition focus-visible:translate-y-0"
            >
              Skip to content
            </a>
            <Navbar />
            <ProtocolNotice />
            <main id="main-content" className="min-h-screen">
              {children}
            </main>
            <WalletPickerModal />
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
