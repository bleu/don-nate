import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CBTVW5WLVZYBOV4SYUOJLCHO6TD654K6T2KGHNABSJCQXH6HW5YRLLMR",
  }
} as const

export const RegistryError = {
  1: {message:"ReportNotFound"},
  2: {message:"InvalidTrustTier"},
  3: {message:"InstitutionNotVerified"}
}



/**
 * The public registry entry for one institution. `reviewer` is the accountable on-chain
 * signer — the current `Ownable` owner at approval time — not necessarily who did the
 * on-the-ground verification (`report_id` links back to that).
 */
export interface InstitutionRecord {
  expires_at: u64;
  report_id: u64;
  reviewer: string;
  trust_tier: u32;
  verified_at: u64;
}


/**
 * A verifier's real-world legitimacy check for one institution. Written by `submit_report`;
 * never written to directly by anyone else. `evidence_uri` points off-chain (e.g. IPFS or a
 * plain URL) — no institution or donor PII goes on-chain, matching proposal.md section 2.
 * `name` is the institution's self-reported display name — informational only, never
 * authenticated; the trust tier is what vouches for legitimacy, not the name string.
 */
export interface VerificationReport {
  evidence_uri: string;
  institution: string;
  name: string;
  recommended_tier: u32;
  submitted_at: u64;
  verifier: string;
}


export const RoleTransferError = {
  2200: {message:"NoPendingTransfer"},
  2201: {message:"InvalidLiveUntilLedger"},
  2202: {message:"InvalidPendingAccount"},
  2203: {message:"TransferExpired"}
}

export const OwnableError = {
  2100: {message:"OwnerNotSet"},
  2101: {message:"TransferInProgress"},
  2102: {message:"OwnerAlreadySet"}
}




