# Architecture: Donation Trust Registry

This is the target architecture for the full system this grant funds — the registry, the
MoneyGram/SDP payment rails, and the donor app. For what's actually built and live on testnet
today, see [DESIGN.md](DESIGN.md); the short version: the Institution Trust Registry contract
and the reference donor app (Browse/Register/Donate) are real and deployed, the SEP-10/SEP-24
donate flow runs against Stellar's public test anchor (not MoneyGram's production anchor yet,
which requires partner approval), and the Donation Attribution contract, Stellar Disbursement
Platform integration, and KYC vendor below are planned, not yet built.

## L1 — System Context

Who talks to what, at the level a reviewer skimming the proposal needs.

```mermaid
%%{init: {"flowchart": {"htmlLabels": true}} }%%
flowchart TD
    Donor(["<b>Donor</b><br/>Picks an institution, region, or cause.<br/>May hold no XLM, no wallet, no crypto experience."])
    Institution(["<b>Institution</b><br/>Applies for verification.<br/>Receives settled donations."])
    Reviewer(["<b>Reviewer (Bleu, this grant)</b><br/>Vets institutions, writes trust-tier entries.<br/><i>Who does this long-term is open</i>"])

    subgraph Platform["Donation Trust Registry Platform - this grant's scope"]
        Bleu["Institution Trust Registry +<br/>Donation Attribution contracts (Soroban).<br/>Reference donor web app.<br/>MIT, open source."]
    end

    MoneyGram["<b>MoneyGram Anchor</b><br/>Donor cash-in, institution cash-out.<br/>No bank account required either side.<br/>SEP-10 &middot; SEP-24"]
    SDP["<b>Stellar Disbursement Platform</b><br/>Batches pooled donor contributions<br/>out to institutions on a schedule.<br/>Same software Stellar Aid Assist runs<br/>on, reused in the other direction."]

    subgraph Chain["Stellar Network (Mainnet)"]
        Stellar["Soroban RPC + Horizon"]
        USDC["USDC SAC<br/>Circle-issued, native"]
    end

    OZ["<b>OpenZeppelin Stellar Contracts</b><br/>Audited crate, composition base -<br/>keeps the registry/attribution<br/>contracts' own audit surface small."]

    Roadmap["<b>Phase 2 - not this grant</b><br/>Reviews &middot; anti-fraud ML &middot; map &middot;<br/>donor leaderboard &middot; travel reward"]

    Donor -->|"Browse registry, donate (web app)"| Bleu
    Institution -->|"Apply for verification<br/>View settlement status"| Bleu
    Reviewer -->|"Verify institution<br/>Write trust-tier entry"| Bleu

    Bleu -->|"SEP-10 auth, SEP-24<br/>donor cash-in / institution cash-out"| MoneyGram
    Bleu -->|"Batch settlement<br/>pooled donations -> institutions"| SDP
    Bleu -->|"Prepare -> Sign -> Submit<br/>registry + attribution contract calls"| Stellar
    Bleu -->|"SAC transfer"| USDC
    USDC -.->|"runs on"| Stellar
    SDP -.->|"settles on"| Stellar
    MoneyGram -.->|"settles on"| Stellar
    OZ -->|"composes: audited primitives<br/>(build-time dep)"| Bleu
    Bleu -.->|"unlocks, does not fund"| Roadmap

    classDef actor fill:#f1f5f9,stroke:#64748b,color:#0f172a
    classDef bleu fill:#2563eb,stroke:#1e40af,color:#ffffff,font-weight:bold
    classDef external fill:#e2e8f0,stroke:#64748b,color:#0f172a
    classDef chain fill:#dcfce7,stroke:#15803d,color:#0f172a
    classDef builddep fill:#fef3c7,stroke:#ca8a04,color:#0f172a
    classDef outscope fill:#fce7f3,stroke:#be185d,color:#0f172a,stroke-dasharray: 5 5

    class Donor,Institution,Reviewer actor
    class Bleu bleu
    class MoneyGram,SDP external
    class Stellar,USDC chain
    class OZ builddep
    class Roadmap outscope

    style Platform fill:#eff6ff,stroke:#1e40af,stroke-dasharray: 5 5
    style Chain fill:#f0fdf4,stroke:#15803d,stroke-dasharray: 5 5
```

