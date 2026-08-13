# Don Nate — site

A React app for the institution trust registry PoC — a landing page, a searchable registry
browser, and a form to submit verification reports. Talks directly to the deployed
[`institution-registry`](../contracts/institution-registry) contract on Stellar testnet; no
backend of its own.

## Stack

- Vite + React + TypeScript.
- [`@creit.tech/stellar-wallets-kit`](https://github.com/Creit-Tech/Stellar-Wallets-Kit) for
  wallet connection (Freighter, xBull).
- Typed contract bindings generated via `stellar contract bindings typescript` — see
  `src/contracts/institution-registry/`. Its `dist/` build output is committed on purpose
  (see `../docs/DESIGN.md`) so building this app never needs network access to testnet.
- `src/lib/anchor.ts` — a real SEP-10 + SEP-24 client (uses `@stellar/stellar-sdk`'s
  `WebAuth`/`StellarToml` helpers), pointed at Stellar's public test anchor rather than
  MoneyGram directly. See `../docs/DESIGN.md` for why.

## Development

```shell
npm install
npm run dev          # http://localhost:5173
npm run build         # typecheck + production build
npm run cypress:open  # interactive e2e runner
npm run e2e            # starts the dev server, runs cypress headless, tears down
```

`npm run e2e`'s specs hit the **live testnet contract** — no mocking. `browse.cy.ts` asserts
against a specific seed entry ("Smoke Test Foundation") left on that deployment on purpose; see
the comment at the top of that file if testnet state ever needs reseeding.

## Pages

- `/` — the pitch: what this is, the three-step process, honest pre-launch status.
- `/browse` — lists every institution that's ever had a report submitted (read-only, no
  wallet needed), with client-side search by name or address.
- `/register` — submit a verification report. Requires a connected wallet, since the report
  is signed by the verifier submitting it.
- `/donate` — donate to a verified institution. Requires a connected wallet: deposits USDC via
  a SEP-24 anchor into the donor's own wallet, then the donor signs a payment forwarding it
  on-chain to the institution.

## Regenerating the contract bindings

If the contract is redeployed (new contract ID) or its interface changes:

```shell
cd ../..  # repo root
stellar contract bindings typescript \
  --network testnet \
  --contract-id <NEW_CONTRACT_ID> \
  --output-dir site/src/contracts/institution-registry \
  --overwrite
cd site/src/contracts/institution-registry && npm install && npm run build
```
