import { validateStacksAddress } from "@stacks/transactions";

export function isSafeUint(value: unknown, minimum = 0): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

export function normalizeUint(value: unknown, minimum = 0): number | null {
  if (typeof value === "number") {
    return isSafeUint(value, minimum) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return null;
    const parsed = Number(trimmed);
    return isSafeUint(parsed, minimum) ? parsed : null;
  }

  return null;
}

export function isValidStacksAddress(address: string | null | undefined): address is string {
  return typeof address === "string" && address.trim().length > 0 && validateStacksAddress(address.trim());
}

export function formatAppError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function devWarn(message: string, ...details: unknown[]) {
  if (process.env.NODE_ENV === "development") {
    console.warn(message, ...details);
  }
}

export function devError(message: string, ...details: unknown[]) {
  if (process.env.NODE_ENV === "development") {
    console.error(message, ...details);
  }
}
