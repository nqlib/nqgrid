import { Button, Switch, ToggleGroup, ToggleGroupItem } from "@nqlib/nqui";
import type { PivotNumberFormat } from "@nqlib/nqgrid/core";
import type { PivotCellContext, PivotFormatRule } from "@nqlib/nqgrid/pivot";

/**
 * A host-built "Format Cells" bar: the grid only reports the clicked cell (`onCellClick`) and
 * prints the rules it gets back (`numberFormats`). Which target, which format, and where the rules
 * are stored is the host's business.
 */

export type FormatTarget = "cell" | "row" | "column" | "measure";

export interface FormatSelection {
  readonly rowId: string;
  readonly rowLabel: string;
  readonly columnId: string;
  readonly columnLabel: string;
  readonly measureId: string;
  readonly measureLabel: string;
}

export function selectionOf(ctx: PivotCellContext): FormatSelection {
  return {
    rowId: ctx.row.id,
    rowLabel: ctx.row.label,
    columnId: ctx.column.id,
    columnLabel: ctx.column.headerPath.join(" "),
    measureId: ctx.column.measureId,
    measureLabel: ctx.column.measureLabel,
  };
}

/** The rule's target fields for a selection. */
function targetOf(sel: FormatSelection, target: FormatTarget): Omit<PivotFormatRule, "format"> {
  if (target === "cell") return { row: sel.rowId, column: sel.columnId };
  if (target === "row") return { row: sel.rowId };
  if (target === "column") return { column: sel.columnId };
  return { measure: sel.measureId };
}

const sameTarget = (a: Omit<PivotFormatRule, "format">, b: Omit<PivotFormatRule, "format">) =>
  a.row === b.row && a.column === b.column && a.measure === b.measure && a.rowKind === b.rowKind;

/** Merge `patch` into the rule for this target (one rule per target, like Excel's last "Format Cells"). */
export function applyFormat(rules: readonly PivotFormatRule[], sel: FormatSelection, target: FormatTarget, patch: PivotNumberFormat): PivotFormatRule[] {
  const t = targetOf(sel, target);
  const existing = rules.find((r) => sameTarget(r, t));
  const next: PivotFormatRule = { ...t, format: { ...existing?.format, ...patch } };
  return [...rules.filter((r) => r !== existing), next];
}

export function FormatToolbar({
  selection,
  target,
  onTargetChange,
  rules,
  onRulesChange,
}: {
  readonly selection: FormatSelection | null;
  readonly target: FormatTarget;
  readonly onTargetChange: (t: FormatTarget) => void;
  readonly rules: readonly PivotFormatRule[];
  readonly onRulesChange: (rules: PivotFormatRule[]) => void;
}) {
  const current = selection ? rules.find((r) => sameTarget(r, targetOf(selection, target)))?.format : undefined;
  const decimals = current?.decimals;
  const apply = (patch: PivotNumberFormat) => selection && onRulesChange(applyFormat(rules, selection, target, patch));
  const disabled = selection === null;
  const label = !selection
    ? "Click a value cell to format it."
    : target === "cell"
      ? `${selection.rowLabel} · ${selection.columnLabel}`
      : target === "row"
        ? `Row ${selection.rowLabel}`
        : target === "column"
          ? `Column ${selection.columnLabel}`
          : `Measure ${selection.measureLabel}`;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Apply to</span>
        <ToggleGroup type="single" size="sm" value={target} onValueChange={(v: string) => v && onTargetChange(v as FormatTarget)} aria-label="Format target">
          <ToggleGroupItem value="cell">Cell</ToggleGroupItem>
          <ToggleGroupItem value="row">Row</ToggleGroupItem>
          <ToggleGroupItem value="column">Column</ToggleGroupItem>
          <ToggleGroupItem value="measure">Measure</ToggleGroupItem>
        </ToggleGroup>
        <span className="truncate font-medium">{label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ToggleGroup
          type="single"
          size="sm"
          disabled={disabled}
          value={current?.style ?? ""}
          onValueChange={(v: string) => v && apply(v === "currency" ? { style: "currency", currency: "USD" } : { style: v as "decimal" | "percent" })}
          aria-label="Number style"
        >
          <ToggleGroupItem value="decimal">123</ToggleGroupItem>
          <ToggleGroupItem value="currency">$</ToggleGroupItem>
          <ToggleGroupItem value="percent">%</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          size="sm"
          disabled={disabled}
          value={current?.currency ?? ""}
          onValueChange={(v: string) => v && apply({ style: "currency", currency: v })}
          aria-label="Currency"
        >
          <ToggleGroupItem value="USD">USD</ToggleGroupItem>
          <ToggleGroupItem value="EUR">EUR</ToggleGroupItem>
          <ToggleGroupItem value="GBP">GBP</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" disabled={disabled} aria-label="Fewer decimals" onClick={() => apply({ decimals: Math.max(0, (decimals ?? 2) - 1) })}>
            .0←
          </Button>
          <Button size="sm" variant="outline" disabled={disabled} aria-label="More decimals" onClick={() => apply({ decimals: Math.min(6, (decimals ?? 0) + 1) })}>
            .00→
          </Button>
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          disabled={disabled}
          // Only an explicit choice is shown as selected (the cell's own format may still be compact).
          value={current?.compact === true ? "compact" : current?.scale ? String(current.scale) : current?.compact === false ? "full" : ""}
          onValueChange={(v: string) =>
            v &&
            apply(
              v === "compact"
                ? { compact: true, scale: undefined, suffix: undefined }
                : v === "full"
                  ? { compact: false, scale: undefined, suffix: undefined }
                  : { compact: false, scale: Number(v) as 1000 | 1_000_000, suffix: v === "1000" ? "k" : "M" },
            )
          }
          aria-label="Units"
        >
          <ToggleGroupItem value="full">Full</ToggleGroupItem>
          <ToggleGroupItem value="1000">Thousands</ToggleGroupItem>
          <ToggleGroupItem value="1000000">Millions</ToggleGroupItem>
          <ToggleGroupItem value="compact">Auto (k / M)</ToggleGroupItem>
        </ToggleGroup>
        <label className="flex items-center gap-2">
          <Switch disabled={disabled} checked={current?.negative === "parentheses"} onCheckedChange={(on: boolean) => apply({ negative: on ? "parentheses" : "minus" })} />
          (Negatives)
        </label>
        <Button size="sm" variant="ghost" disabled={rules.length === 0} onClick={() => onRulesChange([])}>
          Clear formats
        </Button>
      </div>
    </div>
  );
}
