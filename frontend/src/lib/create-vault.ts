import { isValidStacksAddress } from "./validation";

export const MAX_ADDITIONAL_MEMBERS = 10;

export interface CreateVaultValidationInput {
  creatorAddress: string;
  name: string;
  threshold: number;
  minThreshold: number;
  maxThreshold: number;
  members: string[];
  beneficiary: string;
}

export interface CreateVaultValidationResult {
  error: string | null;
  normalizedMembers: string[];
  totalMembers: number;
  requiredApprovals: number;
}

function normalizeAddressKey(address: string) {
  return address.trim().toUpperCase();
}

export function getNormalizedAdditionalMembers(members: string[], creatorAddress: string | null | undefined) {
  const creatorKey = creatorAddress ? normalizeAddressKey(creatorAddress) : null;
  const seen = new Set<string>();

  return members
    .map((member) => member.trim())
    .filter((member) => {
      if (!member || !isValidStacksAddress(member)) return false;

      const normalizedKey = normalizeAddressKey(member);
      if (normalizedKey === creatorKey || seen.has(normalizedKey)) return false;
      seen.add(normalizedKey);
      return true;
    });
}

export function validateCreateVaultForm({
  creatorAddress,
  name,
  threshold,
  minThreshold,
  maxThreshold,
  members,
  beneficiary
}: CreateVaultValidationInput): CreateVaultValidationResult {
  if (!name.trim()) {
    return {
      error: "Enter a vault name so members can clearly recognize this treasury.",
      normalizedMembers: [],
      totalMembers: 1,
      requiredApprovals: 1
    };
  }

  if (threshold < minThreshold || threshold > maxThreshold) {
    return {
      error: `Choose a threshold between ${minThreshold}% and ${maxThreshold}%.`,
      normalizedMembers: [],
      totalMembers: 1,
      requiredApprovals: 1
    };
  }

  const trimmedMembers = members.map((member) => member.trim()).filter(Boolean);
  const creatorKey = normalizeAddressKey(creatorAddress);
  const seenMembers = new Set<string>();
  const normalizedMembers: string[] = [];

  for (const member of trimmedMembers) {
    if (!isValidStacksAddress(member)) {
      return {
        error: "One or more member addresses are not valid Stacks Testnet addresses yet.",
        normalizedMembers: [],
        totalMembers: 1,
        requiredApprovals: 1
      };
    }

    const normalizedKey = normalizeAddressKey(member);
    if (normalizedKey === creatorKey) {
      return {
        error: "Your connected wallet is already included automatically, so remove it from the additional member list.",
        normalizedMembers: [],
        totalMembers: 1,
        requiredApprovals: 1
      };
    }

    if (seenMembers.has(normalizedKey)) {
      return {
        error: "Each additional member address can only be added once.",
        normalizedMembers: [],
        totalMembers: 1,
        requiredApprovals: 1
      };
    }

    seenMembers.add(normalizedKey);
    normalizedMembers.push(member);
  }

  if (normalizedMembers.length > MAX_ADDITIONAL_MEMBERS) {
    return {
      error: `Add at most ${MAX_ADDITIONAL_MEMBERS} additional members when creating a vault.`,
      normalizedMembers: [],
      totalMembers: 1,
      requiredApprovals: 1
    };
  }

  if (beneficiary.trim() && !isValidStacksAddress(beneficiary.trim())) {
    return {
      error: "Beneficiary address must be a valid Stacks Testnet address.",
      normalizedMembers: [],
      totalMembers: 1,
      requiredApprovals: 1
    };
  }

  const totalMembers = 1 + normalizedMembers.length;
  const requiredApprovals = Math.ceil((totalMembers * threshold) / 100);

  return {
    error: null,
    normalizedMembers,
    totalMembers,
    requiredApprovals
  };
}
