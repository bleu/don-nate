import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../lib/WalletContext";
import { walletClient } from "../lib/contractClient";

export function Register() {
  const { address, connecting, connect } = useWallet();
  const navigate = useNavigate();

  const [institution, setInstitution] = useState("");
  const [name, setName] = useState("");
  const [evidenceUri, setEvidenceUri] = useState("");
  const [recommendedTier, setRecommendedTier] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!address) return;
    setSubmitting(true);
    setError(null);
    try {
      const client = walletClient(address);
      const assembled = await client.submit_report({
        verifier: address,
        institution: institution.trim(),
        name: name.trim(),
        evidence_uri: evidenceUri.trim(),
        recommended_tier: recommendedTier,
      });
      const sent = await assembled.signAndSend();
      const reportId = sent.result;
      navigate(`/browse?justSubmitted=${institution.trim()}&report=${reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wrap">
      <section>
        <div className="section-head">
          <p className="eyebrow">Step 01 — Verify</p>
          <h2>Submit a verification report.</h2>
          <p>
            Permissionless, by design (see the home page). This alone changes nothing on the
            public registry — a reviewer still has to approve it before a trust tier is written
            on-chain.
          </p>
        </div>

        {!address ? (
          <div className="status-band">
            <span className="mark">Wallet</span>
            <p>
              Connect a Stellar testnet wallet to submit a report — the transaction is signed
              by you, as the verifier of record for this report.{" "}
              <button className="btn" style={{ marginLeft: 12 }} onClick={() => void connect()} disabled={connecting}>
                {connecting ? "Connecting…" : "Connect wallet"}
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ maxWidth: 560 }}>
            <div className="field">
              <label htmlFor="institution">Institution address</label>
              <input
                id="institution"
                className="mono"
                placeholder="G..."
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                required
                pattern="^G[A-Z2-7]{55}$"
                title="A Stellar public key, starting with G"
              />
              <span className="hint">The institution's Stellar address — donations would eventually settle here.</span>
            </div>

            <div className="field">
              <label htmlFor="name">Institution name</label>
              <input
                id="name"
                placeholder="Example Aid Foundation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
              <span className="hint">Self-reported and never authenticated — the trust tier is what vouches for legitimacy, not this name.</span>
            </div>

            <div className="field">
              <label htmlFor="evidence">Evidence URL</label>
              <input
                id="evidence"
                className="mono"
                type="url"
                placeholder="https://..."
                value={evidenceUri}
                onChange={(e) => setEvidenceUri(e.target.value)}
                required
              />
              <span className="hint">Points off-chain — no institution or donor PII goes on-chain.</span>
            </div>

            <div className="field">
              <label htmlFor="tier">Recommended trust tier</label>
              <input
                id="tier"
                className="mono"
                type="number"
                min={1}
                max={5}
                value={recommendedTier}
                onChange={(e) => setRecommendedTier(Number(e.target.value))}
                required
                style={{ maxWidth: 120 }}
              />
              <span className="hint">The reviewer can approve at a different tier than you recommend.</span>
            </div>

            {error && (
              <div className="status-band error" style={{ marginBottom: 20 }}>
                <span className="mark">Error</span>
                <p>{error}</p>
              </div>
            )}

            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit report"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
