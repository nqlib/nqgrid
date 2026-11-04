import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@nqlib/nqui";
import { ORDER_COLUMNS, type OrderRow } from "./mock-data";
import {
  applyReplaceAll,
  findMatches,
  type FindReplaceColumn,
  type FindReplaceOptions,
} from "./find-replace";

/** Columns the search spans — the full ledger, in display order. */
const SEARCH_COLUMNS: FindReplaceColumn[] = ORDER_COLUMNS.map((c) => ({
  key: c.key,
  numeric: c.numeric,
}));

export interface FindReplaceDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Current sheet rows to search over. */
  readonly data: readonly OrderRow[];
  /**
   * Apply a replace-all and route it through the page's undoable commit.
   * Returns the number of cells changed so the dialog can report it.
   */
  readonly onReplaceAll: (
    query: string,
    replacement: string,
    opts: FindReplaceOptions,
  ) => number;
  /**
   * Replace the first matching cell only (one undoable commit). Returns 0 or 1.
   */
  readonly onReplaceFirst: (
    query: string,
    replacement: string,
    opts: FindReplaceOptions,
  ) => number;
}

/**
 * Find and replace dialog for the Spreadsheet page. Searches every cell across
 * all columns, honors match-case / whole-cell, and routes replacements through
 * the page's undoable commit. Pure logic lives in `find-replace.ts`.
 */
export function FindReplaceDialog({
  open,
  onOpenChange,
  data,
  onReplaceAll,
  onReplaceFirst,
}: FindReplaceDialogProps) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [wholeCell, setWholeCell] = useState(false);
  // Inline result of the last Replace / Replace all action (null = nothing yet).
  const [note, setNote] = useState<string | null>(null);
  const findInputRef = useRef<HTMLInputElement>(null);

  const matchCaseId = useId();
  const wholeCellId = useId();

  const opts = useMemo<FindReplaceOptions>(
    () => ({ matchCase, wholeCell }),
    [matchCase, wholeCell],
  );

  const matches = useMemo(
    () => findMatches(data, SEARCH_COLUMNS, query, opts),
    [data, query, opts],
  );

  // Focus the Find input on open, and reset transient state.
  useEffect(() => {
    if (!open) return;
    setNote(null);
    // Defer so the dialog content has mounted before focusing.
    const id = window.setTimeout(() => findInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  // Editing the query invalidates the running result note.
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setNote(null);
  };

  const matchCountLabel =
    query === ""
      ? "Enter text to search"
      : matches.length === 0
        ? "No matches"
        : matches.length === 1
          ? "1 match"
          : `${matches.length} matches`;

  const handleFindAll = () => {
    setNote(matches.length === 0 ? "No matches" : `Found ${matches.length} cells`);
  };

  const handleReplace = () => {
    if (query === "" || matches.length === 0) return;
    // Replace only the first current match. After the commit the match list
    // recomputes, so the next Replace naturally advances to what's left.
    const changed = onReplaceFirst(query, replacement, opts);
    setNote(changed === 0 ? "No cells changed" : "Replaced 1 cell");
  };

  const handleReplaceAll = () => {
    if (query === "") return;
    const changed = onReplaceAll(query, replacement, opts);
    setNote(
      changed === 0
        ? "No cells changed"
        : changed === 1
          ? "Replaced 1 cell"
          : `Replaced ${changed} cells`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Find and replace</DialogTitle>
          <DialogDescription>
            Search every cell across all columns in this sheet.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="grid gap-1.5">
            <label
              htmlFor={`${matchCaseId}-find`}
              className="text-sm font-medium text-foreground"
            >
              Find
            </label>
            <Input
              id={`${matchCaseId}-find`}
              ref={findInputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Text to find"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor={`${matchCaseId}-replace`}
              className="text-sm font-medium text-foreground"
            >
              Replace with
            </label>
            <Input
              id={`${matchCaseId}-replace`}
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Replacement text"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-2">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id={matchCaseId}
                checked={matchCase}
                onCheckedChange={(v) => {
                  setMatchCase(!!v);
                  setNote(null);
                }}
              />
              <span className="text-sm text-foreground">Match case</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                id={wholeCellId}
                checked={wholeCell}
                onCheckedChange={(v) => {
                  setWholeCell(!!v);
                  setNote(null);
                }}
              />
              <span className="text-sm text-foreground">Match entire cell</span>
            </label>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Search: all cells</span>
            <span aria-live="polite">{matchCountLabel}</span>
          </div>

          {note ? (
            <p
              className="text-xs text-muted-foreground"
              aria-live="polite"
              role="status"
            >
              {note}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleFindAll}
              disabled={query === ""}
            >
              Find all
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReplace}
              disabled={query === "" || matches.length === 0}
            >
              Replace
            </Button>
            <Button
              type="button"
              onClick={handleReplaceAll}
              disabled={query === ""}
            >
              Replace all
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
