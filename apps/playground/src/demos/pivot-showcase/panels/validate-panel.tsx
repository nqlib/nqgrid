import { useId, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle, Button, Label, Textarea } from "@nqlib/nqui";
import type { PivotSpec } from "@nqlib/nqgrid/core";
import { badSpecFrom, checkSpecText, formatSpec, type SpecTextCheck } from "../spec-tools";

/** Outcome of `validatePivotSpec` on the edited text (pure; tested with `renderToStaticMarkup`). */
export function ValidationResult({ check }: { check: SpecTextCheck }) {
  switch (check.kind) {
    case "empty":
      return <p className="text-xs text-muted-foreground">Paste or type a spec to validate it.</p>;
    case "parse":
      return (
        <Alert variant="destructive" data-testid="validate-result" data-state="parse">
          <AlertTitle>Not JSON</AlertTitle>
          <AlertDescription>{check.message}</AlertDescription>
        </Alert>
      );
    case "invalid":
      return (
        <Alert variant="destructive" data-testid="validate-result" data-state="invalid">
          <AlertTitle>
            {check.errors.length} validation error{check.errors.length === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4 font-mono text-xs">
              {check.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      );
    case "ok":
      return (
        <Alert data-testid="validate-result" data-state="ok">
          <AlertTitle>Valid spec</AlertTitle>
          <AlertDescription>
            {check.spec.rows.length} row field{check.spec.rows.length === 1 ? "" : "s"}, {check.spec.measures.length} measure
            {check.spec.measures.length === 1 ? "" : "s"}. Apply it to rebuild the table from this JSON.
          </AlertDescription>
        </Alert>
      );
  }
}

/**
 * Editable spec JSON checked with `validatePivotSpec` as you type. Validation is strict: unknown keys
 * and options that would be half-ignored (e.g. `keepEmpty` on a row field) are errors.
 */
export function ValidatePanel({ spec, onApply }: { spec: PivotSpec; onApply: (spec: PivotSpec) => void }) {
  const id = useId();
  const [text, setText] = useState(() => formatSpec(spec));
  const check = useMemo(() => checkSpecText(text), [text]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
          Edit the spec JSON; it is validated as you type.
        </Label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setText(formatSpec(spec))}>
            Load current spec
          </Button>
          <Button size="sm" variant="outline" onClick={() => setText(formatSpec(badSpecFrom(spec)))}>
            Try a bad spec
          </Button>
          <Button size="sm" disabled={check.kind !== "ok"} onClick={() => check.kind === "ok" && onApply(check.spec)}>
            Apply to table
          </Button>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="h-80 resize-y font-mono text-xs leading-relaxed"
        />
        <div aria-live="polite">
          <ValidationResult check={check} />
        </div>
      </div>
    </div>
  );
}
