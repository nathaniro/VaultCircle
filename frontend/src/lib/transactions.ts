import {
  AnchorMode,
  PostConditionMode,
  boolCV,
  contractPrincipalCV,
  listCV,
  noneCV,
  principalCV,
  someCV,
  stringAsciiCV,
  uintCV
} from "@stacks/transactions";
import { showContractCall } from "@stacks/connect";
import { CONTRACTS, DEFAULT_PROPOSAL_DURATION, getStacksNetwork, splitContractId } from "./contracts";
import { isSafeUint, isValidStacksAddress } from "./validation";

type TxCallback = (result: { txId: string }) => void;
type ErrCallback = (error: unknown) => void;

const network = getStacksNetwork();
const vaultCircle = splitContractId(CONTRACTS.vaultCircle);
const sbtcContract = splitContractId(CONTRACTS.sbtc);

function tokenTraitArg() {
  return contractPrincipalCV(sbtcContract.address, sbtcContract.name);
}

function makeCancelHandler(onCancel?: ErrCallback) {
  if (!onCancel) return undefined;
  return () => onCancel(new Error("Transaction cancelled by wallet"));
}

function requireUint(value: number, label: string, minimum = 0) {
  if (!isSafeUint(value, minimum)) {
    throw new Error(`${label} must be a whole number ${minimum > 0 ? `of at least ${minimum}` : "that is zero or greater"}.`);
  }

  return value;
}

function requireStacksAddress(value: string, label: string) {
  const normalized = value.trim();
  if (!isValidStacksAddress(normalized)) {
    throw new Error(`${label} must be a valid Stacks testnet address.`);
  }

  return normalized;
}

// showContractCall falls back to a wallet-picker UI when no provider is stored,
// whereas openContractCall throws immediately. Use it for all contract calls.
// When a provider IS stored, showContractCall returns a Promise that can reject on
// cancellation even after calling onCancel — catch it here so it never propagates.
// When no provider is stored it returns undefined — treat that as a cancel so callers
// never end up with stuck pending state waiting for a callback that will never fire.
async function call(options: Parameters<typeof showContractCall>[0]): Promise<void> {
  const result = showContractCall(options);
  if (!result) {
    options.onCancel?.();
    return;
  }
  // Pre-register a no-op catch immediately so the JS engine marks this Promise as
  // "handled" before the microtask checkpoint fires. Without this, the engine can
  // report an unhandled-rejection warning from the @stacks/connect cancel error even
  // though our try/catch below will handle it — the library's internal console.error
  // and Promise rejection race the microtask queue and the browser logs it first.
  result.catch(() => undefined);
  try {
    await result;
  } catch {
    options.onCancel?.();
  }
}

export async function txCreateVault(
  name: string,
  initialMembers: string[],
  thresholdPercent: number,
  yieldEnabled: boolean,
  beneficiary: string | null,
  onFinish: TxCallback,
  onCancel?: ErrCallback
) {
  const normalizedMembers = initialMembers.map((member) => requireStacksAddress(member, "Each member address"));
  const normalizedBeneficiary = beneficiary ? requireStacksAddress(beneficiary, "Beneficiary address") : null;

  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "create-vault",
    functionArgs: [
      stringAsciiCV(name),
      listCV(normalizedMembers.map(principalCV)),
      uintCV(requireUint(thresholdPercent, "Approval threshold", 1)),
      boolCV(yieldEnabled),
      normalizedBeneficiary ? someCV(principalCV(normalizedBeneficiary)) : noneCV()
    ],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}

export async function txDeposit(vaultId: number, amount: number, onFinish: TxCallback, onCancel?: ErrCallback) {
  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "deposit",
    functionArgs: [tokenTraitArg(), uintCV(requireUint(vaultId, "Vault id")), uintCV(requireUint(amount, "Deposit amount", 1))],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}

export async function txCreateProposal(
  vaultId: number,
  proposalType: number,
  amount: number,
  recipient: string | null,
  reason: string,
  durationBlocks = DEFAULT_PROPOSAL_DURATION,
  onFinish: TxCallback,
  onCancel?: ErrCallback
) {
  const normalizedRecipient = recipient ? requireStacksAddress(recipient, "Recipient address") : null;

  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "create-proposal",
    functionArgs: [
      uintCV(requireUint(vaultId, "Vault id")),
      uintCV(requireUint(proposalType, "Proposal type", 1)),
      uintCV(requireUint(amount, "Proposal amount", 0)),
      normalizedRecipient ? someCV(principalCV(normalizedRecipient)) : noneCV(),
      stringAsciiCV(reason.slice(0, 256)),
      uintCV(requireUint(durationBlocks, "Voting duration", 1))
    ],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}

export async function txVote(vaultId: number, proposalId: number, approve: boolean, onFinish: TxCallback, onCancel?: ErrCallback) {
  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "vote-on-proposal",
    functionArgs: [uintCV(requireUint(vaultId, "Vault id")), uintCV(requireUint(proposalId, "Proposal id")), boolCV(approve)],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}

export async function txExecuteProposal(vaultId: number, proposalId: number, onFinish: TxCallback, onCancel?: ErrCallback) {
  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "execute-proposal",
    functionArgs: [tokenTraitArg(), uintCV(requireUint(vaultId, "Vault id")), uintCV(requireUint(proposalId, "Proposal id"))],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}

export async function txInitializeProtocol(
  sbtcContractId: string,
  onFinish: TxCallback,
  onCancel?: ErrCallback
) {
  const sbtc = splitContractId(sbtcContractId);
  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "initialize-protocol",
    functionArgs: [contractPrincipalCV(sbtc.address, sbtc.name)],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}

export async function txSyncZestYield(vaultId: number, onFinish: TxCallback, onCancel?: ErrCallback) {
  await call({
    contractAddress: vaultCircle.address,
    contractName: vaultCircle.name,
    functionName: "sync-zest-yield",
    functionArgs: [uintCV(requireUint(vaultId, "Vault id"))],
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    onFinish,
    onCancel: makeCancelHandler(onCancel)
  });
}
