import {
  callReadOnlyFunction,
  contractPrincipalCV,
  cvToValue,
  principalCV,
  uintCV,
  type ClarityValue
} from "@stacks/transactions";
import { CONTRACTS, DEPLOYER_ADDRESS, getStacksNetwork, splitContractId } from "./contracts";
import { devError, devWarn, isSafeUint, isValidStacksAddress, normalizeUint } from "./validation";
import type { Member, Proposal, ProposalStatus, Vault } from "@/types";

const network = getStacksNetwork();

// 15-second in-memory cache to avoid redundant API calls within the testnet rate limit (50 req/min).
const _readOnlyCache = new Map<string, { value: unknown; at: number }>();
const CACHE_TTL = 15_000;

function argsKey(args: ClarityValue[]): string {
  try {
    return JSON.stringify(args, (_, v) => (typeof v === "bigint" ? `B${v}` : v instanceof Uint8Array ? Array.from(v) : v));
  } catch {
    return String(args.length);
  }
}

async function readOnly(contractId: string, functionName: string, functionArgs: ClarityValue[], senderAddress = DEPLOYER_ADDRESS) {
  const key = `${contractId}|${functionName}|${argsKey(functionArgs)}`;
  const cached = _readOnlyCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.value;

  const { address, name } = splitContractId(contractId);
  const result = await callReadOnlyFunction({ contractAddress: address, contractName: name, functionName, functionArgs, network, senderAddress });
  const value = cvToValue(result);
  _readOnlyCache.set(key, { value, at: Date.now() });
  return value;
}

function toSafeUint(value: unknown, minimum = 0): number | null {
  if (typeof value === "bigint") {
    const normalizedBigInt = Number(value);
    return Number.isSafeInteger(normalizedBigInt) && normalizedBigInt >= minimum ? normalizedBigInt : null;
  }

  return normalizeUint(value, minimum);
}

export async function getVault(vaultId: number, { skipZest = false } = {}): Promise<Vault | null> {
  if (!isSafeUint(vaultId)) {
    devWarn("Invalid vaultId passed to getVault:", vaultId);
    return null;
  }

  try {
    const raw = await readOnly(CONTRACTS.vaultCircle, "get-vault-optional", [uintCV(vaultId)]);
    if (!raw || raw.value === null) return null;

    const vault = raw.value;
    const [zestPositionValue, yieldEarned] = skipZest
      ? [0, 0]
      : await Promise.all([getZestPosition(vaultId), getYieldEarned(vaultId)]);

    return {
      vaultId,
      name: vault.name?.value,
      creator: vault.creator?.value,
      assetContract: vault["asset-contract"]?.value,
      thresholdPercent: Number(vault["threshold-percent"]?.value),
      memberCount: Number(vault["member-count"]?.value),
      liquidBalance: Number(vault["liquid-balance"]?.value),
      zestAllocated: Number(vault["zest-allocated"]?.value),
      totalContributed: Number(vault["total-contributed"]?.value),
      yieldEnabled: vault["yield-enabled"]?.value,
      beneficiary: vault.beneficiary?.value?.value || null,
      status: vault.status?.value,
      zestPositionValue,
      totalVaultValue: Number(vault["liquid-balance"]?.value) + zestPositionValue,
      yieldEarned
    };
  } catch (error) {
    devError(`Failed to fetch vault ${vaultId}:`, error);
    return null;
  }
}

export async function getMember(vaultId: number, memberAddress: string): Promise<Member | null> {
  if (!isSafeUint(vaultId)) {
    devWarn("Invalid vaultId passed to getMember:", vaultId);
    return null;
  }

  if (!isValidStacksAddress(memberAddress)) {
    devWarn("Invalid member address passed to getMember:", memberAddress);
    return null;
  }

  try {
    const raw = await readOnly(CONTRACTS.vaultCircle, "get-member", [uintCV(vaultId), principalCV(memberAddress)]);
    if (!raw || raw.value === null) return null;

    const member = raw.value;
    return {
      address: memberAddress,
      contributed: Number(member.contributed?.value),
      active: member.active?.value,
      joinedAt: Number(member["joined-at"]?.value)
    };
  } catch (error) {
    devError(`Failed to fetch member ${memberAddress} for vault ${vaultId}:`, error);
    return null;
  }
}

export async function getMemberAt(vaultId: number, index: number): Promise<string | null> {
  if (!isSafeUint(vaultId) || !isSafeUint(index)) {
    devWarn("Invalid vaultId or member index passed to getMemberAt:", { vaultId, index });
    return null;
  }

  try {
    const raw = await readOnly(CONTRACTS.vaultCircle, "get-member-at", [uintCV(vaultId), uintCV(index)]);
    if (!raw || raw.value === null) return null;

    const memberAddress = String(raw.value);
    if (!isValidStacksAddress(memberAddress)) {
      devWarn("Contract returned an invalid member address:", memberAddress);
      return null;
    }

    return memberAddress;
  } catch (error) {
    devError(`Failed to fetch member at index ${index} for vault ${vaultId}:`, error);
    return null;
  }
}

