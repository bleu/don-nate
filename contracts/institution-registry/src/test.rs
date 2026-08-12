#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{Env, IntoVal};

fn setup<'a>(e: &Env, owner: &Address) -> InstitutionRegistryClient<'a> {
    let address = e.register(InstitutionRegistry, (owner,));
    InstitutionRegistryClient::new(e, &address)
}

#[test]
fn full_flow_report_then_approve_then_verified() {
    let e = Env::default();
    e.mock_all_auths();

    let owner = Address::generate(&e); // the reviewer of record
    let verifier = Address::generate(&e); // a decentralized verifier, e.g. an ambassador
    let institution = Address::generate(&e);
    let client = setup(&e, &owner);

    assert!(!client.is_verified(&institution));
    assert!(client.get_institution(&institution).is_none());

    let report_id = client.submit_report(
        &verifier,
        &institution,
        &String::from_str(&e, "Example Aid Foundation"),
        &String::from_str(&e, "https://example.org/evidence/1"),
        &2,
    );
    assert_eq!(report_id, 0);

    // A report alone changes nothing on the public registry — that's the whole point of
    // keeping verifier and reviewer distinct.
    assert!(!client.is_verified(&institution));

    client.approve_verification(&report_id, &3, &(30 * 24 * 60 * 60));

    let record = client.get_institution(&institution).unwrap();
    assert_eq!(record.trust_tier, 3);
    assert_eq!(record.reviewer, owner);
    assert_eq!(record.report_id, report_id);
    assert!(client.is_verified(&institution));

    let report = client.get_report(&report_id).unwrap();
    assert_eq!(report.verifier, verifier);
    assert_eq!(report.institution, institution);
    assert_eq!(report.name, String::from_str(&e, "Example Aid Foundation"));
    assert_eq!(report.recommended_tier, 2); // reviewer can diverge from the verifier's recommendation
}

#[test]
fn anyone_can_submit_a_report() {
    let e = Env::default();
    e.mock_all_auths();

    let owner = Address::generate(&e);
    let random_verifier = Address::generate(&e);
    let institution = Address::generate(&e);
    let client = setup(&e, &owner);

    // Permissionless by design — decentralizing the verifier role needs no contract change.
    let report_id = client.submit_report(
        &random_verifier,
        &institution,
        &String::from_str(&e, "Second Foundation"),
        &String::from_str(&e, "https://example.org/evidence/2"),
        &1,
    );
    assert_eq!(client.get_report(&report_id).unwrap().verifier, random_verifier);
}

#[test]
#[should_panic]
fn approving_an_unknown_report_fails() {
    let e = Env::default();
    e.mock_all_auths();

    let owner = Address::generate(&e);
    let client = setup(&e, &owner);

    client.approve_verification(&999, &1, &1000);
}

#[test]
#[should_panic]
fn approving_with_zero_tier_fails() {
    let e = Env::default();
    e.mock_all_auths();

    let owner = Address::generate(&e);
    let verifier = Address::generate(&e);
    let institution = Address::generate(&e);
    let client = setup(&e, &owner);

    let report_id = client.submit_report(
        &verifier,
        &institution,
        &String::from_str(&e, "Third Foundation"),
        &String::from_str(&e, "https://example.org/evidence/3"),
        &1,
    );
    client.approve_verification(&report_id, &0, &1000);
}

#[test]
#[should_panic(expected = "HostError: Error(Auth, InvalidAction)")]
fn non_reviewer_cannot_approve() {
    let e = Env::default();

    let owner = Address::generate(&e);
    let verifier = Address::generate(&e);
    let institution = Address::generate(&e);
    let client = setup(&e, &owner);

    // Mock auth for the verifier's own submission, but never for the owner — so the
    // reviewer-only check inside approve_verification has nothing backing it.
    e.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &verifier,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &client.address,
            fn_name: "submit_report",
            args: (
                verifier.clone(),
                institution.clone(),
                String::from_str(&e, "Fourth Foundation"),
                String::from_str(&e, "https://example.org/evidence/4"),
                1u32,
            )
                .into_val(&e),
            sub_invokes: &[],
        },
    }]);
    let report_id = client.submit_report(
        &verifier,
        &institution,
        &String::from_str(&e, "Fourth Foundation"),
        &String::from_str(&e, "https://example.org/evidence/4"),
        &1,
    );

    // No auth mocked for `owner` at all — approve_verification's #[only_owner] check must fail.
    client.approve_verification(&report_id, &1, &1000);
}

