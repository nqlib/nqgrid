import type { HTMLAttributes } from "react";
import { Checkbox, cn } from "@nqlib/nqui";
import { stopSortableChain } from "./playground-sortable-utils";

/** Class tokens for the select column — defaults mirror the card preset's `selectCell`. */
export interface SelectCellChromeClasses {
  number?: string;
}

const DEFAULT_CLASSES: Required<SelectCellChromeClasses> = {
  number: "text-sm font-medium tabular-nums text-foreground",
};

const checkboxGuardProps = {
  onPointerDown: stopSortableChain,
  onMouseDown: stopSortableChain,
  onTouchStart: stopSortableChain,
  onClick: stopSortableChain,
  onKeyDown: stopSortableChain,
};

export interface SelectCellChromeProps {
  rowIndex: number;
  selected: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Row label for aria (e.g. id or name). */
  rowLabel: string;
  /** Override row-number typography (e.g. Excel gutter). */
  numberClassName?: string;
  /** Optional keyboard reorder props (`useRowKeyboardReorder.getGripProps`) on the select zone. */
  keyboardReorderProps?: HTMLAttributes<HTMLDivElement> & {
    role?: "button";
    tabIndex?: number;
    "aria-grabbed"?: boolean;
  };
  /** Token class overrides (typically `buildTableClasses(tokens)` select* fields). */
  classes?: SelectCellChromeClasses;
}

/**
 * First-column cell chrome: row number ↔ checkbox.
 *
 * Row/column drag is handled by Sortable on the `<tr>` / header — no grip lane.
 * The number/checkbox zone is click-to-select; pointer-start is guarded so it
 * does not compete with row drag.
 */
export function SelectCellChrome({
  rowIndex,
  selected,
  checked,
  onCheckedChange,
  rowLabel,
  numberClassName,
  keyboardReorderProps,
  classes,
}: SelectCellChromeProps) {
  const c = { ...DEFAULT_CLASSES, ...classes };

  return (
    <div className="flex h-8 w-full min-w-0 items-center">
      <div
        role={keyboardReorderProps?.role}
        tabIndex={keyboardReorderProps?.tabIndex}
        aria-grabbed={keyboardReorderProps?.["aria-grabbed"]}
        aria-keyshortcuts={keyboardReorderProps?.["aria-keyshortcuts"]}
        onKeyDown={keyboardReorderProps?.onKeyDown}
        className="relative flex h-full min-w-0 flex-1 cursor-pointer items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          onCheckedChange(!checked);
        }}
        onPointerDown={stopSortableChain}
        onMouseDown={stopSortableChain}
        onTouchStart={stopSortableChain}
      >
        <span
          className={cn(
            "transition-opacity duration-150",
            numberClassName ?? c.number,
            selected
              ? "opacity-0"
              : "opacity-100 group-hover/row:opacity-0 group-focus-within/row:opacity-0 pointer-coarse:opacity-0",
          )}
          aria-hidden
        >
          {rowIndex + 1}
        </span>

        <div
          {...checkboxGuardProps}
          className={cn(
            "absolute inset-0 flex touch-manipulation items-center justify-center transition-opacity duration-150",
            selected
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100",
          )}
        >
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => onCheckedChange(!!v)}
            aria-label={`Select ${rowLabel}`}
            className="hit-area-6"
          />
        </div>
      </div>
    </div>
  );
}
