# Don Nate — Institution Trust Registry (PoC)

A Soroban PoC for the on-chain institution trust registry described in Bleu's SCF #45 grant
proposal (`bleu-brain`'s `bleu/reference/grants/stellar-scf-45/donation-trust-registry/`).

**Scope: registry + verification mechanism only.** Deliberately no MoneyGram, no Stellar
Disbursement Platform, no SEP-12, no payment flow — this PoC exists to prove out the part of
the design that isn't about moving money: how an institution gets a trust tier written
on-chain, who's allowed to write it, and how that can be traced back to whoever actually did
the verification work. See [`docs/DESIGN.md`](docs/DESIGN.md) for the reasoning.

**Live on Stellar testnet**, with a working frontend — see [`site/`](site/). Contract ID and
network details in [`deployments/testnet.json`](deployments/testnet.json).

## What this is

Two roles, kept distinct on purpose even though this PoC has the same address fill both today:

- **Verifier** — checks an institution's real-world legitimacy and submits a report.
  Permissionless: anyone can submit a report about any institution. A report by itself
  changes nothing on the public registry. This is where decentralizing to third parties (e.g.
  Stellar Ambassadors, per the proposal's section 4) would plug in later, with zero contract
  changes.
- **Reviewer** — the on-chain accountable party. Only the reviewer can approve a report and
  write a trust-tier entry to the registry, and every approval names which report it relied
  on. Implemented as `stellar-access`'s `Ownable` — the reviewer role can move to a different
  address later via the standard 2-step ownership transfer, with no contract redeploy.

Re-verification has an expiry (`is_verified` checks it) — a trust tier is never a permanent,
unmaintained claim.

## Repo layout

```
contracts/institution-registry/   The one contract. src/lib.rs is the implementation,
                                   src/test.rs is the test suite, run with `cargo test`.
site/                              React app — landing page, registry browser + search,
                                   report-submission form. See site/README.md.
deployments/testnet.json          Contract ID and network config for the current testnet
                                   deployment.
docs/DESIGN.md                    Why it's built this way — role split, storage choices,
                                   the soroban-sdk version pin, listing/search tradeoffs.
```

## Development

```shell
cargo test              # run the contract's test suite
stellar contract build  # compile to WASM (target/wasm32v1-none/release/institution_registry.wasm)
cd site && npm install && npm run dev  # the frontend, http://localhost:5173
```

## Links

- Full proposal, architecture, and decision record: `bleu-brain` (internal) —
  `bleu/reference/grants/stellar-scf-45/donation-trust-registry/`
- [OpenZeppelin Stellar Contracts](https://github.com/OpenZeppelin/stellar-contracts) — the
  audited `stellar-access`/`stellar-macros` crates this contract composes
