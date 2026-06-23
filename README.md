# VaultCircle

VaultCircle is a group sBTC custody protocol on Stacks with a Next.js frontend for public Stacks testnet usage.

## Production Scope

This repository is trimmed for:

- public Stacks testnet contract deployment
- protocol initialization and verification
- Vercel frontend deployment against the live testnet contracts

Zest remains testnet-safe by default with `ZEST_ADAPTER_MODE=disabled` unless you explicitly configure verified live testnet principals.

## Contracts

- `contracts/vault-circle.clar`
- `contracts/proposal-manager.clar`
- `contracts/governance-params.clar`
- `contracts/vault-registry.clar`
- `contracts/zest-adapter-testnet.clar`
- `contracts/sip-010-ft-trait.clar`

## Required Environment

Root `.env`:

```bash
STACKS_NETWORK=testnet
STACKS_API_URL=https://api.testnet.hiro.so
STACKS_EXPLORER_URL=https://explorer.hiro.so
DEPLOYER_ADDRESS=ST...
DEPLOYER_MNEMONIC="word1 word2 ..."
PROTOCOL_ADMIN_ADDRESS=ST...
SBTC_CONTRACT_PRINCIPAL=ST....sbtc-token
ZEST_ADAPTER_MODE=disabled
```

`DEPLOYER_PRIVATE_KEY` is optional. If omitted, deployment and initialization derive the signer from `DEPLOYER_MNEMONIC`.

Frontend env:

```bash
NEXT_PUBLIC_STACKS_NETWORK=testnet
NEXT_PUBLIC_STACKS_API_URL=https://api.testnet.hiro.so
NEXT_PUBLIC_EXPLORER_BASE_URL=https://explorer.hiro.so
NEXT_PUBLIC_DEPLOYER_ADDRESS=ST...
NEXT_PUBLIC_VAULT_CIRCLE_CONTRACT=ST....vault-circle
NEXT_PUBLIC_PROPOSAL_MANAGER_CONTRACT=ST....proposal-manager
NEXT_PUBLIC_VAULT_REGISTRY_CONTRACT=ST....vault-registry
NEXT_PUBLIC_GOVERNANCE_PARAMS_CONTRACT=ST....governance-params
NEXT_PUBLIC_ZEST_ADAPTER_CONTRACT=ST....zest-adapter
NEXT_PUBLIC_SBTC_CONTRACT=ST....sbtc-token
NEXT_PUBLIC_ZEST_MODE=disabled
```

## Install

```bash
npm install
npm --prefix frontend install
```

## Validation

```bash
npm run check
npm run build
```

## Deployment Flow

1. Generate Clarinet testnet settings from `.env`:

```bash
npm run scripts:prepare:testnet
```

2. Deploy contracts:

```bash
npm run scripts:deploy:testnet
```

3. Initialize protocol:

```bash
npm run scripts:init:testnet
```

4. Verify deployment and produce frontend env values:

```bash
npm run scripts:verify:testnet
```

The verification step writes `artifacts/testnet/frontend.testnet.env`, which you can mirror into `frontend/.env` or your Vercel project environment variables.

## Generated Files

These files are intentionally generated and ignored:

- `settings/Testnet.toml`
- `deployments/default.testnet-plan.yaml`
- `artifacts/testnet/*`
- `frontend/.next/*`

## Frontend

Local dev:

```bash
npm run frontend:dev
```

Or run the app directly inside `frontend/`:

```bash
cd frontend
npm run dev
```

If you use the repo root `.env` for deployment scripts, the frontend can now derive its local contract ids from `DEPLOYER_ADDRESS` and `SBTC_CONTRACT_PRINCIPAL`. A dedicated `frontend/.env` or `frontend/.env.local` still takes priority.

Local build:

```bash
npm run frontend:build
```

Local start:

```bash
npm --prefix frontend run start
```
