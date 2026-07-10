import { useEffect, useRef, useState } from "react";
import { Input } from "@nqlib/nqui";

export interface FormulaBarProps {
  /** A1 reference of the active cell, e.g. "C12". Empty string when no cell is active. */
  cellRef: string;
  /** Display value of the active cell. */
  value: string;
  /** When true, the value field is editable and commits via `onCommit`. */
  editable?: boolean;
  /** Commit the typed buffer to the active cell. */
  onCommit?: (value: string) => void;
  /** Restore the buffer (Esc) without committing. */
  onCancel?: () => void;
}

/** Excel-style formula bar: A1 reference box + value field (editable when wired). */
export function FormulaBar({ cellRef, value, editable = false, onCommit, onCancel }: FormulaBarProps) {
  const [buffer, setBuffer] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync the local buffer whenever the active cell (ref) or its value changes,
  // unless the user is mid-edit in this field.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setBuffer(value);
    }
    // Resync on cellRef too so moving cells refreshes the buffer.
  }, [value, cellRef]);

  if (!editable) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1">
        <div
          className="flex h-7 w-20 shrink-0 items-center rounded-md border border-border bg-background px-2 text-xs font-medium tabular-nums text-foreground"
          aria-label="Active cell reference"
        >
          {cellRef || "—"}
        </div>
        <span className="select-none px-1 text-sm text-muted-foreground" aria-hidden>
          fx
        </span>
        <Input
          readOnly
          disabled
          value={value}
          placeholder="Cell editing — soon"
          aria-label="Active cell value"
          className="h-7 flex-1 text-xs"
        />
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1">
      <div
        className="flex h-7 w-20 shrink-0 items-center rounded-md border border-border bg-background px-2 text-xs font-medium tabular-nums text-foreground"
        aria-label="Active cell reference"
      >
        {cellRef || "—"}
      </div>
      <span className="select-none px-1 text-sm text-muted-foreground" aria-hidden>
        fx
      </span>
      <Input
        ref={inputRef}
        value={buffer}
        onChange={(e) => setBuffer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit?.(buffer);
            inputRef.current?.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setBuffer(value);
            onCancel?.();
            inputRef.current?.blur();
          }
        }}
        placeholder="Enter a value"
        aria-label="Active cell value"
        className="h-7 flex-1 text-xs"
      />
    </div>
  );
}