export async function getProposal(proposalId: number): Promise<Proposal | null> {
  if (!isSafeUint(proposalId)) {
    devWarn("Invalid proposalId passed to getProposal:", proposalId);
    return null;
  }

  try {
    const raw = await readOnly(CONTRACTS.proposalManager, "get-proposal", [uintCV(proposalId)]);
    if (!raw || raw.value === null) return null;

    const proposal = raw.value;
    const statusMap: Record<number, ProposalStatus> = {
      1: "ACTIVE",
      2: "PASSED",
      3: "REJECTED",
      4: "EXECUTED",
      5: "EXPIRED"
    };

    return {
      proposalId,
      vaultId: Number(proposal["vault-id"]?.value),
      proposer: proposal.proposer?.value,
      proposalType: Number(proposal["proposal-type"]?.value),
      amount: Number(proposal.amount?.value),
      recipient: proposal.recipient?.value?.value || null,
      reason: proposal.reason?.value,
      approvals: Number(proposal.approvals?.value),
      rejections: Number(proposal.rejections?.value),
      status: statusMap[Number(proposal.status?.value)] || "ACTIVE",
      createdAt: Number(proposal["created-at"]?.value),
      expiresAt: Number(proposal["expires-at"]?.value),
      executed: proposal.executed?.value
    };
  } catch (error) {
    devError(`Failed to fetch proposal ${proposalId}:`, error);
    return null;
  }
}

export async function getVaultProposals(vaultId: number): Promise<number[]> {
  if (!isSafeUint(vaultId)) {
    devWarn("Invalid vaultId passed to getVaultProposals:", vaultId);
    return [];
  }

  try {
    const countRaw = await readOnly(CONTRACTS.proposalManager, "get-vault-proposal-count", [uintCV(vaultId)]);
    const count = toSafeUint(countRaw) ?? 0;
    const proposalIds: number[] = [];

    for (let offset = 0; offset < count; offset += 10) {
      const batch = await readOnly(CONTRACTS.proposalManager, "get-vault-proposals", [uintCV(vaultId), uintCV(offset)]);
      for (let idx = 0; idx < 10 && offset + idx < count; idx += 1) {
        const value = batch?.[`p${idx}`]?.value?.value;
        const proposalId = toSafeUint(value);
        if (proposalId === null) {
          if (value != null) {
            devWarn("Skipping invalid proposal id returned from contract:", value);
          }
          continue;
        }
        proposalIds.push(proposalId);
      }
    }

    return proposalIds;
  } catch (error) {
    devError(`Failed to fetch proposals for vault ${vaultId}:`, error);
    return [];
  }
}

export async function getMemberVaults(memberAddress: string): Promise<number[]> {
  if (!isValidStacksAddress(memberAddress)) {
    devWarn("Invalid member address passed to getMemberVaults:", memberAddress);
    return [];
  }

  try {
    const countRaw = await readOnly(CONTRACTS.vaultRegistry, "get-member-vault-count", [principalCV(memberAddress)]);
    const count = toSafeUint(countRaw) ?? 0;
    const vaultIds: number[] = [];

    for (let offset = 0; offset < count; offset += 10) {
      const batch = await readOnly(CONTRACTS.vaultRegistry, "get-user-vaults", [principalCV(memberAddress), uintCV(offset)]);
      for (let idx = 0; idx < 10 && offset + idx < count; idx += 1) {
        const value = batch?.[`v${idx}`]?.value?.value;
        const vaultId = toSafeUint(value);
        if (vaultId === null) {
          if (value != null) {
            devWarn("Skipping invalid vault id returned from contract:", value);
          }
          continue;
        }
        vaultIds.push(vaultId);
      }
    }

    return vaultIds;
  } catch (error) {
    devError(`Failed to fetch vault memberships for ${memberAddress}:`, error);
    return [];
  }
}

export async function getRequiredApprovals(vaultId: number): Promise<number> {
  if (!isSafeUint(vaultId)) {
    devWarn("Invalid vaultId passed to getRequiredApprovals:", vaultId);
    return 0;
  }

  try {
    const raw = await readOnly(CONTRACTS.vaultCircle, "get-required-approvals", [uintCV(vaultId)]);
    return toSafeUint(raw) ?? 0;
  } catch (error) {
    devError(`Failed to fetch required approvals for vault ${vaultId}:`, error);
    return 0;
  }
}

export async function calcMemberShare(vaultId: number, memberAddress: string, totalToDistribute: number): Promise<number> {
  if (!isSafeUint(vaultId) || !isValidStacksAddress(memberAddress) || !isSafeUint(totalToDistribute)) {
    devWarn("Invalid input passed to calcMemberShare:", { vaultId, memberAddress, totalToDistribute });
    return 0;
  }

  try {
    const raw = await readOnly(CONTRACTS.vaultCircle, "get-member-share", [
      uintCV(vaultId),
      principalCV(memberAddress),
      uintCV(totalToDistribute)
    ]);
    return toSafeUint(raw) ?? 0;
  } catch (error) {
    devError(`Failed to calculate member share for vault ${vaultId}:`, error);
    return 0;
  }
}

