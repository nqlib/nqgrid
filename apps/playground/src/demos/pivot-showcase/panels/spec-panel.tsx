import { useMemo } from "react";
import { Badge } from "@nqlib/nqui";
import type { PivotSpec } from "@nqlib/nqgrid/core";
import { changedSpecKeys, formatSpec } from "../spec-tools";
import { CodeBlock, CopyButton } from "./code-block";

/** The live spec: every collapse, filter, sort or drag is a spec change, so this is the whole view state. */
export function SpecPanel({ spec, initial }: { spec: PivotSpec; initial: PivotSpec }) {
  const json = useMemo(() => formatSpec(spec), [spec]);
  const changed = useMemo(() => changedSpecKeys(initial, spec), [initial, spec]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {changed.length ? (
            <>
              <span>Changed since load:</span>
              {changed.map((k) => (
                <Badge key={k} variant="secondary" className="font-mono font-normal">
                  {k}
                </Badge>
              ))}
            </>
          ) : (
            <span>View state lives in the spec. Collapse a group, filter or drag a field and watch it change here.</span>
          )}
        </div>
        <CopyButton text={json} label="Copy spec" />
      </div>
      <CodeBlock code={json} label="Current pivot spec (JSON)" />
    </div>
  );
}
