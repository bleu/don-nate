#![no_std]

//! Institution Trust Registry — PoC.
//!
//! Two roles, kept distinct even though this PoC always has the same address fill both
//! (see proposal.md, section 4):
//!
//! - **Verifier**: checks real-world legitimacy and submits a report. Permissionless here —
//!   anyone can submit a report about any institution. This is deliberate: decentralizing the
//!   verifier role (e.g. to Stellar Ambassadors) is the whole point of separating it from the
//!   reviewer role, and a report by itself changes nothing on the public registry.
//! - **Reviewer**: the on-chain accountable party (`Ownable`'s owner). Only the reviewer can
//!   approve a report and write a trust-tier entry to the registry. Approving names which
//!   report it relied on, so the decision is traceable back to whoever did the legwork.
//!
//! Re-verification has an expiry — `is_verified` checks it, so a trust tier is never a
//! permanent, unmaintained claim. No Stellar payment/MoneyGram/SDP integration here on
//! purpose — this PoC is scoped to the registry and verification mechanism only.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    Env, String, Vec,
};
use stellar_access::ownable::{set_owner, Ownable};
use stellar_macros::only_owner;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RegistryError {
    ReportNotFound = 1,
    InvalidTrustTier = 2,
    InstitutionNotVerified = 3,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReportSubmitted {
    #[topic]
    pub institution: Address,
    pub verifier: Address,
    pub report_id: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InstitutionVerified {
    #[topic]
    pub institution: Address,
    pub trust_tier: u32,
    pub report_id: u64,
    pub expires_at: u64,
}

#[contracttype]
pub enum DataKey {
    Report(u64),
    ReportCount,
    Institution(Address),
    /// Every distinct institution that has ever had a report submitted, in submission
    /// order. Lets a frontend list/search institutions without an indexer scanning events —
    /// deliberately simple for a PoC at this scale; a real indexer is the right call once
    /// this list grows large (see docs/DESIGN.md).
    AllInstitutions,
    /// All report IDs submitted for one institution, in submission order — lets a frontend
    /// show an institution's full history, including reports not yet (or never) approved.
    InstitutionReports(Address),
}

/// A verifier's real-world legitimacy check for one institution. Written by `submit_report`;
/// never written to directly by anyone else. `evidence_uri` points off-chain (e.g. IPFS or a
/// plain URL) — no institution or donor PII goes on-chain, matching proposal.md section 2.
/// `name` is the institution's self-reported display name — informational only, never
/// authenticated; the trust tier is what vouches for legitimacy, not the name string.
#[contracttype]
#[derive(Clone)]
pub struct VerificationReport {
    pub verifier: Address,
    pub institution: Address,
    pub name: String,
    pub evidence_uri: String,
    pub recommended_tier: u32,
    pub submitted_at: u64,
}

/// The public registry entry for one institution. `reviewer` is the accountable on-chain
/// signer — the current `Ownable` owner at approval time — not necessarily who did the
/// on-the-ground verification (`report_id` links back to that).
#[contracttype]
#[derive(Clone)]
pub struct InstitutionRecord {
    pub trust_tier: u32,
    pub reviewer: Address,
    pub report_id: u64,
    pub verified_at: u64,
    pub expires_at: u64,
}

#[contract]
pub struct InstitutionRegistry;

#[contractimpl]
impl InstitutionRegistry {
    /// `owner` is the initial reviewer of record. Ownership can move later via the standard
    /// `Ownable` transfer flow (`transfer_ownership` / `accept_ownership`), exposed below —
    /// the contract never needs to change to recruit a different reviewer.
    pub fn __constructor(e: &Env, owner: Address) {
        set_owner(e, &owner);
        e.storage().persistent().set(&DataKey::ReportCount, &0u64);
    }

    /// Submit a verification report. Permissionless by design (see module docs) — the
    /// verifier only needs to authenticate as themselves; nothing on the public registry
    /// changes until a reviewer approves this report.
    pub fn submit_report(
        e: &Env,
        verifier: Address,
        institution: Address,
        name: String,
        evidence_uri: String,
        recommended_tier: u32,
    ) -> u64 {
        verifier.require_auth();

        let report_id: u64 = e.storage().persistent().get(&DataKey::ReportCount).unwrap_or(0);

        let report = VerificationReport {
            verifier: verifier.clone(),
            institution: institution.clone(),
            name,
            evidence_uri,
            recommended_tier,
            submitted_at: e.ledger().timestamp(),
        };
        e.storage().persistent().set(&DataKey::Report(report_id), &report);
        e.storage().persistent().set(&DataKey::ReportCount, &(report_id + 1));

        let mut institution_reports: Vec<u64> = e
            .storage()
            .persistent()
            .get(&DataKey::InstitutionReports(institution.clone()))
            .unwrap_or_else(|| Vec::new(e));
        if institution_reports.is_empty() {
            // First time we've seen this institution — add it to the enumerable list.
            let mut all: Vec<Address> =
                e.storage().persistent().get(&DataKey::AllInstitutions).unwrap_or_else(|| Vec::new(e));
            all.push_back(institution.clone());
            e.storage().persistent().set(&DataKey::AllInstitutions, &all);
        }
        institution_reports.push_back(report_id);
        e.storage()
            .persistent()
            .set(&DataKey::InstitutionReports(institution.clone()), &institution_reports);

        ReportSubmitted { institution, verifier, report_id }.publish(e);

        report_id
    }

    /// Reviewer sign-off: reads the named report and writes the trust-tier entry the public
    /// registry actually exposes. `expires_in_seconds` sets the re-verification expiry —
    /// there is no permanent, unmaintained trust tier by construction.
    #[only_owner]
    pub fn approve_verification(
        e: &Env,
        report_id: u64,
        trust_tier: u32,
        expires_in_seconds: u64,
    ) {
        if trust_tier == 0 {
            panic_with_error!(e, RegistryError::InvalidTrustTier);
        }

        let report: VerificationReport = e
            .storage()
            .persistent()
            .get(&DataKey::Report(report_id))
            .unwrap_or_else(|| panic_with_error!(e, RegistryError::ReportNotFound));

        let now = e.ledger().timestamp();
        let record = InstitutionRecord {
            trust_tier,
            reviewer: stellar_access::ownable::get_owner(e).unwrap(),
            report_id,
            verified_at: now,
            expires_at: now + expires_in_seconds,
        };
        e.storage().persistent().set(&DataKey::Institution(report.institution.clone()), &record);

        InstitutionVerified {
            institution: report.institution,
            trust_tier,
            report_id,
            expires_at: record.expires_at,
        }
        .publish(e);
    }

    /// Public read — no authorization required. This is the entire point of an on-chain
    /// registry (proposal.md section 1): anyone can check a claim without asking Bleu first.
    pub fn get_institution(e: &Env, institution: Address) -> Option<InstitutionRecord> {
        e.storage().persistent().get(&DataKey::Institution(institution))
    }

    /// Convenience read: true only if a trust tier exists AND hasn't expired.
    pub fn is_verified(e: &Env, institution: Address) -> bool {
        match e.storage().persistent().get::<_, InstitutionRecord>(&DataKey::Institution(institution)) {
            Some(record) => e.ledger().timestamp() < record.expires_at,
            None => false,
        }
    }

    /// Public read of a report — lets anyone trace a registry entry back to the verifier
    /// and evidence a reviewer relied on, not just trust the tier number blindly.
    pub fn get_report(e: &Env, report_id: u64) -> Option<VerificationReport> {
        e.storage().persistent().get(&DataKey::Report(report_id))
    }

    /// Every distinct institution that has ever had a report submitted, oldest first. A
    /// frontend lists/searches by fetching this once, then `get_reports_for_institution` +
    /// `get_institution` per address. See `DataKey::AllInstitutions` for why this is a plain
    /// on-chain list rather than an indexer, at this PoC's scale.
    pub fn list_institutions(e: &Env) -> Vec<Address> {
        e.storage().persistent().get(&DataKey::AllInstitutions).unwrap_or_else(|| Vec::new(e))
    }

    /// All report IDs submitted for one institution, oldest first — includes reports never
    /// approved, so a frontend can show "pending review" institutions, not just verified ones.
    pub fn get_reports_for_institution(e: &Env, institution: Address) -> Vec<u64> {
        e.storage()
            .persistent()
            .get(&DataKey::InstitutionReports(institution))
            .unwrap_or_else(|| Vec::new(e))
    }
}

// Standard Ownable surface (transfer_ownership / accept_ownership / renounce_ownership /
// get_owner) — lets the reviewer role move to a different address later without any
// contract change, exactly the flexibility proposal.md section 4 describes wanting.
#[contractimpl(contracttrait)]
impl Ownable for InstitutionRegistry {}

mod test;
