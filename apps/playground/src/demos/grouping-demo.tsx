import { useMemo, useState } from "react";
import { buildGroupedFlatRows } from "@nqlib/nqgrid";

type Row = { id: string; country: string; city: string; units: number };

export function GroupingDemo({ data }: { data: Row[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const { flat, isGroupRow } = useMemo(
    () =>
      buildGroupedFlatRows({
        rows: data,
        groupBy: ["country"],
        rowGrouper: (rows, key) => {
          const m: Record<string, Row[]> = {};
          for (const r of rows) {
            const k = String((r as Row)[key as "country"]);
            (m[k] ??= []).push(r);
          }
          return m;
        },
        expandedGroupIds: expanded,
        rowKeyGetter: (r) => r.id,
      }),
    [data, expanded],
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Flattened group rows via <code className="rounded bg-muted px-1">buildGroupedFlatRows</code>. Toggle expansion per country.
      </p>
      <ul className="max-h-[min(60dvh,420px)] space-y-1 overflow-auto rounded-lg border p-3 text-sm">
        {flat.map((r, i) =>
          isGroupRow(r) ? (
            <li key={r.id}>
              <button
                type="button"
                className="font-medium text-primary underline-offset-2 hover:underline"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(r.id)) next.delete(r.id);
                    else next.add(r.id);
                    return next;
                  })
                }
              >
                {expanded.has(r.id) ? "▼" : "▶"} {String(r.groupKey)} ({r.childRows.length})
              </button>
            </li>
          ) : (
            <li key={r.id} className="pl-6 text-muted-foreground">
              {r.city} — {r.units} units
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
