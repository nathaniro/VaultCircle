const DEBUG_STORAGE_KEY = "vaultcircle.debug";

function isDebugEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
}

export function debugLog(scope: string, message: string, details?: Record<string, unknown>) {
  if (!isDebugEnabled()) return;

  if (details) {
    console.log(`[VaultCircle][${scope}] ${message}`, details);
    return;
  }

  console.log(`[VaultCircle][${scope}] ${message}`);
}
