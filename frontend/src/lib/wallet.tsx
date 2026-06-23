"use client";

import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import {
  AppConfig,
  UserSession,
  clearSelectedProviderId,
  getSelectedProviderId,
  setSelectedProviderId,
  showConnect
} from "@stacks/connect";
import { APP_NETWORK } from "./contracts";
import { getSbtcBalance } from "./stacks";

export type WalletProviderId = "LeatherProvider" | "XverseProviders.StacksProvider";

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

interface WalletSnapshot {
  walletReady: boolean;
  connected: boolean;
  address: string | null;
  selectedWalletId: WalletProviderId | null;
  walletOptions: WalletOption[];
}

const appConfig = new AppConfig(["store_write", "publish_data"]);
export const userSession = new UserSession({ appConfig });
const appIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='24' fill='%230c1220'/%3E%3Cpath d='M32 34h16l16 40 16-40h16L72 94H56z' fill='%23f5c24b'/%3E%3C/svg%3E";

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

const WalletContext = createContext<WalletContextType>({
  walletReady: false,
  connected: false,
  address: null,
  sbtcBalance: 0,
  networkLabel: "Stacks Testnet",
  selectedWalletId: null,
  selectedWalletName: null,
  walletOptions: [],
  walletPickerOpen: false,
  connect: () => {},
  disconnect: () => {},
  openWalletPicker: () => {},
  closeWalletPicker: () => {}
});

function getSessionAddress(): string | null {
  try {
    const userData = userSession.loadUserData();
    return userData?.profile?.stxAddress?.testnet ?? null;
  } catch {
    return null;
  }
}

function getProviderFromWindow(id: WalletProviderId) {
  if (typeof window === "undefined") return null;
  return id.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return null;
    return (current as Record<string, unknown>)[key] ?? null;
  }, window as unknown as Record<string, unknown>);
}

function buildWalletOptions(): WalletOption[] {
  return WALLET_DEFINITIONS.map((wallet) => ({
    ...wallet,
    installed: Boolean(getProviderFromWindow(wallet.id))
  }));
}

function getDefaultWalletOptions(): WalletOption[] {
  return WALLET_DEFINITIONS.map((wallet) => ({
    ...wallet,
    installed: false
  }));
}

const DEFAULT_WALLET_SNAPSHOT: WalletSnapshot = {
  walletReady: false,
  connected: false,
  address: null,
  selectedWalletId: null,
  walletOptions: getDefaultWalletOptions()
};

function getWalletName(walletId: WalletProviderId | null) {
  return WALLET_DEFINITIONS.find((wallet) => wallet.id === walletId)?.name ?? null;
}

// Module-level cache so useSyncExternalStore gets the same reference when nothing changed.
// useSyncExternalStore uses Object.is to detect changes; a new object every render = infinite loop.
let _cachedSnapshot: WalletSnapshot = DEFAULT_WALLET_SNAPSHOT;

function snapshotsEqual(a: WalletSnapshot, b: WalletSnapshot): boolean {
  if (a.walletReady !== b.walletReady) return false;
  if (a.connected !== b.connected) return false;
  if (a.address !== b.address) return false;
  if (a.selectedWalletId !== b.selectedWalletId) return false;
  if (a.walletOptions.length !== b.walletOptions.length) return false;
  for (let i = 0; i < a.walletOptions.length; i++) {
    if (a.walletOptions[i].installed !== b.walletOptions[i].installed) return false;
  }
  return true;
}

function readWalletSnapshot(): WalletSnapshot {
  if (typeof window === "undefined") {
    return DEFAULT_WALLET_SNAPSHOT;
  }

  try {
    const signedIn = userSession.isUserSignedIn();
    const sessionAddress = signedIn ? getSessionAddress() : null;
    const walletId = getSelectedProviderId();
    const selectedWalletId =
      walletId === "LeatherProvider" || walletId === "XverseProviders.StacksProvider" ? walletId : null;

    const next: WalletSnapshot = {
      walletReady: true,
      connected: Boolean(sessionAddress),
      address: sessionAddress,
      selectedWalletId,
      walletOptions: buildWalletOptions()
    };

    if (snapshotsEqual(_cachedSnapshot, next)) return _cachedSnapshot;
    _cachedSnapshot = next;
    return _cachedSnapshot;
  } catch {
    const fallback: WalletSnapshot = { ...DEFAULT_WALLET_SNAPSHOT, walletReady: true };
    if (snapshotsEqual(_cachedSnapshot, fallback)) return _cachedSnapshot;
    _cachedSnapshot = fallback;
    return _cachedSnapshot;
  }
}

function subscribeToWalletSnapshot(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => onStoreChange();

  window.addEventListener("focus", handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener("focus", handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [sbtcBalance, setSbtcBalance] = useState(0);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [, setWalletVersion] = useState(0);
  const walletSnapshot = useSyncExternalStore(subscribeToWalletSnapshot, readWalletSnapshot, () => DEFAULT_WALLET_SNAPSHOT);
  const { walletReady, connected, address, selectedWalletId, walletOptions } = walletSnapshot;

  useEffect(() => {
    if (!address) return;
    getSbtcBalance(address).then(setSbtcBalance).catch(() => setSbtcBalance(0));
  }, [address]);

  const networkLabel = APP_NETWORK === "testnet" ? "Stacks Testnet" : APP_NETWORK;
  const selectedWalletName = getWalletName(selectedWalletId);

  const openWalletPicker = () => {
    setWalletPickerOpen(true);
  };

  const closeWalletPicker = () => setWalletPickerOpen(false);

  const connect = (walletId?: WalletProviderId) => {
    if (!walletId) {
      openWalletPicker();
      return;
    }

    setSelectedProviderId(walletId);
    setWalletPickerOpen(false);
    setWalletVersion((current) => current + 1);

    showConnect({
      appDetails: {
        name: "VaultCircle",
        icon: appIcon
      },
      redirectTo: "/",
      onFinish: () => {
        setWalletVersion((current) => current + 1);
      },
      userSession
    });
  };

  const disconnect = () => {
    userSession.signUserOut("/");
    clearSelectedProviderId();
    setSbtcBalance(0);
    setWalletVersion((current) => current + 1);
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
