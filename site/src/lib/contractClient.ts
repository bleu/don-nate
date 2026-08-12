import { Client, networks } from "../contracts/institution-registry/dist/index.js";
import { signTransaction } from "./wallet";

const RPC_URL = "https://soroban-testnet.stellar.org";

/**
 * A read-only client — no wallet needed. Used for browsing/searching, which the proposal
 * (section 1) is explicit should never require asking Bleu first.
 */
export function readOnlyClient(): Client {
  return new Client({
    ...networks.testnet,
    rpcUrl: RPC_URL,
  });
}

/**
 * A wallet-backed client for state-changing calls (submit_report, approve_verification).
 * `publicKey` is the connected wallet's address, used as the transaction source.
 */
export function walletClient(publicKey: string): Client {
  return new Client({
    ...networks.testnet,
    rpcUrl: RPC_URL,
    publicKey,
    signTransaction: (xdr) =>
      signTransaction(xdr, { networkPassphrase: networks.testnet.networkPassphrase, address: publicKey }),
  });
}