export interface Client {
  /**
   * Construct and simulate a get_owner transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns `Some(Address)` if ownership is set, or `None` if ownership has
   * been renounced.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   */
  get_owner: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a get_report transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Public read of a report — lets anyone trace a registry entry back to the verifier
   * and evidence a reviewer relied on, not just trust the tier number blindly.
   */
  get_report: ({report_id}: {report_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<VerificationReport>>>

  /**
   * Construct and simulate a is_verified transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Convenience read: true only if a trust tier exists AND hasn't expired.
   */
  is_verified: ({institution}: {institution: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a submit_report transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Submit a verification report. Permissionless by design (see module docs) — the
   * verifier only needs to authenticate as themselves; nothing on the public registry
   * changes until a reviewer approves this report.
   */
  submit_report: ({verifier, institution, name, evidence_uri, recommended_tier}: {verifier: string, institution: string, name: string, evidence_uri: string, recommended_tier: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a get_institution transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Public read — no authorization required. This is the entire point of an on-chain
   * registry (proposal.md section 1): anyone can check a claim without asking Bleu first.
   */
  get_institution: ({institution}: {institution: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<InstitutionRecord>>>

  /**
   * Construct and simulate a accept_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Accepts a pending ownership transfer.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * 
   * # Errors
   * 
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * there is no pending transfer to accept.
   * 
   * # Events
   * 
   * * topics - `["ownership_transfer_completed"]`
   * * data - `[new_owner: Address]`
   */
  accept_ownership: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a list_institutions transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Every distinct institution that has ever had a report submitted, oldest first. A
   * frontend lists/searches by fetching this once, then `get_reports_for_institution` +
   * `get_institution` per address. See `DataKey::AllInstitutions` for why this is a plain
   * on-chain list rather than an indexer, at this PoC's scale.
   */
  list_institutions: (options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a renounce_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Renounces ownership of the contract.
   * 
   * Permanently removes the owner, disabling all functions gated by
   * `#[only_owner]`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * 
   * # Errors
   * 
   * * [`OwnableError::TransferInProgress`] - If there is a pending ownership
   * transfer.
   * * [`OwnableError::OwnerNotSet`] - If the owner is not set.
   * 
   * # Notes
   * 
   * * Authorization for the current owner is required.
   */
  renounce_ownership: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a transfer_ownership transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initiates a 2-step ownership transfer to a new address.
   * 
   * Requires authorization from the current owner. The new owner must later
   * call `accept_ownership()` to complete the transfer.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `new_owner` - The proposed new owner.
   * * `live_until_ledger` - Ledger number until which the new owner can
   * accept. A value of `0` cancels any pending transfer.
   * 
   * # Errors
   * 
   * * [`OwnableError::OwnerNotSet`] - If the owner is not set.
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * trying to cancel a transfer that doesn't exist.
   * * [`crate::role_transfer::RoleTransferError::InvalidLiveUntilLedger`] -
   * If the specified ledger is in the past.
   * * [`crate::role_transfer::RoleTransferError::InvalidPendingAccount`] -
   * If the specified pending account is not the same as the provided `new`
   * address.
   * 
   * # Notes
   * 
   * * Authorization for the current owner is required.
   */
  transfer_ownership: ({new_owner, live_until_ledger}: {new_owner: string, live_until_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a approve_verification transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Reviewer sign-off: reads the named report and writes the trust-tier entry the public
   * registry actually exposes. `expires_in_seconds` sets the re-verification expiry —
   * there is no permanent, unmaintained trust tier by construction.
   */
  approve_verification: ({report_id, trust_tier, expires_in_seconds}: {report_id: u64, trust_tier: u32, expires_in_seconds: u64}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_reports_for_institution transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * All report IDs submitted for one institution, oldest first — includes reports never
   * approved, so a frontend can show "pending review" institutions, not just verified ones.
   */
  get_reports_for_institution: ({institution}: {institution: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {owner}: {owner: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({owner}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAADVJlZ2lzdHJ5RXJyb3IAAAAAAAADAAAAAAAAAA5SZXBvcnROb3RGb3VuZAAAAAAAAQAAAAAAAAAQSW52YWxpZFRydXN0VGllcgAAAAIAAAAAAAAAFkluc3RpdHV0aW9uTm90VmVyaWZpZWQAAAAAAAM=",
        "AAAABQAAAAAAAAAAAAAAD1JlcG9ydFN1Ym1pdHRlZAAAAAABAAAAEHJlcG9ydF9zdWJtaXR0ZWQAAAADAAAAAAAAAAtpbnN0aXR1dGlvbgAAAAATAAAAAQAAAAAAAAAIdmVyaWZpZXIAAAATAAAAAAAAAAAAAAAJcmVwb3J0X2lkAAAAAAAABgAAAAAAAAAC",
        "AAAAAQAAAOpUaGUgcHVibGljIHJlZ2lzdHJ5IGVudHJ5IGZvciBvbmUgaW5zdGl0dXRpb24uIGByZXZpZXdlcmAgaXMgdGhlIGFjY291bnRhYmxlIG9uLWNoYWluCnNpZ25lciDigJQgdGhlIGN1cnJlbnQgYE93bmFibGVgIG93bmVyIGF0IGFwcHJvdmFsIHRpbWUg4oCUIG5vdCBuZWNlc3NhcmlseSB3aG8gZGlkIHRoZQpvbi10aGUtZ3JvdW5kIHZlcmlmaWNhdGlvbiAoYHJlcG9ydF9pZGAgbGlua3MgYmFjayB0byB0aGF0KS4AAAAAAAAAAAARSW5zdGl0dXRpb25SZWNvcmQAAAAAAAAFAAAAAAAAAApleHBpcmVzX2F0AAAAAAAGAAAAAAAAAAlyZXBvcnRfaWQAAAAAAAAGAAAAAAAAAAhyZXZpZXdlcgAAABMAAAAAAAAACnRydXN0X3RpZXIAAAAAAAQAAAAAAAAAC3ZlcmlmaWVkX2F0AAAAAAY=",
        "AAAAAQAAAbVBIHZlcmlmaWVyJ3MgcmVhbC13b3JsZCBsZWdpdGltYWN5IGNoZWNrIGZvciBvbmUgaW5zdGl0dXRpb24uIFdyaXR0ZW4gYnkgYHN1Ym1pdF9yZXBvcnRgOwpuZXZlciB3cml0dGVuIHRvIGRpcmVjdGx5IGJ5IGFueW9uZSBlbHNlLiBgZXZpZGVuY2VfdXJpYCBwb2ludHMgb2ZmLWNoYWluIChlLmcuIElQRlMgb3IgYQpwbGFpbiBVUkwpIOKAlCBubyBpbnN0aXR1dGlvbiBvciBkb25vciBQSUkgZ29lcyBvbi1jaGFpbiwgbWF0Y2hpbmcgcHJvcG9zYWwubWQgc2VjdGlvbiAyLgpgbmFtZWAgaXMgdGhlIGluc3RpdHV0aW9uJ3Mgc2VsZi1yZXBvcnRlZCBkaXNwbGF5IG5hbWUg4oCUIGluZm9ybWF0aW9uYWwgb25seSwgbmV2ZXIKYXV0aGVudGljYXRlZDsgdGhlIHRydXN0IHRpZXIgaXMgd2hhdCB2b3VjaGVzIGZvciBsZWdpdGltYWN5LCBub3QgdGhlIG5hbWUgc3RyaW5nLgAAAAAAAAAAAAASVmVyaWZpY2F0aW9uUmVwb3J0AAAAAAAGAAAAAAAAAAxldmlkZW5jZV91cmkAAAAQAAAAAAAAAAtpbnN0aXR1dGlvbgAAAAATAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAQcmVjb21tZW5kZWRfdGllcgAAAAQAAAAAAAAADHN1Ym1pdHRlZF9hdAAAAAYAAAAAAAAACHZlcmlmaWVyAAAAEw==",
        "AAAABQAAAAAAAAAAAAAAE0luc3RpdHV0aW9uVmVyaWZpZWQAAAAAAQAAABRpbnN0aXR1dGlvbl92ZXJpZmllZAAAAAQAAAAAAAAAC2luc3RpdHV0aW9uAAAAABMAAAABAAAAAAAAAAp0cnVzdF90aWVyAAAAAAAEAAAAAAAAAAAAAAAJcmVwb3J0X2lkAAAAAAAABgAAAAAAAAAAAAAACmV4cGlyZXNfYXQAAAAAAAYAAAAAAAAAAg==",
        "AAAAAAAAAJBSZXR1cm5zIGBTb21lKEFkZHJlc3MpYCBpZiBvd25lcnNoaXAgaXMgc2V0LCBvciBgTm9uZWAgaWYgb3duZXJzaGlwIGhhcwpiZWVuIHJlbm91bmNlZC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4AAAAJZ2V0X293bmVyAAAAAAAAAAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAJ5QdWJsaWMgcmVhZCBvZiBhIHJlcG9ydCDigJQgbGV0cyBhbnlvbmUgdHJhY2UgYSByZWdpc3RyeSBlbnRyeSBiYWNrIHRvIHRoZSB2ZXJpZmllcgphbmQgZXZpZGVuY2UgYSByZXZpZXdlciByZWxpZWQgb24sIG5vdCBqdXN0IHRydXN0IHRoZSB0aWVyIG51bWJlciBibGluZGx5LgAAAAAACmdldF9yZXBvcnQAAAAAAAEAAAAAAAAACXJlcG9ydF9pZAAAAAAAAAYAAAABAAAD6AAAB9AAAAASVmVyaWZpY2F0aW9uUmVwb3J0AAA=",
        "AAAAAAAAAEZDb252ZW5pZW5jZSByZWFkOiB0cnVlIG9ubHkgaWYgYSB0cnVzdCB0aWVyIGV4aXN0cyBBTkQgaGFzbid0IGV4cGlyZWQuAAAAAAALaXNfdmVyaWZpZWQAAAAAAQAAAAAAAAALaW5zdGl0dXRpb24AAAAAEwAAAAEAAAAB",
        "AAAAAAAAAO9gb3duZXJgIGlzIHRoZSBpbml0aWFsIHJldmlld2VyIG9mIHJlY29yZC4gT3duZXJzaGlwIGNhbiBtb3ZlIGxhdGVyIHZpYSB0aGUgc3RhbmRhcmQKYE93bmFibGVgIHRyYW5zZmVyIGZsb3cgKGB0cmFuc2Zlcl9vd25lcnNoaXBgIC8gYGFjY2VwdF9vd25lcnNoaXBgKSwgZXhwb3NlZCBiZWxvdyDigJQKdGhlIGNvbnRyYWN0IG5ldmVyIG5lZWRzIHRvIGNoYW5nZSB0byByZWNydWl0IGEgZGlmZmVyZW50IHJldmlld2VyLgAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABW93bmVyAAAAAAAAEwAAAAA=",
        "AAAAAAAAANFTdWJtaXQgYSB2ZXJpZmljYXRpb24gcmVwb3J0LiBQZXJtaXNzaW9ubGVzcyBieSBkZXNpZ24gKHNlZSBtb2R1bGUgZG9jcykg4oCUIHRoZQp2ZXJpZmllciBvbmx5IG5lZWRzIHRvIGF1dGhlbnRpY2F0ZSBhcyB0aGVtc2VsdmVzOyBub3RoaW5nIG9uIHRoZSBwdWJsaWMgcmVnaXN0cnkKY2hhbmdlcyB1bnRpbCBhIHJldmlld2VyIGFwcHJvdmVzIHRoaXMgcmVwb3J0LgAAAAAAAA1zdWJtaXRfcmVwb3J0AAAAAAAABQAAAAAAAAAIdmVyaWZpZXIAAAATAAAAAAAAAAtpbnN0aXR1dGlvbgAAAAATAAAAAAAAAARuYW1lAAAAEAAAAAAAAAAMZXZpZGVuY2VfdXJpAAAAEAAAAAAAAAAQcmVjb21tZW5kZWRfdGllcgAAAAQAAAABAAAABg==",
        "AAAAAAAAAKhQdWJsaWMgcmVhZCDigJQgbm8gYXV0aG9yaXphdGlvbiByZXF1aXJlZC4gVGhpcyBpcyB0aGUgZW50aXJlIHBvaW50IG9mIGFuIG9uLWNoYWluCnJlZ2lzdHJ5IChwcm9wb3NhbC5tZCBzZWN0aW9uIDEpOiBhbnlvbmUgY2FuIGNoZWNrIGEgY2xhaW0gd2l0aG91dCBhc2tpbmcgQmxldSBmaXJzdC4AAAAPZ2V0X2luc3RpdHV0aW9uAAAAAAEAAAAAAAAAC2luc3RpdHV0aW9uAAAAABMAAAABAAAD6AAAB9AAAAARSW5zdGl0dXRpb25SZWNvcmQAAAA=",
        "AAAAAAAAATBBY2NlcHRzIGEgcGVuZGluZyBvd25lcnNoaXAgdHJhbnNmZXIuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRoZXJlIGlzIG5vIHBlbmRpbmcgdHJhbnNmZXIgdG8gYWNjZXB0LgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsib3duZXJzaGlwX3RyYW5zZmVyX2NvbXBsZXRlZCJdYAoqIGRhdGEgLSBgW25ld19vd25lcjogQWRkcmVzc11gAAAAEGFjY2VwdF9vd25lcnNoaXAAAAAAAAAAAA==",
        "AAAAAAAAATVFdmVyeSBkaXN0aW5jdCBpbnN0aXR1dGlvbiB0aGF0IGhhcyBldmVyIGhhZCBhIHJlcG9ydCBzdWJtaXR0ZWQsIG9sZGVzdCBmaXJzdC4gQQpmcm9udGVuZCBsaXN0cy9zZWFyY2hlcyBieSBmZXRjaGluZyB0aGlzIG9uY2UsIHRoZW4gYGdldF9yZXBvcnRzX2Zvcl9pbnN0aXR1dGlvbmAgKwpgZ2V0X2luc3RpdHV0aW9uYCBwZXIgYWRkcmVzcy4gU2VlIGBEYXRhS2V5OjpBbGxJbnN0aXR1dGlvbnNgIGZvciB3aHkgdGhpcyBpcyBhIHBsYWluCm9uLWNoYWluIGxpc3QgcmF0aGVyIHRoYW4gYW4gaW5kZXhlciwgYXQgdGhpcyBQb0MncyBzY2FsZS4AAAAAAAARbGlzdF9pbnN0aXR1dGlvbnMAAAAAAAAAAAAAAQAAA+oAAAAT",
        "AAAAAAAAAYVSZW5vdW5jZXMgb3duZXJzaGlwIG9mIHRoZSBjb250cmFjdC4KClBlcm1hbmVudGx5IHJlbW92ZXMgdGhlIG93bmVyLCBkaXNhYmxpbmcgYWxsIGZ1bmN0aW9ucyBnYXRlZCBieQpgI1tvbmx5X293bmVyXWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCgojIEVycm9ycwoKKiBbYE93bmFibGVFcnJvcjo6VHJhbnNmZXJJblByb2dyZXNzYF0gLSBJZiB0aGVyZSBpcyBhIHBlbmRpbmcgb3duZXJzaGlwCnRyYW5zZmVyLgoqIFtgT3duYWJsZUVycm9yOjpPd25lck5vdFNldGBdIC0gSWYgdGhlIG93bmVyIGlzIG5vdCBzZXQuCgojIE5vdGVzCgoqIEF1dGhvcml6YXRpb24gZm9yIHRoZSBjdXJyZW50IG93bmVyIGlzIHJlcXVpcmVkLgAAAAAAABJyZW5vdW5jZV9vd25lcnNoaXAAAAAAAAAAAAAA",
        "AAAAAAAAA45Jbml0aWF0ZXMgYSAyLXN0ZXAgb3duZXJzaGlwIHRyYW5zZmVyIHRvIGEgbmV3IGFkZHJlc3MuCgpSZXF1aXJlcyBhdXRob3JpemF0aW9uIGZyb20gdGhlIGN1cnJlbnQgb3duZXIuIFRoZSBuZXcgb3duZXIgbXVzdCBsYXRlcgpjYWxsIGBhY2NlcHRfb3duZXJzaGlwKClgIHRvIGNvbXBsZXRlIHRoZSB0cmFuc2Zlci4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgbmV3X293bmVyYCAtIFRoZSBwcm9wb3NlZCBuZXcgb3duZXIuCiogYGxpdmVfdW50aWxfbGVkZ2VyYCAtIExlZGdlciBudW1iZXIgdW50aWwgd2hpY2ggdGhlIG5ldyBvd25lciBjYW4KYWNjZXB0LiBBIHZhbHVlIG9mIGAwYCBjYW5jZWxzIGFueSBwZW5kaW5nIHRyYW5zZmVyLgoKIyBFcnJvcnMKCiogW2BPd25hYmxlRXJyb3I6Ok93bmVyTm90U2V0YF0gLSBJZiB0aGUgb3duZXIgaXMgbm90IHNldC4KKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRyeWluZyB0byBjYW5jZWwgYSB0cmFuc2ZlciB0aGF0IGRvZXNuJ3QgZXhpc3QuCiogW2BjcmF0ZTo6cm9sZV90cmFuc2Zlcjo6Um9sZVRyYW5zZmVyRXJyb3I6OkludmFsaWRMaXZlVW50aWxMZWRnZXJgXSAtCklmIHRoZSBzcGVjaWZpZWQgbGVkZ2VyIGlzIGluIHRoZSBwYXN0LgoqIFtgY3JhdGU6OnJvbGVfdHJhbnNmZXI6OlJvbGVUcmFuc2ZlckVycm9yOjpJbnZhbGlkUGVuZGluZ0FjY291bnRgXSAtCklmIHRoZSBzcGVjaWZpZWQgcGVuZGluZyBhY2NvdW50IGlzIG5vdCB0aGUgc2FtZSBhcyB0aGUgcHJvdmlkZWQgYG5ld2AKYWRkcmVzcy4KCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgb3duZXIgaXMgcmVxdWlyZWQuAAAAAAASdHJhbnNmZXJfb3duZXJzaGlwAAAAAAACAAAAAAAAAAluZXdfb3duZXIAAAAAAAATAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAA",
        "AAAAAAAAAOhSZXZpZXdlciBzaWduLW9mZjogcmVhZHMgdGhlIG5hbWVkIHJlcG9ydCBhbmQgd3JpdGVzIHRoZSB0cnVzdC10aWVyIGVudHJ5IHRoZSBwdWJsaWMKcmVnaXN0cnkgYWN0dWFsbHkgZXhwb3Nlcy4gYGV4cGlyZXNfaW5fc2Vjb25kc2Agc2V0cyB0aGUgcmUtdmVyaWZpY2F0aW9uIGV4cGlyeSDigJQKdGhlcmUgaXMgbm8gcGVybWFuZW50LCB1bm1haW50YWluZWQgdHJ1c3QgdGllciBieSBjb25zdHJ1Y3Rpb24uAAAAFGFwcHJvdmVfdmVyaWZpY2F0aW9uAAAAAwAAAAAAAAAJcmVwb3J0X2lkAAAAAAAABgAAAAAAAAAKdHJ1c3RfdGllcgAAAAAABAAAAAAAAAASZXhwaXJlc19pbl9zZWNvbmRzAAAAAAAGAAAAAA==",
        "AAAAAAAAAK1BbGwgcmVwb3J0IElEcyBzdWJtaXR0ZWQgZm9yIG9uZSBpbnN0aXR1dGlvbiwgb2xkZXN0IGZpcnN0IOKAlCBpbmNsdWRlcyByZXBvcnRzIG5ldmVyCmFwcHJvdmVkLCBzbyBhIGZyb250ZW5kIGNhbiBzaG93ICJwZW5kaW5nIHJldmlldyIgaW5zdGl0dXRpb25zLCBub3QganVzdCB2ZXJpZmllZCBvbmVzLgAAAAAAABtnZXRfcmVwb3J0c19mb3JfaW5zdGl0dXRpb24AAAAAAQAAAAAAAAALaW5zdGl0dXRpb24AAAAAEwAAAAEAAAPqAAAABg==",
        "AAAABAAAAAAAAAAAAAAAEVJvbGVUcmFuc2ZlckVycm9yAAAAAAAABAAAAAAAAAARTm9QZW5kaW5nVHJhbnNmZXIAAAAAAAiYAAAAAAAAABZJbnZhbGlkTGl2ZVVudGlsTGVkZ2VyAAAAAAiZAAAAAAAAABVJbnZhbGlkUGVuZGluZ0FjY291bnQAAAAAAAiaAAAAAAAAAA9UcmFuc2ZlckV4cGlyZWQAAAAImw==",
        "AAAABAAAAAAAAAAAAAAADE93bmFibGVFcnJvcgAAAAMAAAAAAAAAC093bmVyTm90U2V0AAAACDQAAAAAAAAAElRyYW5zZmVySW5Qcm9ncmVzcwAAAAAINQAAAAAAAAAPT3duZXJBbHJlYWR5U2V0AAAACDY=",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYW4gb3duZXJzaGlwIHRyYW5zZmVyIGlzIGluaXRpYXRlZC4AAAAAAAAAAAART3duZXJzaGlwVHJhbnNmZXIAAAAAAAABAAAAEm93bmVyc2hpcF90cmFuc2ZlcgAAAAAAAwAAAAAAAAAJb2xkX293bmVyAAAAAAAAEwAAAAAAAAAAAAAACW5ld19vd25lcgAAAAAAABMAAAAAAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAAAAAAAg==",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gb3duZXJzaGlwIGlzIHJlbm91bmNlZC4AAAAAAAAAAAAST3duZXJzaGlwUmVub3VuY2VkAAAAAAABAAAAE293bmVyc2hpcF9yZW5vdW5jZWQAAAAAAQAAAAAAAAAJb2xkX293bmVyAAAAAAAAEwAAAAAAAAAC",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYW4gb3duZXJzaGlwIHRyYW5zZmVyIGlzIGNvbXBsZXRlZC4AAAAAAAAAAAAaT3duZXJzaGlwVHJhbnNmZXJDb21wbGV0ZWQAAAAAAAEAAAAcb3duZXJzaGlwX3RyYW5zZmVyX2NvbXBsZXRlZAAAAAEAAAAAAAAACW5ld19vd25lcgAAAAAAABMAAAAAAAAAAg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_owner: this.txFromJSON<Option<string>>,
        get_report: this.txFromJSON<Option<VerificationReport>>,
        is_verified: this.txFromJSON<boolean>,
        submit_report: this.txFromJSON<u64>,
        get_institution: this.txFromJSON<Option<InstitutionRecord>>,
        accept_ownership: this.txFromJSON<null>,
        list_institutions: this.txFromJSON<Array<string>>,
        renounce_ownership: this.txFromJSON<null>,
        transfer_ownership: this.txFromJSON<null>,
        approve_verification: this.txFromJSON<null>,
        get_reports_for_institution: this.txFromJSON<Array<u64>>
  }
}