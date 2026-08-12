import { Link } from "react-router-dom";

export function Home() {
  return (
    <div className="wrap">
      <section className="hero" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 56, alignItems: "center", padding: "48px 0 96px" }}>
        <div>
          <p className="eyebrow">Stellar SCF #45 — Integration Track</p>
          <h1 style={{ fontSize: "clamp(2.3rem, 4vw, 3.4rem)", lineHeight: 1.12, maxWidth: "15ch" }}>
            Trust that travels <span style={{ color: "var(--stamp)" }}>with the money.</span>
          </h1>
          <p style={{ maxWidth: "46ch", color: "var(--ink-soft)", fontSize: "1.12rem", marginTop: 22 }}>
            Don Nate is a public, on-chain registry recording which institutions have been
            vetted, at what trust tier, by whom, and when — a fact anyone can check against the
            Stellar ledger, instead of a private spreadsheet or a claim on a website.
          </p>
          <div style={{ display: "flex", gap: 20, marginTop: 34, alignItems: "center", flexWrap: "wrap" }}>
            <Link className="btn" to="/browse">Browse the registry</Link>
            <Link className="btn secondary" to="/register">Register an institution</Link>
          </div>
        </div>

        <div>
          <div className="ledger-card">
            <span className="stamp-badge">Verified</span>
            <div className="ledger-head">
              <span>Registry Entry</span>
              <span>Institution Trust Registry</span>
            </div>
            <dl style={{ margin: 0 }}>
              <div className="ledger-row">
                <dt>Institution</dt>
                <dd>GC7X…M4QP</dd>
              </div>
              <div className="ledger-row">
                <dt>Trust tier</dt>
                <dd><span className="tier-tag">Tier 3</span></dd>
              </div>
              <div className="ledger-row">
                <dt>Reviewer of record</dt>
                <dd>GBAL…7RS2</dd>
              </div>
              <div className="ledger-row">
                <dt>Verified</dt>
                <dd>2026-07-14</dd>
              </div>
              <div className="ledger-row">
                <dt>Expires</dt>
                <dd>2027-07-14</dd>
              </div>
              <div className="ledger-row">
                <dt>Report ref.</dt>
                <dd>#0042</dd>
              </div>
            </dl>
          </div>
          <p className="card-caption">Illustrative — see the real registry under "Browse."</p>
        </div>
      </section>

      <section id="problem">
        <div className="section-head">
          <p className="eyebrow">The problem</p>
          <h2>Two things stand between a donor and a small institution abroad.</h2>
        </div>
        <div className="problem-grid">
          <article>
            <h3>Verification doesn't travel</h3>
            <p>
              A donor deciding whether a foreign institution is legitimate has almost nothing to
              go on beyond the institution's own claims. Verification, where it happens at all,
              is manual, private, and locked to whichever platform did it — it doesn't transfer
              anywhere else.
            </p>
          </article>
          <article>
            <h3>Small institutions are unreachable</h3>
            <p>
              A legitimate local institution without international bank rails is effectively
              invisible to international donors — not because it isn't real, but because
              there's no economical way for money to reach it.
            </p>
          </article>
        </div>
      </section>

      <section id="how" className="rule-top">
        <div className="section-head">
          <p className="eyebrow">How it works</p>
          <h2>Three steps, in order — each one gates the next.</h2>
          <p>
            No step can be skipped: a report has to exist before it can be approved, and a
            trust tier has to exist before a donation can be routed against it.
          </p>
        </div>
        <div className="steps">
          <div className="step">
            <span className="num">01</span>
            <h3>Verify</h3>
            <p>
              Someone checks an institution's real-world legitimacy — does it exist, does it
              run what it claims — and submits a report with evidence.
            </p>
            <span className="role">Verifier — permissionless</span>
          </div>
          <div className="step">
            <span className="num">02</span>
            <h3>Review</h3>
            <p>
              An accountable reviewer signs off on a specific report and writes a trust tier
              on-chain — traceable back to the evidence that backed it.
            </p>
            <span className="role">Reviewer — accountable signer</span>
          </div>
          <div className="step">
            <span className="num">03</span>
            <h3>Give</h3>
            <p>
              A donor browses the registry, picks one institution or a self-defined basket of
              several, and donates — settlement runs on MoneyGram and the Stellar Disbursement
              Platform.
            </p>
            <span className="role">Donor — on Stellar</span>
          </div>
        </div>
      </section>

      <section id="status" className="rule-top">
        <div className="status-band">
          <span className="mark">Status</span>
          <p>
            This is a new vertical for Bleu, currently a working proof of concept ahead of a
            <strong> Stellar Community Fund #45</strong> submission. The registry contract is
            live on <strong>Stellar testnet</strong> — try it under "Browse" or "Register." The
            payment rails (MoneyGram, Stellar Disbursement Platform) aren't wired up in this PoC.
          </p>
        </div>
      </section>
    </div>
  );
}
