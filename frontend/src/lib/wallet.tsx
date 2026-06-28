"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { clearSelectedProviderId, showConnect } from "@stacks/connect";
import { APP_NETWORK } from "./contracts";
import { debugLog } from "./debug";
import { getSbtcBalance } from "./stacks";
import { APP_DETAILS, repairUserSessionStorage, resetUserSessionStorage, userSession } from "./app-session";
import {
  clearAppSelectedWalletProviderId,
  getInstalledWalletProviderIds,
  getSelectedWalletProviderId,
  resolveWalletProviderById,
  setAppSelectedWalletProviderId,
  type WalletProviderId
} from "./wallet-provider";

export type { WalletProviderId } from "./wallet-provider";

export interface WalletOption {
  id: WalletProviderId;
  name: string;
  description: string;
  installUrl: string;
  installed: boolean;
}

interface WalletContextType {
  walletReady: boolean;
  connected: boolean;
  address: string | null;
  sbtcBalance: number;
  networkLabel: string;
  selectedWalletId: WalletProviderId | null;
  selectedWalletName: string | null;
  walletOptions: WalletOption[];
  walletPickerOpen: boolean;
  connect: (walletId?: WalletProviderId) => void;
  disconnect: () => void;
  openWalletPicker: () => void;
  closeWalletPicker: () => void;
}

const WALLET_DEFINITIONS = [
  {
    id: "LeatherProvider" as const,
    name: "Leather",
    description: "Connect the Leather extension to sign Stacks Testnet transactions.",
    installUrl: "https://leather.io/install-extension"
  },
  {
    id: "XverseProviders.StacksProvider" as const,
    name: "Xverse",
    description: "Connect Xverse to create vaults and approve group actions on testnet.",
    installUrl: "https://www.xverse.app/download"
  }
];

const defaultWalletOptions: WalletOption[] = WALLET_DEFINITIONS.map((wallet) => ({
  ...wallet,
  installed: false
}));

function logWallet(message: string, details?: Record<string, unknown>) {
  debugLog("Wallet", message, details);
}

function getUserSignedInState() {
  repairUserSessionStorage();

  try {
    return userSession.isUserSignedIn();
  } catch (error) {
    console.error("[VaultCircle][Wallet] getUserSignedInState(): failed to inspect session", error);
    resetUserSessionStorage();
    return false;
  }
}

const WalletContext = createContext<WalletContextType>({
  walletReady: false,
  connected: false,
  address: null,
  sbtcBalance: 0,
  networkLabel: "Stacks Testnet",
  selectedWalletId: null,
  selectedWalletName: null,
  walletOptions: defaultWalletOptions,
  walletPickerOpen: false,
  connect: () => {},
  disconnect: () => {},
  openWalletPicker: () => {},
  closeWalletPicker: () => {}
});

function getSessionAddress(): string | null {
  if (!getUserSignedInState()) {
    logWallet("getSessionAddress(): user not signed in");
    return null;
  }

  try {
    const userData = userSession.loadUserData();
    const networkKey: "mainnet" | "testnet" = APP_NETWORK;
    const address = userData?.profile?.stxAddress?.[networkKey] ?? null;
    logWallet("getSessionAddress(): loaded session address", {
      networkKey,
      address
    });
    return address;
  } catch (error) {
    console.error("[VaultCircle][Wallet] getSessionAddress(): failed to load user data", error);
    resetUserSessionStorage();
    return null;
  }
}

function getWalletName(walletId: WalletProviderId | null) {
  return WALLET_DEFINITIONS.find((wallet) => wallet.id === walletId)?.name ?? null;
}

function buildWalletOptions(): WalletOption[] {
  const installedProviders = new Set(getInstalledWalletProviderIds());
  return WALLET_DEFINITIONS.map((wallet) => ({
    ...wallet,
    installed: installedProviders.has(wallet.id)
  }));
}

