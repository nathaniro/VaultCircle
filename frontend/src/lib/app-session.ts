import { AppConfig, UserSession } from "@stacks/connect";

const appConfig = new AppConfig(["store_write", "publish_data"]);
const SESSION_VERSION = "1.0.0";
const APP_SESSION_STORAGE_KEY = "vaultcircle.blockstack-session";
const LEGACY_SESSION_STORAGE_KEY = "blockstack-session";

function isSupportedSessionData(value: unknown): value is { version: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "version" in value &&
      (value as { version?: unknown }).version === SESSION_VERSION
  );
}

function parseStoredSession(raw: string | null): unknown {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeEmptySession() {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    APP_SESSION_STORAGE_KEY,
    JSON.stringify({
      version: SESSION_VERSION,
      etags: {}
    })
  );
}

function bootstrapAppSessionStorage() {
  if (typeof window === "undefined") return;

  const appSession = parseStoredSession(window.localStorage.getItem(APP_SESSION_STORAGE_KEY));
  if (isSupportedSessionData(appSession)) {
    return;
  }

  if (appSession) {
    console.warn("[VaultCircle][Session] Resetting invalid app session storage payload.");
  }

  const legacySession = parseStoredSession(window.localStorage.getItem(LEGACY_SESSION_STORAGE_KEY));
  if (isSupportedSessionData(legacySession)) {
    window.localStorage.setItem(APP_SESSION_STORAGE_KEY, JSON.stringify(legacySession));
    return;
  }

  writeEmptySession();
}

export function repairUserSessionStorage() {
  bootstrapAppSessionStorage();
}

export function resetUserSessionStorage() {
  writeEmptySession();
}

bootstrapAppSessionStorage();

export const userSession = new UserSession({
  appConfig,
  sessionOptions: {
    storeOptions: {
      localStorageKey: APP_SESSION_STORAGE_KEY
    }
  }
});

const appIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='24' fill='%230c1220'/%3E%3Cpath d='M32 34h16l16 40 16-40h16L72 94H56z' fill='%23f5c24b'/%3E%3C/svg%3E";

export const APP_DETAILS = {
  name: "VaultCircle",
  icon: appIcon
};
