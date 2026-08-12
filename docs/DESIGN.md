# Design decisions

## Verifier and reviewer are separate, on purpose

The registry only records a **reviewer of record** — the address accountable for what's
actually written on-chain — not who did the on-the-ground legitimacy check. That's deliberate:
it means decentralizing the verification legwork (to Stellar Ambassadors or anyone else) never
requires a contract change. The reviewer can rely on someone else's report and still be the
one who signs off.

Consequence: `submit_report` is permissionless. Anyone can submit a report about any
institution; a report changes nothing on the public registry by itself. Only
`approve_verification` (owner-only, via `stellar-access`'s `#[only_owner]`) writes the entry
`get_institution` exposes. Every approval names the `report_id` it relied on, so a trust tier
is traceable to specific evidence, not just a number someone asserts.

## Composing `stellar-access`, not hand-rolling access control

The grant proposal commits to composing OpenZeppelin's audited Stellar contracts rather than
writing novel access-control primitives — this contract uses `stellar-access`'s `Ownable`
module (`set_owner`, `#[only_owner]`, the standard 2-step `transfer_ownership` /
`accept_ownership` flow) instead of a hand-rolled admin check. That also means the reviewer
role can move to a new address later — e.g. if Bleu wants a different accountable party — with
no contract redeploy.

## Why `soroban-sdk` is pinned to `26.1.1`, not the CLI's default `27`

`stellar contract init` (CLI 27.1.0) scaffolds `soroban-sdk = "27"` by default. OpenZeppelin's
`stellar-access` (latest release 0.7.2 as of this writing) only supports `soroban-sdk ^26.1.0` —
pinning our own workspace to 27 pulled in *two* incompatible `soroban-sdk` versions
side by side (confirmed via `cargo tree -i soroban-sdk`), which would have broken the moment
any code tried to pass our own `Env`/`Address` into a `stellar-access` function. Pinned the
whole workspace to `=26.1.1` instead — the newest 26.x release, satisfying `stellar-access`'s
requirement exactly. Revisit this pin once OpenZeppelin ships a 27-compatible release.

## Storage: `persistent`, not `instance`

Institution records and verification reports both live in `persistent` storage, not
`instance`. `instance` storage is meant for small, always-alive contract configuration (which
is what `stellar-access` itself uses internally for the owner address) — a registry that's
expected to grow to many institutions and reports over time is exactly the case Soroban's own
guidance says `persistent` storage is for.

## Institution identity = a Stellar `Address`

The registry keys each record on the institution's `Address` rather than a separate identity
string. This PoC doesn't build the payment flow, but this choice is forward-compatible with
it: donations would eventually settle to that same address (the proposal's Donation
Attribution contract, out of scope here), so using it as the registry key now avoids a second
identity system to reconcile later.

## Listing/search is a plain on-chain list, not an indexer — for now

`list_institutions` returns every distinct institution that ever got a report, and
`get_reports_for_institution` returns that institution's full report history (including
reports never approved, so a frontend can show "pending review" institutions, not just
verified ones). This is a single growing `Vec` in contract storage, not events scanned by an
indexer. That's the right tradeoff at PoC scale (few institutions) and the wrong one once the
registry has many — revisit with a real indexer (mirroring the pattern `ens-marketplace` uses)
once there's enough real usage to make that worth building.

`name` on `VerificationReport` is self-reported and never authenticated — it exists so a
listing has something human-readable to show and search over. The trust tier, not the name
string, is what vouches for legitimacy.

## What's explicitly not here

No MoneyGram, no Stellar Disbursement Platform, no SEP-12, no Donation Attribution contract,
no donor-facing app. This PoC is scoped to the registry and verification mechanism only, per
explicit instruction — those pieces are designed in the proposal but not built here.