function getCurrentRoute() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletReady, setWalletReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [sbtcBalance, setSbtcBalance] = useState(0);
  const [selectedWalletId, setSelectedWalletId] = useState<WalletProviderId | null>(null);
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>(defaultWalletOptions);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);

  const refreshWalletState = useCallback(async () => {
    const signedIn = getUserSignedInState();
    logWallet("refreshWalletState(): start", {
      isUserSignedIn: signedIn,
      isSignInPending: userSession.isSignInPending()
    });
    const nextSelectedWalletId = getSelectedWalletProviderId();
    const nextAddress = getSessionAddress();
    const nextWalletOptions = buildWalletOptions();

    setSelectedWalletId(nextSelectedWalletId);
    setWalletOptions(nextWalletOptions);
    setConnected(Boolean(nextAddress));
    setAddress(nextAddress);
    setWalletReady(true);
    logWallet("refreshWalletState(): session snapshot", {
      nextSelectedWalletId,
      nextAddress,
      installedWalletOptions: nextWalletOptions.map((wallet) => ({
        id: wallet.id,
        installed: wallet.installed
      }))
    });

    if (!nextAddress) {
      logWallet("refreshWalletState(): no address found, resetting sBTC balance");
      setSbtcBalance(0);
      return;
    }

    try {
      const balance = await getSbtcBalance(nextAddress);
      logWallet("refreshWalletState(): fetched sBTC balance", {
        address: nextAddress,
        balance
      });
      setSbtcBalance(balance);
    } catch (error) {
      console.error("[VaultCircle][Wallet] refreshWalletState(): failed to fetch sBTC balance", error);
      setSbtcBalance(0);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const syncWalletState = async () => {
      try {
        if (userSession.isSignInPending()) {
          logWallet("syncWalletState(): found pending sign-in response, handling it now");
          await userSession.handlePendingSignIn();
          logWallet("syncWalletState(): handlePendingSignIn() resolved");
        }
      } catch (error) {
        console.error("[VaultCircle][Wallet] syncWalletState(): handlePendingSignIn() failed", error);
        resetUserSessionStorage();
      }

      if (!active) return;
      await refreshWalletState();
    };

    void syncWalletState();

    const handleBrowserSync = () => {
      void refreshWalletState();
    };

    window.addEventListener("focus", handleBrowserSync);
    window.addEventListener("storage", handleBrowserSync);

    return () => {
      active = false;
      window.removeEventListener("focus", handleBrowserSync);
      window.removeEventListener("storage", handleBrowserSync);
    };
  }, [refreshWalletState]);

  const networkLabel = APP_NETWORK === "testnet" ? "Stacks Testnet" : APP_NETWORK;
  const selectedWalletName = getWalletName(selectedWalletId);

  const openWalletPicker = () => {
    logWallet("openWalletPicker()");
    setWalletOptions(buildWalletOptions());
    setWalletPickerOpen(true);
  };

  const closeWalletPicker = () => {
    logWallet("closeWalletPicker()");
    setWalletPickerOpen(false);
  };

  const connect = (walletId?: WalletProviderId) => {
    logWallet("connect(): invoked", {
      walletId: walletId ?? null,
      currentSelectedWalletId: selectedWalletId,
      walletReady,
      connected,
      address
    });

    if (!walletId) {
      openWalletPicker();
      return;
    }

    const provider = resolveWalletProviderById(walletId);
    logWallet("connect(): resolved provider", {
      walletId,
      providerFound: Boolean(provider),
      providerId: provider?.id ?? null,
      isLeather: Boolean(provider?.isLeather)
    });
    setAppSelectedWalletProviderId(walletId);
    setSelectedWalletId(walletId);
    setWalletOptions(buildWalletOptions());
    setWalletPickerOpen(false);

    if (!provider) {
      console.warn("[VaultCircle][Wallet] connect(): provider missing after selection");
      void refreshWalletState();
      return;
    }

    logWallet("connect(): calling showConnect()", {
      walletId,
      redirectTo: getCurrentRoute()
    });
    try {
      showConnect(
        {
          appDetails: APP_DETAILS,
          redirectTo: getCurrentRoute(),
          onFinish: () => {
            logWallet("connect(): showConnect() onFinish callback fired", { walletId });
            void refreshWalletState();
          },
          onCancel: () => {
            console.warn("[VaultCircle][Wallet] connect(): showConnect() onCancel callback fired", { walletId });
            void refreshWalletState();
          },
          userSession
        },
        provider
      );
      logWallet("connect(): showConnect() invoked successfully", { walletId });
    } catch (error) {
      console.error("[VaultCircle][Wallet] connect(): showConnect() threw synchronously", error);
      void refreshWalletState();
    }
  };

  const disconnect = () => {
    logWallet("disconnect()", {
      selectedWalletId,
      address
    });
    userSession.signUserOut(getCurrentRoute());
    clearAppSelectedWalletProviderId();
    clearSelectedProviderId();
    setConnected(false);
    setAddress(null);
    setSelectedWalletId(null);
    setSbtcBalance(0);
    setWalletOptions(buildWalletOptions());
    setWalletReady(true);
  };

  return (
    <WalletContext.Provider
      value={{
        walletReady,
        connected,
        address,
        sbtcBalance,
        networkLabel,
        selectedWalletId,
        selectedWalletName,
        walletOptions,
        walletPickerOpen,
        connect,
        disconnect,
        openWalletPicker,
        closeWalletPicker
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
