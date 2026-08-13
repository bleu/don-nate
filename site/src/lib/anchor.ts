import { StellarToml, WebAuth } from "@stellar/stellar-sdk";
import { signTransaction } from "./wallet";

/**
 * MoneyGram Ramps requires partner-portal approval before any sandbox access is granted — there
 * is no open testnet a wallet can hit without first being allowlisted. This points at Stellar's
 * own public reference anchor instead, which speaks the exact same SEP-10/SEP-24 protocol
 * MoneyGram does. Swapping to MoneyGram once Bleu is approved is a change to this one constant,
 * not a rewrite of the client below.
 */
export const ANCHOR_HOME_DOMAIN = "testanchor.stellar.org";

export interface AnchorConfig {
  webAuthEndpoint: string;
  transferServer: string;
  signingKey: string;
  networkPassphrase: string;
  usdcAssetCode: string;
  usdcAssetIssuer: string;
}

let cachedConfig: Promise<AnchorConfig> | null = null;

export function getAnchorConfig(): Promise<AnchorConfig> {
  if (!cachedConfig) {
    cachedConfig = StellarToml.Resolver.resolve(ANCHOR_HOME_DOMAIN).then((toml) => {
      const usdc = toml.CURRENCIES?.find((c) => c.code === "USDC");
      if (!toml.WEB_AUTH_ENDPOINT || !toml.TRANSFER_SERVER_SEP0024 || !toml.SIGNING_KEY || !usdc?.issuer) {
        throw new Error(`${ANCHOR_HOME_DOMAIN}'s stellar.toml is missing required SEP-10/SEP-24/USDC fields`);
      }
      return {
        webAuthEndpoint: toml.WEB_AUTH_ENDPOINT,
        transferServer: toml.TRANSFER_SERVER_SEP0024,
        signingKey: toml.SIGNING_KEY,
        networkPassphrase: toml.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
        usdcAssetCode: usdc.code!,
        usdcAssetIssuer: usdc.issuer,
      };
    });
  }
  return cachedConfig;
}

/** SEP-10: authenticates `publicKey` with the anchor, signing the challenge with the connected wallet. */
export async function sep10Authenticate(publicKey: string): Promise<string> {
  const { webAuthEndpoint, signingKey, networkPassphrase } = await getAnchorConfig();

  const challengeUrl = new URL(webAuthEndpoint);
  challengeUrl.searchParams.set("account", publicKey);
  challengeUrl.searchParams.set("home_domain", ANCHOR_HOME_DOMAIN);
  const challengeRes = await fetch(challengeUrl.toString());
  if (!challengeRes.ok) throw new Error(`SEP-10 challenge request failed: ${challengeRes.status}`);
  const { transaction, network_passphrase } = await challengeRes.json();
  const passphrase = network_passphrase ?? networkPassphrase;

  // Refuse to sign a challenge that isn't actually from this anchor for this home domain.
  WebAuth.readChallengeTx(transaction, signingKey, passphrase, ANCHOR_HOME_DOMAIN, new URL(webAuthEndpoint).host);

  const { signedTxXdr } = await signTransaction(transaction, { networkPassphrase: passphrase, address: publicKey });

  const tokenRes = await fetch(webAuthEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: signedTxXdr }),
  });
  if (!tokenRes.ok) throw new Error(`SEP-10 token request failed: ${tokenRes.status}`);
  const { token } = await tokenRes.json();
  return token;
}

export interface AnchorTransaction {
  id: string;
  status: string;
  amount_in?: string;
  amount_out?: string;
  to?: string;
  more_info_url?: string;
}

/** SEP-24: opens an interactive deposit session. The returned `url` must be opened for the user to complete KYC and pay. */
export async function initiateDeposit(jwt: string, publicKey: string): Promise<{ id: string; url: string }> {
  const { transferServer, usdcAssetCode } = await getAnchorConfig();
  const res = await fetch(`${transferServer}/transactions/deposit/interactive`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ asset_code: usdcAssetCode, account: publicKey }),
  });
  if (!res.ok) throw new Error(`Deposit initiation failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, url: data.url };
}

export async function getTransaction(jwt: string, id: string): Promise<AnchorTransaction> {
  const { transferServer } = await getAnchorConfig();
  const res = await fetch(`${transferServer}/transaction?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new Error(`Transaction lookup failed: ${res.status}`);
  const { transaction } = await res.json();
  return transaction;
}

const TERMINAL_STATUSES = new Set(["completed", "error", "refunded", "expired", "too_small", "too_large"]);

/** Polls until the deposit reaches a terminal status, reporting every intermediate status via `onUpdate`. */
export async function pollTransaction(
  jwt: string,
  id: string,
  onUpdate: (tx: AnchorTransaction) => void,
  { intervalMs = 3000, maxAttempts = 300 }: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<AnchorTransaction> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tx = await getTransaction(jwt, id);
    onUpdate(tx);
    if (TERMINAL_STATUSES.has(tx.status)) return tx;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for the deposit to complete");
}
