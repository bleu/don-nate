import { useState } from "react";
import { useWallet } from "../lib/WalletContext";
import { useInstitutions } from "../lib/useInstitutions";
import { truncateAddress } from "../lib/format";
import { ANCHOR_HOME_DOMAIN, initiateDeposit, pollTransaction, sep10Authenticate, type AnchorTransaction } from "../lib/anchor";
import { ensureUsdcTrustline, getUsdcBalance, sendUsdcToInstitution } from "../lib/payment";

type Stage = "pick" | "trustline" | "deposit" | "send" | "done";

export function Donate() {
  const { address, connecting, connect } = useWallet();
  const { items, error: loadError } = useInstitutions();

  const [institution, setInstitution] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const verified = (items ?? []).filter((item) => item.verified);
  const selected = verified.find((item) => item.address === institution) ?? null;

  async function selectInstitution(addr: string) {
    setInstitution(addr);
    setError(null);
    if (!address) return;
    setBusy(true);
    try {
      const balance = await getUsdcBalance(address);
      setStage(balance === null ? "trustline" : "deposit");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onAddTrustline() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      await ensureUsdcTrustline(address);
      setStage("deposit");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDeposit() {
    if (!address) return;
    setBusy(true);
    setError(null);
    // Opened now, synchronously, so browsers don't treat it as an unrequested popup once the
    // async SEP-10/SEP-24 calls below resolve.
    const popup = window.open("", "_blank");
    try {
      setStatusText("Authenticating with the anchor…");
      const jwt = await sep10Authenticate(address);
      setStatusText("Opening the deposit window…");
      const { id, url } = await initiateDeposit(jwt, address);
      if (popup) popup.location.href = url;
      setStatusText("Waiting for you to complete the deposit in the popup window…");
      const final = await pollTransaction(jwt, id, (tx: AnchorTransaction) => setStatusText(describeStatus(tx.status)));
      if (final.status !== "completed") {
        throw new Error(`Deposit ended with status "${final.status}" — try again.`);
      }
      setAmount(final.amount_out ?? "");
      setStatusText(null);
      setStage("send");
    } catch (err) {
      popup?.close();
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    if (!address || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const hash = await sendUsdcToInstitution(address, selected.address, amount);
      setTxHash(hash);
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <section>
        <div className="section-head">
          <p className="eyebrow">Step 03 — Give</p>
          <h2>Donate to a verified institution.</h2>
          <p>
            Pay in your own currency; it lands on Stellar as USDC, then you forward it on-chain
            to the institution you picked — visible the whole way.
          </p>
        </div>

        <div className="status-band" style={{ marginBottom: 28 }}>
          <span className="mark">Demo anchor</span>
          <p>
            This runs against Stellar's public reference anchor (<span className="mono">{ANCHOR_HOME_DOMAIN}</span>),
            not MoneyGram directly — MoneyGram Ramps requires partner approval Bleu hasn't completed yet. Both speak
            the same SEP-10/SEP-24 protocol, so swapping in MoneyGram later is a config change, not a rebuild.
          </p>
        </div>

        {!address ? (
          <div className="status-band">
            <span className="mark">Wallet</span>
            <p>
              Connect a Stellar testnet wallet to donate — you'll sign the on-chain transfer to the institution yourself.{" "}
              <button className="btn" style={{ marginLeft: 12 }} onClick={() => void connect()} disabled={connecting}>
                {connecting ? "Connecting…" : "Connect wallet"}
              </button>
            </p>
          </div>
        ) : loadError ? (
          <div className="status-band error">
            <span className="mark">Error</span>
            <p>{loadError}</p>
          </div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            <div className="field">
              <label>Institution</label>
              <span className="hint">Only institutions with an approved trust tier can receive donations here.</span>
              {items === null ? (
                <p style={{ color: "var(--ink-soft)" }}>Loading from Stellar testnet…</p>
              ) : verified.length === 0 ? (
                <p style={{ color: "var(--ink-soft)" }}>No verified institutions yet — check back after "Register."</p>
              ) : (
                <div role="table" style={{ marginTop: 8 }}>
                  {verified.map((item) => (
                    <label
                      key={item.address}
                      className="list-row"
                      style={{
                        gridTemplateColumns: "auto 1fr auto",
                        cursor: "pointer",
                        border: institution === item.address ? "1px solid var(--brass)" : "1px solid var(--rule)",
                      }}
                    >
                      <input
                        type="radio"
                        name="institution"
                        checked={institution === item.address}
                        onChange={() => void selectInstitution(item.address)}
                      />
                      <span className="name">{item.latestReport?.name || "(unnamed)"}</span>
                      <span className="addr">{truncateAddress(item.address)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selected && (
              <div className="ledger-card" style={{ marginTop: 24 }}>
                <div className="ledger-head">
                  <span>Donation</span>
                  <span>{selected.latestReport?.name || truncateAddress(selected.address)}</span>
                </div>

                {stage === "trustline" && (
                  <div>
                    <p>Your wallet doesn't hold USDC yet — it needs a trustline before it can receive the deposit.</p>
                    <button className="btn" onClick={() => void onAddTrustline()} disabled={busy}>
                      {busy ? "Adding…" : "Add USDC trustline"}
                    </button>
                  </div>
                )}

                {stage === "deposit" && (
                  <div>
                    <p>
                      Deposit cash in your local currency; the anchor converts it and credits USDC to your own
                      wallet.
                    </p>
                    <button className="btn" onClick={() => void onDeposit()} disabled={busy}>
                      {busy ? "Working…" : "Deposit via MoneyGram"}
                    </button>
                    {statusText && <p className="card-caption">{statusText}</p>}
                  </div>
                )}

                {stage === "send" && (
                  <form onSubmit={(e) => { e.preventDefault(); void onSend(); }}>
                    <p>USDC landed in your wallet. Confirm the amount to forward on-chain to the institution.</p>
                    <div className="field">
                      <label htmlFor="amount">Amount (USDC)</label>
                      <input
                        id="amount"
                        className="mono"
                        type="number"
                        min="0"
                        step="0.0000001"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </div>
                    <button className="btn" type="submit" disabled={busy}>
                      {busy ? "Sending…" : "Send to institution"}
                    </button>
                  </form>
                )}

                {stage === "done" && txHash && (
                  <div>
                    <p>
                      Sent. <span className="mono">{amount} USDC</span> is now on-chain at{" "}
                      {selected.latestReport?.name || truncateAddress(selected.address)}.
                    </p>
                    <p className="card-caption">
                      <a href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer">
                        View transaction {truncateAddress(txHash)}
                      </a>
                    </p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="status-band error" style={{ marginTop: 20 }}>
                <span className="mark">Error</span>
                <p>{error}</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function describeStatus(status: string): string {
  switch (status) {
    case "incomplete":
      return "Waiting for you to complete the deposit in the popup window…";
    case "pending_user_transfer_start":
      return "Waiting for your cash deposit at a MoneyGram location…";
    case "pending_external":
    case "pending_anchor":
      return "The anchor is processing your deposit…";
    case "pending_stellar":
      return "Sending USDC to your wallet on Stellar…";
    case "pending_trust":
      return "Waiting on a USDC trustline…";
    case "pending_user":
      return "The anchor needs more information from you — check the popup window.";
    default:
      return `Status: ${status}`;
  }
}
