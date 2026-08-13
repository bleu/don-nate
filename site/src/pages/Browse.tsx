import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { truncateAddress, formatDate } from "../lib/format";
import { useInstitutions } from "../lib/useInstitutions";

export function Browse() {
  const [params] = useSearchParams();
  const justSubmitted = params.get("justSubmitted");

  const { items, error } = useInstitutions();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        (item.latestReport?.name ?? "").toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div className="wrap">
      <section>
        <div className="section-head">
          <p className="eyebrow">The registry</p>
          <h2>Browse institutions.</h2>
          <p>
            Reading this needs no wallet — anyone can check a claim without asking Bleu first.
            "Pending review" institutions have a report but no approved trust tier yet.
          </p>
        </div>

        {justSubmitted && (
          <div className="status-band" style={{ marginBottom: 28 }}>
            <span className="mark">Submitted</span>
            <p>
              Your report for <span className="mono">{truncateAddress(justSubmitted)}</span> is in.
              It's listed below as "Pending review" until a reviewer approves it.
            </p>
          </div>
        )}

        {error && (
          <div className="status-band error">
            <span className="mark">Error</span>
            <p>{error}</p>
          </div>
        )}

        {!error && (
          <>
            <input
              className="search-input"
              placeholder="Search by name or address…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search institutions"
            />

            {items === null ? (
              <p style={{ color: "var(--ink-soft)" }}>Loading from Stellar testnet…</p>
            ) : filtered.length === 0 ? (
              <p style={{ color: "var(--ink-soft)" }}>
                {items.length === 0
                  ? "No institutions have been reported yet — be the first under \"Register.\""
                  : "No matches."}
              </p>
            ) : (
              <div role="table">
                <div className="list-row head" role="row">
                  <span>Name</span>
                  <span>Address</span>
                  <span>Status</span>
                  <span>Tier</span>
                </div>
                {filtered.map((item) => (
                  <div className="list-row" role="row" key={item.address}>
                    <span className="name">{item.latestReport?.name || "(unnamed)"}</span>
                    <span className="addr" title={item.address}>{truncateAddress(item.address)}</span>
                    <span>
                      {item.verified ? (
                        <span className="badge verified">Verified</span>
                      ) : (
                        <span className="badge pending">Pending review</span>
                      )}
                    </span>
                    <span className="mono">
                      {item.record ? (
                        <>
                          <span className="tier-tag">Tier {item.record.trust_tier}</span>
                          {" · expires "}
                          {formatDate(item.record.expires_at)}
                        </>
                      ) : (
                        item.latestReport ? `suggested: ${item.latestReport.recommended_tier}` : "—"
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
