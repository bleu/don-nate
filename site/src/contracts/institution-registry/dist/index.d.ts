import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions } from "@stellar/stellar-sdk/contract";
import type { u32, u64, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CBTVW5WLVZYBOV4SYUOJLCHO6TD654K6T2KGHNABSJCQXH6HW5YRLLMR";
    };
};
export declare const RegistryError: {
    1: {
        message: string;
    };
    2: {
        message: string;
    };
    3: {
        message: string;
    };
};
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
export declare const RoleTransferError: {
    2200: {
        message: string;
    };
    2201: {
        message: string;
    };
    2202: {
        message: string;
    };
    2203: {
        message: string;
    };
};
export declare const OwnableError: {
    2100: {
        message: string;
    };
    2101: {
        message: string;
    };
    2102: {
        message: string;
    };
};
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
    get_owner: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>;
    /**
     * Construct and simulate a get_report transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Public read of a report — lets anyone trace a registry entry back to the verifier
     * and evidence a reviewer relied on, not just trust the tier number blindly.
     */
    get_report: ({ report_id }: {
        report_id: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Option<VerificationReport>>>;
    /**
     * Construct and simulate a is_verified transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Convenience read: true only if a trust tier exists AND hasn't expired.
     */
    is_verified: ({ institution }: {
        institution: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>;
    /**
     * Construct and simulate a submit_report transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Submit a verification report. Permissionless by design (see module docs) — the
     * verifier only needs to authenticate as themselves; nothing on the public registry
     * changes until a reviewer approves this report.
     */
    submit_report: ({ verifier, institution, name, evidence_uri, recommended_tier }: {
        verifier: string;
        institution: string;
        name: string;
        evidence_uri: string;
        recommended_tier: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<u64>>;
    /**
     * Construct and simulate a get_institution transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Public read — no authorization required. This is the entire point of an on-chain
     * registry (proposal.md section 1): anyone can check a claim without asking Bleu first.
     */
    get_institution: ({ institution }: {
        institution: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Option<InstitutionRecord>>>;
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
    accept_ownership: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a list_institutions transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Every distinct institution that has ever had a report submitted, oldest first. A
     * frontend lists/searches by fetching this once, then `get_reports_for_institution` +
     * `get_institution` per address. See `DataKey::AllInstitutions` for why this is a plain
     * on-chain list rather than an indexer, at this PoC's scale.
     */
    list_institutions: (options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>;
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
    renounce_ownership: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;
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
    transfer_ownership: ({ new_owner, live_until_ledger }: {
        new_owner: string;
        live_until_ledger: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a approve_verification transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Reviewer sign-off: reads the named report and writes the trust-tier entry the public
     * registry actually exposes. `expires_in_seconds` sets the re-verification expiry —
     * there is no permanent, unmaintained trust tier by construction.
     */
    approve_verification: ({ report_id, trust_tier, expires_in_seconds }: {
        report_id: u64;
        trust_tier: u32;
        expires_in_seconds: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_reports_for_institution transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * All report IDs submitted for one institution, oldest first — includes reports never
     * approved, so a frontend can show "pending review" institutions, not just verified ones.
     */
    get_reports_for_institution: ({ institution }: {
        institution: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    { owner }: {
        owner: string;
    }, 
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        get_owner: (json: string) => AssembledTransaction<Option<string>>;
        get_report: (json: string) => AssembledTransaction<Option<VerificationReport>>;
        is_verified: (json: string) => AssembledTransaction<boolean>;
        submit_report: (json: string) => AssembledTransaction<bigint>;
        get_institution: (json: string) => AssembledTransaction<Option<InstitutionRecord>>;
        accept_ownership: (json: string) => AssembledTransaction<null>;
        list_institutions: (json: string) => AssembledTransaction<string[]>;
        renounce_ownership: (json: string) => AssembledTransaction<null>;
        transfer_ownership: (json: string) => AssembledTransaction<null>;
        approve_verification: (json: string) => AssembledTransaction<null>;
        get_reports_for_institution: (json: string) => AssembledTransaction<bigint[]>;
    };
}
