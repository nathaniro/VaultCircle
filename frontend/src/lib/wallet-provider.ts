import { getSelectedProviderId, setSelectedProviderId, type StacksProvider } from "@stacks/connect";
import { debugLog } from "./debug";

export type WalletProviderId = "LeatherProvider" | "XverseProviders.StacksProvider";

type ConnectCompatibleProvider = StacksProvider & {
  id?: string;
  isLeather?: boolean;
};

const SUPPORTED_WALLET_PROVIDER_IDS: WalletProviderId[] = [
  "LeatherProvider",
  "XverseProviders.StacksProvider"
];

const APP_SELECTED_WALLET_KEY = "vaultcircle.selected-wallet-provider";

function logWalletProvider(message: string, details?: Record<string, unknown>) {
  debugLog("WalletProvider", message, details);
}

function isSupportedWalletProviderId(value: string | null | undefined): value is WalletProviderId {
  return value === "LeatherProvider" || value === "XverseProviders.StacksProvider";
}

function readWindowPath(path: string): unknown {
  if (typeof window === "undefined") return null;

  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return null;
    return (current as Record<string, unknown>)[key] ?? null;
  }, window as unknown);
}

function isConnectCompatibleProvider(provider: unknown): provider is ConnectCompatibleProvider {
  if (!provider || typeof provider !== "object") return false;

  const candidate = provider as Partial<ConnectCompatibleProvider>;
  return (
    typeof candidate.authenticationRequest === "function" &&
    typeof candidate.transactionRequest === "function"
  );
}

function resolveLeatherProvider(): ConnectCompatibleProvider | null {
  if (typeof window === "undefined") return null;

  const candidates = [
    readWindowPath("LeatherProvider"),
    readWindowPath("HiroWalletProvider"),
    readWindowPath("StacksProvider")
  ];

  for (const candidate of candidates) {
    if (!isConnectCompatibleProvider(candidate)) continue;
    if (candidate.isLeather) return candidate;
    if ((candidate.id ?? "") === "LeatherProvider") return candidate;
  }

  return null;
}

function resolveXverseProvider(): ConnectCompatibleProvider | null {
  const provider = readWindowPath("XverseProviders.StacksProvider");
  return isConnectCompatibleProvider(provider) ? provider : null;
}

export function resolveWalletProviderById(walletId: WalletProviderId): ConnectCompatibleProvider | null {
  const provider = walletId === "LeatherProvider" ? resolveLeatherProvider() : resolveXverseProvider();
  logWalletProvider("resolveWalletProviderById()", {
    walletId,
    found: Boolean(provider),
    providerId: provider?.id ?? null,
    isLeather: Boolean(provider?.isLeather),
    hasRequest: Boolean(provider && typeof provider.request === "function")
  });
  return provider;
}

export function getInstalledWalletProviderIds(): WalletProviderId[] {
  const installedProviderIds = SUPPORTED_WALLET_PROVIDER_IDS.filter((walletId) => Boolean(resolveWalletProviderById(walletId)));
  logWalletProvider("getInstalledWalletProviderIds()", { installedProviderIds });
  return installedProviderIds;
}

function readAppSelectedWalletProviderId(): WalletProviderId | null {
  if (typeof window === "undefined") return null;

  const value = window.localStorage.getItem(APP_SELECTED_WALLET_KEY);
  return isSupportedWalletProviderId(value) ? value : null;
}

export function getSelectedWalletProviderId(): WalletProviderId | null {
  const appSelection = readAppSelectedWalletProviderId();
  if (appSelection && resolveWalletProviderById(appSelection)) {
    logWalletProvider("getSelectedWalletProviderId(): using app selection", { appSelection });
    return appSelection;
  }

  const stacksSelection = getSelectedProviderId();
  if (isSupportedWalletProviderId(stacksSelection) && resolveWalletProviderById(stacksSelection)) {
    logWalletProvider("getSelectedWalletProviderId(): using stacks selection", { stacksSelection });
    return stacksSelection;
  }

  const installedProviders = getInstalledWalletProviderIds();
  const fallbackSelection = installedProviders.length === 1 ? installedProviders[0] : null;
  logWalletProvider("getSelectedWalletProviderId(): fallback resolution", {
    appSelection,
    stacksSelection: stacksSelection ?? null,
    installedProviders,
    fallbackSelection
  });
  return fallbackSelection;
}

export function setAppSelectedWalletProviderId(walletId: WalletProviderId) {
  logWalletProvider("setAppSelectedWalletProviderId()", { walletId });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(APP_SELECTED_WALLET_KEY, walletId);
  }

  setSelectedProviderId(walletId);
}

export function clearAppSelectedWalletProviderId() {
  logWalletProvider("clearAppSelectedWalletProviderId()");
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(APP_SELECTED_WALLET_KEY);
  }
}

export function getSelectedWalletProvider(): ConnectCompatibleProvider | undefined {
  const walletId = getSelectedWalletProviderId();
  if (!walletId) {
    logWalletProvider("getSelectedWalletProvider(): no selected wallet id");
    return undefined;
  }

  const provider = resolveWalletProviderById(walletId) ?? undefined;
  logWalletProvider("getSelectedWalletProvider()", {
    walletId,
    found: Boolean(provider),
    providerId: provider?.id ?? null,
    isLeather: Boolean(provider?.isLeather)
  });
  return provider;
}