Three actors (donor, institution, the reviewer doing verification), one platform boundary (what
this grant funds), two rails (MoneyGram, Stellar Disbursement Platform) reused from Aid Assist
in the opposite direction, and Phase 2 named but explicitly outside the funded boundary.

## L2 — Containers (Clean Architecture pass)

One level down: the actual pieces inside the platform boundary, and how a donation moves end to
end, once the full grant scope (not just today's PoC) is built.

```mermaid
%% Bleu - Donation Trust Registry - Containers (C4 L2), Clean-Architecture revision
%% Layers inside the single Orchestrator deployable: Frontend -> Use Cases -> Ports -> Adapters -> externals/chain.
%% One deployable service, not a microservices proposal.
%%{init: {"flowchart": {"defaultRenderer": "elk"}} }%%
flowchart TD
    Donor(["Donor"])
    ReviewerActor(["Reviewer (Bleu)"])
    InstitutionActor(["Institution"])

    subgraph Platform["Donation Trust Registry Platform (one deployable)"]
        DonorApp["<b>Reference Donor Web App</b><br/>Browse registry, SEP-12 KYC<br/>form, donate"]
        ReviewerTool["<b>Reviewer Tooling</b><br/>CLI / script this grant -<br/><i>not</i> a polished console."]

        subgraph UseCases["Use Cases (framework-agnostic)"]
            UC_Verify["VerifyInstitution"]
            UC_Record["RecordDonation"]
            UC_Settle["SettleBatch"]
        end

        subgraph Ports["Ports (interfaces owned by the use cases)"]
            P_Registry{{"InstitutionRegistryPort"}}
            P_Identity{{"IdentityVerificationPort"}}
            P_OnOffRamp{{"OnRampOffRampPort"}}
            P_Attribution{{"DonationAttributionPort"}}
            P_KycStore{{"DonorRecordStorePort"}}
            P_Settlement{{"SettlementPort"}}
        end

        subgraph Adapters["Adapters (vendor/SDK-specific code lives only here)"]
            A_Registry["SorobanRegistryAdapter"]
            A_Attribution["SorobanAttributionAdapter"]
            A_Sign["TransactionSigningAdapter<br/>CAP-33 fee-sponsor key"]
            A_Kyc["KycVendorAdapter"]
            A_MG["MoneyGramAdapter"]
            A_SDP["SDPAdapter"]
            A_Store["KycStoreAdapter"]
        end

        KycStore[("<b>Donor KYC Store</b><br/>Off-chain, encrypted.<br/>PII never goes on-chain -<br/>only a pass/fail or hash<br/>reference does.")]
    end

    subgraph StellarNet["Stellar Network"]
        Registry["<b>Institution Trust Registry</b><br/>(Soroban contract)<br/>Enforces: verifier authorization<br/>+ trust-tier validity window"]
        Attribution["<b>Donation Attribution</b><br/>(Soroban contract)<br/>Enforces: immutable<br/>donor-institution-amount linkage"]
        USDC["USDC SAC"]
    end

    KycVendor["<b>KYC Verification Vendor</b><br/>[TBD]<br/>Behind IdentityVerificationPort -<br/>stubbed at T1, real vendor at T2"]
    MoneyGram["<b>MoneyGram Anchor</b><br/>SEP-10 auth, SEP-24<br/>cash-in / cash-out"]
    SDP["<b>Stellar Disbursement Platform</b><br/>Batches settlement to<br/>institution wallets"]
    OZ["<b>OpenZeppelin Stellar Contracts</b><br/>Composed into registry +<br/>attribution (build-time dep)"]

    Donor --> DonorApp
    ReviewerActor --> ReviewerTool

    DonorApp -->|"Donation intent<br/>+ KYC form data"| UC_Record
    ReviewerTool -->|"Verify institution"| UC_Verify

    UC_Verify --> P_Registry
    UC_Record --> P_Identity
    UC_Record --> P_OnOffRamp
    UC_Record --> P_Registry
    UC_Record --> P_Attribution
    UC_Record --> P_KycStore
    UC_Settle --> P_Attribution
    UC_Settle --> P_Settlement

    P_Registry --> A_Registry
    P_Attribution --> A_Attribution
    P_Identity --> A_Kyc
    P_OnOffRamp --> A_MG
    P_Settlement --> A_SDP
    P_KycStore --> A_Store

    A_Registry -->|"signs + sponsors<br/>reserves (CAP-33)"| A_Sign
    A_Attribution -->|"signs + sponsors<br/>reserves (CAP-33)"| A_Sign
    A_Sign --> Registry
    A_Sign --> Attribution
    A_Kyc --> KycVendor
    A_MG --> MoneyGram
    A_SDP --> SDP
    A_Store --> KycStore

    SDP -->|"Batch payout"| USDC
    USDC -->|"Settled donation"| InstitutionActor
    InstitutionActor -->|"SEP-24<br/>cash-out to local currency"| MoneyGram

    OZ -.->|"composes"| Registry
    OZ -.->|"composes"| Attribution

    classDef actor fill:#f1f5f9,stroke:#64748b,color:#0f172a
    classDef frontend fill:#60a5fa,stroke:#2563eb,color:#ffffff,font-weight:bold
    classDef usecase fill:#7c3aed,stroke:#5b21b6,color:#ffffff,font-weight:bold
    classDef port fill:#ffffff,stroke:#64748b,color:#0f172a,stroke-dasharray: 3 3
    classDef adapter fill:#6366f1,stroke:#4338ca,color:#ffffff,font-weight:bold
    classDef soroban fill:#16a34a,stroke:#15803d,color:#ffffff,font-weight:bold
    classDef datastore fill:#d97706,stroke:#b45309,color:#ffffff,font-weight:bold
    classDef external fill:#e2e8f0,stroke:#64748b,color:#0f172a
    classDef builddep fill:#fef3c7,stroke:#ca8a04,color:#0f172a
    classDef needs fill:#fef3c7,stroke:#ca8a04,color:#0f172a,stroke-dasharray: 3 3

    class Donor,ReviewerActor,InstitutionActor actor
    class DonorApp,ReviewerTool frontend
    class UC_Verify,UC_Record,UC_Settle usecase
    class P_Registry,P_Identity,P_OnOffRamp,P_Attribution,P_KycStore,P_Settlement port
    class A_Registry,A_Attribution,A_Sign,A_Kyc,A_MG,A_SDP,A_Store adapter
    class Registry,Attribution,USDC soroban
    class KycStore datastore
    class MoneyGram,SDP external
    class OZ builddep
    class KycVendor needs

    style Platform fill:#eff6ff,stroke:#1e40af,stroke-dasharray: 5 5
    style StellarNet fill:#f0fdf4,stroke:#15803d,stroke-dasharray: 5 5
    style UseCases fill:#f5f3ff,stroke:#7c3aed,stroke-dasharray: 2 2
    style Ports fill:#f8fafc,stroke:#64748b,stroke-dasharray: 2 2
    style Adapters fill:#eef2ff,stroke:#6366f1,stroke-dasharray: 2 2
```

**Layering, and why.** Not a microservices proposal — one deployable service, disproportionate
to split further for a $90K/5-month grant — but internally layered so vendor-specific code stays
out of the business rules:

- **Use Cases** (`VerifyInstitution`, `RecordDonation`, `SettleBatch`) contain the actual business
  rules and import no vendor SDKs.
- **Ports** are the interfaces the use cases depend on — `InstitutionRegistryPort`,
  `IdentityVerificationPort`, `OnRampOffRampPort`, `DonationAttributionPort`,
  `DonorRecordStorePort`, `SettlementPort`.
- **Adapters** implement those ports and are the only place vendor/SDK-specific code lives —
  `SorobanRegistryAdapter`, `SorobanAttributionAdapter`, `KycVendorAdapter`, `MoneyGramAdapter`,
  `SDPAdapter`, `KycStoreAdapter`, plus a shared `TransactionSigningAdapter` (the CAP-33
  fee-sponsor key lives in exactly one place, not duplicated across the two contract adapters).

**Reviewer authorization has one explicit owner.** `ReviewerTool` routes through
`VerifyInstitution` → `InstitutionRegistryPort`, the same path shape as the donor side — not a
direct write to the registry contract that bypasses every other layer. Who's authorized to
write a trust tier may grow past just Bleu over time (see the on-chain reviewer role in
[DESIGN.md](DESIGN.md)), so that authorization rule needs one testable owner, not something
living implicitly in "only Bleu runs the CLI."

**Why the KYC vendor being TBD doesn't block the architecture.** The *port* has to exist now
regardless of which vendor eventually fills it: the dual-compliance rule — donor identity
verification independent of MoneyGram's own KYC — has to hold no matter which vendor implements
the check, which is exactly what a port buys. The milestones are also asymmetric — MoneyGram
sandbox is a Tranche #1 gate, SEP-12 KYC live is a separate Tranche #2 gate — meaning the code
has to run at T1 behind a stub and swap in a real vendor at T2 without rewriting `RecordDonation`.
The same reasoning applies to `SettlementPort`: whether SDP is self-hosted or SDF-run is also
unresolved, and also shouldn't require rewriting `SettleBatch` once it's decided.

**Where the two Soroban contracts sit, conceptually.** Once deployed under the Tranche #3 2-of-3
multisig, these contracts satisfy Clean Architecture's Entities-independence goal better than a
typical off-chain Entities layer — nobody can quietly change how trust-tier expiry or attribution
immutability behaves without a visible, signed upgrade. For the invariants each contract enforces
at the point of state mutation (labeled on the nodes above), they're playing the Entities role.
That doesn't make them Use Cases, though — a Soroban call is an atomic state transition and
structurally can't sequence "verify identity AND confirm funds landed AND attribute AND enqueue
settlement." That sequencing is why the Use Case layer exists off-chain, calling into the
contracts through Ports the way it would call a repository — except this "repository" also
self-enforces its own invariants at the boundary.

**CAP-33 sponsored reserves** (no-XLM donor onboarding) isn't its own box — it's a signing/fee
responsibility of whichever adapter submits to Stellar, shown as the "signs + sponsors reserves
(CAP-33)" label on the edge into `TransactionSigningAdapter` — a fee-sponsor key Bleu controls,
signing every donor-side transaction, and a real operational commitment an external audit will
ask about.

## Open architecture questions

- KYC vendor choice — architecturally resolved either way (behind `IdentityVerificationPort`);
  only the vendor name is open.
- Whether the Stellar Disbursement Platform is self-hosted by Bleu or consumed as an SDF-run
  service — not yet resolved. Same shape as the KYC vendor question; also architecturally
  absorbed by a port (`SettlementPort`) rather than blocking the design.
- The custody question: the pooled/batched settlement step between `SettleBatch` and
  `SDPAdapter` is the exact point where a brief custodial hop could exist. This diagram doesn't
  resolve that — an external-counsel legal memo does, before mainnet.
- Not yet decided: whether `TransactionSigningAdapter`'s fee-sponsor key is a single key or a
  rotation/multisig scheme of its own before mainnet.
