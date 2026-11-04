import { useEffect, useState } from "react";
import { Button } from "@nqlib/nqui";
import { aggregate } from "@nqlib/nqgrid";
import { formatNumber } from "./format";

export interface StatusBarProps {
  /** Numeric values inside the current cell range (empty when no numeric cells selected). */
  selectedNumbers: readonly number[];
  rowCount: number;
  filterActive: boolean;
  /** Copy the current selection (wired from the grid); shown only when `canCopy`. */
  onCopy?: () => void;
  /** Whether a copyable multi-cell range is active. */
  canCopy?: boolean;
}

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Excel-style status bar — Count · Sum · Average of the numeric selection, plus row + filter counts. */
export function StatusBar({ selectedNumbers, rowCount, filterActive, onCopy, canCopy }: StatusBarProps) {
  const hasStats = selectedNumbers.length > 0;
  const count = aggregate(selectedNumbers, "count");
  const sum = aggregate(selectedNumbers, "sum");
  const avg = aggregate(selectedNumbers, "avg");

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  return (
    <div className="flex h-7 shrink-0 items-center justify-end gap-4 border-t border-border px-3 text-xs text-muted-foreground tabular-nums">
      {canCopy && onCopy ? (
        <Button
          size="sm"
          variant="ghost"
          className="mr-auto h-5 px-2 text-xs"
          onClick={() => {
            onCopy();
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy selection"}
        </Button>
      ) : null}
      {hasStats ? (
        <div className="flex items-center gap-4">
          <span>Count {formatNumber(count)}</span>
          <span>Sum {compact.format(sum ?? 0)}</span>
          <span>Average {compact.format(avg ?? 0)}</span>
        </div>
      ) : null}
      <div className="flex items-center gap-4">
        {filterActive ? <span>Filter on</span> : null}
        <span>{formatNumber(rowCount)} rows</span>
      </div>
    </div>
  );
}