export async function getTotalVaultValue(vaultId: number): Promise<number> {
  if (!isSafeUint(vaultId)) {
    devWarn("Invalid vaultId passed to getTotalVaultValue:", vaultId);
    return 0;
  }

  try {
    const raw = await readOnly(CONTRACTS.vaultCircle, "get-total-vault-value", [uintCV(vaultId)]);
    return toSafeUint(raw) ?? 0;
  } catch (error) {
    devError(`Failed to fetch total vault value for vault ${vaultId}:`, error);
    return 0;
  }
}

export async function getLiquidBalance(vaultId: number): Promise<number> {
  if (!isSafeUint(vaultId)) {
    devWarn("Invalid vaultId passed to getLiquidBalance:", vaultId);
    return 0;
  }

  try {
    const raw = await readOnly(CONTRACTS.vaultCircle, "get-liquid-balance", [uintCV(vaultId)]);
    return toSafeUint(raw) ?? 0;
  } catch (error) {
    devError(`Failed to fetch liquid balance for vault ${vaultId}:`, error);
    return 0;
  }
}

export async function getZestPosition(vaultId: number): Promise<number> {
  if (!isSafeUint(vaultId)) {
    devWarn("Invalid vaultId passed to getZestPosition:", vaultId);
    return 0;
  }

  try {
    const raw = await readOnly(CONTRACTS.zestAdapter, "get-zest-position-value", [uintCV(vaultId)]);
    return toSafeUint(raw) ?? 0;
  } catch (error) {
    devError(`Failed to fetch Zest position for vault ${vaultId}:`, error);
    return 0;
  }
}

export async function getYieldEarned(vaultId: number): Promise<number> {
  if (!isSafeUint(vaultId)) {
    devWarn("Invalid vaultId passed to getYieldEarned:", vaultId);
    return 0;
  }

  try {
    const raw = await readOnly(CONTRACTS.zestAdapter, "get-yield-earned", [uintCV(vaultId)]);
    return toSafeUint(raw) ?? 0;
  } catch (error) {
    devError(`Failed to fetch yield earned for vault ${vaultId}:`, error);
    return 0;
  }
}

export async function getAdapterMode(): Promise<number> {
  const raw = await readOnly(CONTRACTS.zestAdapter, "get-adapter-mode", []);
  return Number(raw) || 0;
}

export async function hasVoted(proposalId: number, voter: string): Promise<boolean> {
  if (!isSafeUint(proposalId) || !isValidStacksAddress(voter)) {
    devWarn("Invalid input passed to hasVoted:", { proposalId, voter });
    return false;
  }

  try {
    const raw = await readOnly(CONTRACTS.proposalManager, "has-voted", [uintCV(proposalId), principalCV(voter)]);
    return Boolean(raw);
  } catch (error) {
    devError(`Failed to fetch vote state for proposal ${proposalId}:`, error);
    return false;
  }
}

export async function getSbtcBalance(owner: string): Promise<number> {
  if (!isValidStacksAddress(owner)) {
    devWarn("Invalid owner address passed to getSbtcBalance:", owner);
    return 0;
  }

  try {
    const raw = await readOnly(CONTRACTS.sbtc, "get-balance", [principalCV(owner)], owner);
    if (raw && typeof raw === "object" && "value" in raw) {
      return toSafeUint((raw as { value: bigint | number }).value) ?? 0;
    }
    return toSafeUint(raw) ?? 0;
  } catch (error) {
    devError(`Failed to fetch sBTC balance for ${owner}:`, error);
    return 0;
  }
}

export function getTokenContractArg() {
  const { address, name } = splitContractId(CONTRACTS.sbtc);
  return contractPrincipalCV(address, name);
}

export type ProtocolStatus =
  | { initialized: true; sbtcContract: string }
  | { initialized: false; sbtcContract: null }
  | { initialized: null; sbtcContract: null }; // unknown — API call failed

export async function checkProtocolStatus(): Promise<ProtocolStatus> {
  try {
    const raw = await readOnly(CONTRACTS.vaultCircle, "get-configured-sbtc-contract", []);
    // get-configured-sbtc-contract returns (optional principal)
    // cvToValue maps some(principal) -> { value: "ST..." }, none -> null
    if (raw !== null && typeof raw === "object" && "value" in raw && raw.value !== null) {
      return { initialized: true, sbtcContract: String(raw.value) };
    }
    return { initialized: false, sbtcContract: null };
  } catch {
    // API failure — don't block the user; let them try (on-chain error will be surfaced if needed)
    return { initialized: null, sbtcContract: null };
  }
}
