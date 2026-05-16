import { Button } from "@nqlib/nqui";
import { useMasterDetail } from "@nqlib/nqgrid";

type Master = { id: string; title: string; expanded: boolean };

export function MasterDetailDemo() {
  const { rows, setMasterRows } = useMasterDetail(
    [
      { id: "a", title: "Row A", expanded: false },
      { id: "b", title: "Row B", expanded: true },
    ],
    {
      getMasterId: (m) => m.id,
      isExpanded: (m) => m.expanded,
      createDetailRow: (parentId) => ({ type: "detail", parentId, note: `Detail for ${parentId}` }),
      isMasterRow: (r): r is Master => !("type" in r),
    },
  );

  const toggle = (id: string) => {
    setMasterRows((prev) => prev.map((m) => (m.id === id ? { ...m, expanded: !m.expanded } : m)));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        <code className="rounded bg-muted px-1">useMasterDetail</code> mirrors the nqdg hook: synthetic detail rows follow expanded masters.
      </p>
      <ul className="space-y-2 rounded-lg border p-3 text-sm">
        {rows.map((r) =>
          "type" in r ? (
            <li key={`${r.parentId}-d`} className="rounded-md bg-muted/50 px-3 py-2 pl-8 text-muted-foreground">
              {r.note}
            </li>
          ) : (
            <li key={r.id} className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => toggle(r.id)}>
                {r.expanded ? "Collapse" : "Expand"}
              </Button>
              <span className="font-medium">{r.title}</span>
            </li>
          ),
        )}
      </ul>
      <p className="text-xs text-muted-foreground">Rows rendered: {rows.length}.</p>
    </div>
  );
}
