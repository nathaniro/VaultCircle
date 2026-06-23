import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, "../.env") });

async function run() {
  const { validateCreateVaultForm } = await import("../src/lib/create-vault");
  const { extractErrCodeFromTxRepr, extractOkUintFromTxRepr, mapCreateVaultFailure } = await import("../src/lib/tx-status");
  const { isValidStacksAddress, normalizeUint } = await import("../src/lib/validation");
  const { getVault } = await import("../src/lib/stacks");

  assert.equal(normalizeUint(undefined), null, "undefined vault ids should normalize to null");
  assert.equal(normalizeUint(Number.NaN), null, "NaN vault ids should normalize to null");
  assert.equal(normalizeUint(1.5), null, "decimal vault ids should normalize to null");
  assert.equal(normalizeUint(-1), null, "negative vault ids should normalize to null");
  assert.equal(normalizeUint("12"), 12, "numeric strings should normalize to integers");
  assert.equal(normalizeUint("12.4"), null, "decimal strings should not normalize");
  assert.equal(normalizeUint(""), null, "empty strings should not normalize");

  assert.equal(await getVault(undefined as never), null, "getVault(undefined) should return null");
  assert.equal(await getVault(Number.NaN as never), null, "getVault(NaN) should return null");
  assert.equal(await getVault(1.5 as never), null, "getVault(decimal) should return null");
  assert.equal(await getVault(-1 as never), null, "getVault(negative) should return null");

  const duplicateMembers = validateCreateVaultForm({
    creatorAddress: "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT",
    name: "Ops Vault",
    threshold: 70,
    minThreshold: 51,
    maxThreshold: 100,
    members: ["ST35SGAVN61A0DGGK2H9244P2DMJR60S01BK71J5A", "ST35SGAVN61A0DGGK2H9244P2DMJR60S01BK71J5A"],
    beneficiary: ""
  });
  assert.equal(duplicateMembers.error, "Each additional member address can only be added once.");

  const creatorDuplicated = validateCreateVaultForm({
    creatorAddress: "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT",
    name: "Ops Vault",
    threshold: 70,
    minThreshold: 51,
    maxThreshold: 100,
    members: ["ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT"],
    beneficiary: ""
  });
  assert.equal(
    creatorDuplicated.error,
    "Your connected wallet is already included automatically, so remove it from the additional member list."
  );

  assert.equal(extractOkUintFromTxRepr("(ok u3)"), 3, "confirmed create-vault result should expose the new vault id");
  assert.equal(extractOkUintFromTxRepr("(ok true)"), null, "non-uint ok values should not parse as vault ids");
  assert.equal(extractErrCodeFromTxRepr("(err u628)"), 628, "contract err codes should parse from tx results");
  assert.equal(
    mapCreateVaultFailure("abort_by_response", "(err u628)").message,
    "VaultCircle has not been initialized with its sBTC contract on this deployment yet, so new vaults cannot be created."
  );

  assert.equal(isValidStacksAddress(""), false, "empty address should be invalid");
  assert.equal(isValidStacksAddress("ST123"), false, "malformed address should be invalid");

  console.log("Frontend guard smoke tests passed.");
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
