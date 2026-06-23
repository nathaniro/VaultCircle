// Core domain types for VaultCircle frontend

export interface Vault {
  vaultId: number;
  name: string;
  creator: string;
  assetContract: string;
  thresholdPercent: number;
  memberCount: number;
  liquidBalance: number;       // in sats
  zestAllocated: number;       // in sats
  totalContributed: number;    // in sats
  yieldEnabled: boolean;
  beneficiary: string | null;
  status: "ACTIVE" | "CLOSED";
  // Derived from zest-adapter
  zestPositionValue?: number;  // current Zest position including yield
  totalVaultValue?: number;    // liquid + zestPositionValue
  yieldEarned?: number;
}

export interface Member {
  address: string;
  contributed: number;
  active: boolean;
  joinedAt: number;
  sharePercent?: number;       // derived: contributed / totalContributed * 100
}

export interface Proposal {
  proposalId: number;
  vaultId: number;
  proposer: string;
  proposalType: number;
  amount: number;
  recipient: string | null;
  reason: string;
  approvals: number;
  rejections: number;
  status: ProposalStatus;
  createdAt: number;
  expiresAt: number;
  executed: boolean;
}

export type ProposalType =
  | "WITHDRAW_SINGLE"
  | "WITHDRAW_BY_SHARE"
  | "ADD_MEMBER"
  | "REMOVE_MEMBER"
  | "CHANGE_THRESHOLD"
  | "ENABLE_YIELD"
  | "DISABLE_YIELD"
  | "DEPOSIT_TO_ZEST"
  | "WITHDRAW_FROM_ZEST"
  | "CHANGE_BENEFICIARY"
  | "CLOSE_VAULT";

export type ProposalStatus = "ACTIVE" | "PASSED" | "REJECTED" | "EXECUTED" | "EXPIRED";

export const PROPOSAL_TYPE_IDS: Record<ProposalType, number> = {
  WITHDRAW_SINGLE:    1,
  WITHDRAW_BY_SHARE:  2,
  ADD_MEMBER:         3,
  REMOVE_MEMBER:      4,
  CHANGE_THRESHOLD:   5,
  ENABLE_YIELD:       6,
  DISABLE_YIELD:      7,
  DEPOSIT_TO_ZEST:    8,
  WITHDRAW_FROM_ZEST: 9,
  CHANGE_BENEFICIARY: 10,
  CLOSE_VAULT:        11,
};

export const PROPOSAL_TYPE_LABELS: Record<number, string> = {
  1:  "Single Withdrawal",
  2:  "Share Distribution",
  3:  "Add Member",
  4:  "Remove Member",
  5:  "Change Threshold",
  6:  "Enable Yield",
  7:  "Disable Yield",
  8:  "Deposit to Zest",
  9:  "Withdraw from Zest",
  10: "Change Beneficiary",
  11: "Close Vault",
};

export const PROPOSAL_STATUS_IDS: Record<number, ProposalStatus> = {
  1: "ACTIVE",
  2: "PASSED",
  3: "REJECTED",
  4: "EXECUTED",
  5: "EXPIRED",
};

// Convert sats to sBTC display string
export function satsTosBTC(sats: number): string {
  return (sats / 1e8).toFixed(8);
}

// Convert sBTC input to sats
export function sBTCToSats(sbtc: string): number {
  const parsed = Number.parseFloat(sbtc);
  if (!Number.isFinite(parsed)) return Number.NaN;

  const sats = Math.round(parsed * 1e8);
  return Number.isSafeInteger(sats) ? sats : Number.NaN;
}

// Ceiling division for threshold display
export function calcRequiredApprovals(memberCount: number, thresholdPct: number): number {
  const raw = memberCount * thresholdPct;
  return raw % 100 === 0 ? raw / 100 : Math.floor(raw / 100) + 1;
}