#[test]
fn trust_tier_expires() {
    let e = Env::default();
    e.mock_all_auths();

    let owner = Address::generate(&e);
    let verifier = Address::generate(&e);
    let institution = Address::generate(&e);
    let client = setup(&e, &owner);

    let report_id = client.submit_report(
        &verifier,
        &institution,
        &String::from_str(&e, "Fifth Foundation"),
        &String::from_str(&e, "https://example.org/evidence/5"),
        &1,
    );
    let ttl_seconds: u64 = 1000;
    client.approve_verification(&report_id, &1, &ttl_seconds);
    assert!(client.is_verified(&institution));

    e.ledger().with_mut(|li| {
        li.timestamp += ttl_seconds + 1;
    });

    // Re-verification has an expiry — a trust tier is never a permanent, unmaintained claim.
    assert!(!client.is_verified(&institution));
}

#[test]
fn reviewer_role_can_move_to_a_new_address() {
    let e = Env::default();
    e.mock_all_auths();

    let owner = Address::generate(&e);
    let new_owner = Address::generate(&e);
    let verifier = Address::generate(&e);
    let institution = Address::generate(&e);
    let client = setup(&e, &owner);

    client.transfer_ownership(&new_owner, &(e.ledger().sequence() + 100));
    client.accept_ownership();
    assert_eq!(client.get_owner(), Some(new_owner.clone()));

    // The new reviewer of record can approve without any contract change.
    let report_id = client.submit_report(
        &verifier,
        &institution,
        &String::from_str(&e, "Sixth Foundation"),
        &String::from_str(&e, "https://example.org/evidence/6"),
        &1,
    );
    client.approve_verification(&report_id, &1, &1000);
    assert_eq!(client.get_institution(&institution).unwrap().reviewer, new_owner);
}

#[test]
fn listing_and_search_support() {
    let e = Env::default();
    e.mock_all_auths();

    let owner = Address::generate(&e);
    let verifier = Address::generate(&e);
    let inst_a = Address::generate(&e);
    let inst_b = Address::generate(&e);
    let client = setup(&e, &owner);

    assert_eq!(client.list_institutions().len(), 0);

    let report_a1 = client.submit_report(
        &verifier,
        &inst_a,
        &String::from_str(&e, "Alpha Relief"),
        &String::from_str(&e, "https://example.org/a1"),
        &1,
    );
    // A second report for the *same* institution must not duplicate it in the listing.
    let report_a2 = client.submit_report(
        &verifier,
        &inst_a,
        &String::from_str(&e, "Alpha Relief (re-submission)"),
        &String::from_str(&e, "https://example.org/a2"),
        &2,
    );
    client.submit_report(
        &verifier,
        &inst_b,
        &String::from_str(&e, "Beta Foundation"),
        &String::from_str(&e, "https://example.org/b1"),
        &1,
    );

    let all = client.list_institutions();
    assert_eq!(all.len(), 2);
    assert_eq!(all.get(0).unwrap(), inst_a);
    assert_eq!(all.get(1).unwrap(), inst_b);

    let a_reports = client.get_reports_for_institution(&inst_a);
    assert_eq!(a_reports.len(), 2);
    assert_eq!(a_reports.get(0).unwrap(), report_a1);
    assert_eq!(a_reports.get(1).unwrap(), report_a2);

    // inst_b never gets approved — a listing must still be able to show it as pending.
    assert!(!client.is_verified(&inst_b));
    assert_eq!(client.get_reports_for_institution(&inst_b).len(), 1);
}
