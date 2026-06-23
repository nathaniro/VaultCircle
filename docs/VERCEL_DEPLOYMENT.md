# Vercel Deployment Guide

## Recommended Project Layout

The Next.js application that should be deployed to Vercel lives in `frontend/`.

- Root Directory: `frontend`
- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: leave blank

Do not deploy this repository from the repo root in Vercel. The repo root also contains Clarinet contracts, deployment scripts, and protocol tooling that are not the Vercel app target.

## Required Environment Variables

Add these variables in the Vercel project dashboard under `Settings -> Environment Variables`.

```bash
NEXT_PUBLIC_STACKS_NETWORK=testnet
NEXT_PUBLIC_STACKS_API_URL=https://api.testnet.hiro.so
NEXT_PUBLIC_EXPLORER_BASE_URL=https://explorer.hiro.so
NEXT_PUBLIC_DEPLOYER_ADDRESS=ST000000000000000000002AMW42H
NEXT_PUBLIC_VAULT_CIRCLE_CONTRACT=ST000000000000000000002AMW42H.vault-circle
NEXT_PUBLIC_PROPOSAL_MANAGER_CONTRACT=ST000000000000000000002AMW42H.proposal-manager
NEXT_PUBLIC_VAULT_REGISTRY_CONTRACT=ST000000000000000000002AMW42H.vault-registry
NEXT_PUBLIC_GOVERNANCE_PARAMS_CONTRACT=ST000000000000000000002AMW42H.governance-params
NEXT_PUBLIC_ZEST_ADAPTER_CONTRACT=ST000000000000000000002AMW42H.zest-adapter
NEXT_PUBLIC_SBTC_CONTRACT=ST000000000000000000002AMW42H.sbtc-token
NEXT_PUBLIC_ZEST_MODE=disabled
```

Use your real deployed testnet principals instead of the placeholders above.

Do not add `DEPLOYER_PRIVATE_KEY`, `DEPLOYER_MNEMONIC`, admin keys, or any other signing secret to Vercel for the frontend project.

## Where To Get The Real Contract Values

After deploying and initializing the contracts from the repo root, run:

```bash
npm run scripts:verify:testnet
```

That command writes `artifacts/testnet/frontend.testnet.env`, which contains the exact `NEXT_PUBLIC_*` values to copy into Vercel.

## Local Preflight Before You Deploy

From the repo root:

```bash
npm install
npm --prefix frontend install
npm run verify:vercel
```

What `npm run verify:vercel` checks:

- the Vercel config is inside `frontend/`
- the root `vercel.json` is gone to avoid dashboard conflicts
- `.env.example` documents every required frontend variable
- no `localhost` or `127.0.0.1` frontend references remain
- no private key or mnemonic is exposed through `NEXT_PUBLIC_*`
- frontend dependencies resolve
- frontend lint passes
- the Next.js production build succeeds

## Deploy From GitHub To Vercel

1. Push your latest branch to GitHub.
2. In Vercel, click `Add New -> Project`.
3. Import the GitHub repository.
4. In the project setup screen, set `Root Directory` to `frontend`.
5. Confirm the detected settings:
   - Framework Preset: `Next.js`
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: blank
6. Add every required `NEXT_PUBLIC_*` environment variable.
7. Click `Deploy`.

## Redeploy After Changes

If the repository is already connected:

1. Push a new commit to the tracked branch.
2. Vercel will start a new deployment automatically.
3. If you changed environment variables, update them in the Vercel dashboard first, then click `Redeploy` on the latest deployment.

## Common Deployment Errors

### Build fails because Vercel used the wrong directory

Symptom: Vercel tries to build the repo root, cannot find the correct Next.js app, or ignores the frontend config.

Fix: Edit the Vercel project settings and set `Root Directory` to `frontend`.

### App builds but points at the wrong Stacks contracts

Symptom: the UI loads, but vault reads fail or transactions target placeholder principals.

Fix: rerun `npm run scripts:verify:testnet`, copy the values from `artifacts/testnet/frontend.testnet.env`, and update the matching Vercel environment variables.

### Wallet flow works locally but not in production

Symptom: production reads fail, explorer links are wrong, or wallet actions use the wrong network.

Fix: confirm these variables are set to testnet values:

- `NEXT_PUBLIC_STACKS_NETWORK=testnet`
- `NEXT_PUBLIC_STACKS_API_URL=https://api.testnet.hiro.so`
- `NEXT_PUBLIC_EXPLORER_BASE_URL=https://explorer.hiro.so`

### Secret accidentally added as a public variable

Symptom: a private key or mnemonic was placed in a `NEXT_PUBLIC_*` variable.

Fix: remove it immediately, rotate the compromised secret, and redeploy after replacing it with wallet-safe public contract identifiers only.

## Confirm The Frontend Is Using Testnet

Check all of the following after deployment:

1. The UI copy refers to Stacks Testnet.
2. Explorer links open the Hiro explorer, not a localhost URL.
3. Wallet prompts appear in a testnet-enabled Leather or Xverse wallet.
4. The configured contract principals match your testnet deployer address.
5. Creating or viewing a vault reads from the deployed testnet contracts successfully.
