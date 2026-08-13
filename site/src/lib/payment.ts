import { Asset, BASE_FEE, Horizon, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { signTransaction } from "./wallet";
import { getAnchorConfig } from "./anchor";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

function server(): Horizon.Server {
  return new Horizon.Server(HORIZON_URL);
}

function findTrustline(
  balances: readonly Horizon.HorizonApi.BalanceLine[],
  assetCode: string,
  assetIssuer: string,
): Horizon.HorizonApi.BalanceLine | undefined {
  return balances.find(
    (b) => "asset_code" in b && b.asset_code === assetCode && "asset_issuer" in b && b.asset_issuer === assetIssuer,
  );
}

/** Returns the account's USDC balance, or null if it has no trustline for it yet. */
export async function getUsdcBalance(publicKey: string): Promise<string | null> {
  const { usdcAssetCode, usdcAssetIssuer } = await getAnchorConfig();
  const account = await server().loadAccount(publicKey);
  const line = findTrustline(account.balances, usdcAssetCode, usdcAssetIssuer);
  return line ? line.balance : null;
}

/** Establishes a USDC trustline on the connected wallet if it doesn't already have one. A no-op otherwise. */
export async function ensureUsdcTrustline(publicKey: string): Promise<void> {
  const { usdcAssetCode, usdcAssetIssuer } = await getAnchorConfig();
  const account = await server().loadAccount(publicKey);
  if (findTrustline(account.balances, usdcAssetCode, usdcAssetIssuer)) return;

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.changeTrust({ asset: new Asset(usdcAssetCode, usdcAssetIssuer) }))
    .setTimeout(180)
    .build();

  const { signedTxXdr } = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE, address: publicKey });
  await server().submitTransaction(TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE));
}

/**
 * Forwards `amount` USDC from the donor's own wallet to the institution's address — the second
 * half of the donate flow, after the anchor deposit has landed USDC in the donor's account.
 */
export async function sendUsdcToInstitution(publicKey: string, destination: string, amount: string): Promise<string> {
  const { usdcAssetCode, usdcAssetIssuer } = await getAnchorConfig();
  const asset = new Asset(usdcAssetCode, usdcAssetIssuer);

  let destinationAccount;
  try {
    destinationAccount = await server().loadAccount(destination);
  } catch {
    throw new Error("This institution's Stellar account doesn't exist on testnet — it can't receive a payment yet.");
  }
  if (!findTrustline(destinationAccount.balances, usdcAssetCode, usdcAssetIssuer)) {
    throw new Error("This institution's wallet doesn't have a USDC trustline yet — it can't receive this donation.");
  }

  const sourceAccount = await server().loadAccount(publicKey);
  const tx = new TransactionBuilder(sourceAccount, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.payment({ destination, asset, amount }))
    .setTimeout(180)
    .build();

  const { signedTxXdr } = await signTransaction(tx.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE, address: publicKey });
  const result = await server().submitTransaction(TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE));
  return result.hash;
}
