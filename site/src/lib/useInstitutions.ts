import { useEffect, useState } from "react";
import { readOnlyClient } from "./contractClient";
import type { InstitutionRecord, VerificationReport } from "../contracts/institution-registry/dist/index.js";

export interface InstitutionListItem {
  address: string;
  latestReport: VerificationReport | null;
  record: InstitutionRecord | null;
  verified: boolean;
}

/** Loads every institution that's ever had a report submitted, straight from the contract. */
export function useInstitutions(): { items: InstitutionListItem[] | null; error: string | null } {
  const [items, setItems] = useState<InstitutionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const client = readOnlyClient();
        const { result: addresses } = await client.list_institutions();

        const loaded = await Promise.all(
          addresses.map(async (address): Promise<InstitutionListItem> => {
            const { result: reportIds } = await client.get_reports_for_institution({ institution: address });
            const lastId = reportIds.length > 0 ? reportIds[reportIds.length - 1] : null;

            const [reportRes, recordRes, verifiedRes] = await Promise.all([
              lastId !== null ? client.get_report({ report_id: lastId }) : Promise.resolve(null),
              client.get_institution({ institution: address }),
              client.is_verified({ institution: address }),
            ]);

            return {
              address,
              latestReport: reportRes ? reportRes.result ?? null : null,
              record: recordRes.result ?? null,
              verified: verifiedRes.result,
            };
          }),
        );

        if (!cancelled) setItems(loaded);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, error };
}
