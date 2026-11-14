import { useId } from "react";
import { Badge, Label, Switch } from "@nqlib/nqui";
import type { PivotDiagnostic } from "@nqlib/nqgrid/core";
import { BAD_VALUES } from "../spec-tools";

/** `model.diagnostics` as a list (pure; tested with `renderToStaticMarkup`). */
export function DiagnosticsList({ diagnostics }: { diagnostics: readonly PivotDiagnostic[] }) {
  if (!diagnostics.length) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground" data-testid="diagnostics-empty">
        No data problems: every value parsed and every referenced field and item exists.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2" data-testid="diagnostics-list">
      {diagnostics.map((d) => (
        <li key={`${d.code}:${d.field}:${d.path}`} className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px] font-normal">
              {d.code}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">{d.path}</span>
            {d.count !== undefined ? <span className="ml-auto text-xs tabular-nums text-muted-foreground">{d.count.toLocaleString()} records</span> : null}
          </div>
          <p className="text-sm">{d.message}</p>
          {d.samples?.length ? (
            <p className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              {d.samples.map((s) => (
                <code key={s.row} className="rounded bg-muted px-1.5 py-0.5">
                  row {s.row}: {s.value}
                </code>
              ))}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function DiagnosticsPanel({
  diagnostics,
  injected,
  onInjectedChange,
  field,
  values = BAD_VALUES,
}: {
  diagnostics: readonly PivotDiagnostic[];
  injected: boolean;
  onInjectedChange: (injected: boolean) => void;
  /** Field the bad values go into (none → no toggle). */
  field: string | undefined;
  values?: readonly string[];
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {field ? (
          <div className="flex items-center gap-2">
            <Switch id={id} size="sm" checked={injected} onCheckedChange={onInjectedChange} />
            <Label htmlFor={id} className="text-xs font-normal">
              Inject bad values into <code className="font-mono">{field}</code>
            </Label>
          </div>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {field ? (
            <>
              Replaces the first records’ values with {values.map((v) => `“${v}”`).join(", ")}. They are reported, not guessed.
            </>
          ) : (
            "Diagnostics are gathered while records are encoded."
          )}
        </span>
      </div>
      <DiagnosticsList diagnostics={diagnostics} />
    </div>
  );
}
