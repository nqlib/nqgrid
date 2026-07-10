import { cn } from "@nqlib/nqui";

export type SheetId = "orders" | "pivot" | "summary";

export const SHEETS: ReadonlyArray<{ id: SheetId; label: string }> = [
  { id: "orders", label: "Orders" },
  { id: "pivot", label: "Pivot" },
  { id: "summary", label: "Summary" },
];

export interface SheetTabsProps {
  active: SheetId;
  onChange: (id: SheetId) => void;
}

/** Excel-style bottom tab strip — switches the visible sheet view. */
export function SheetTabs({ active, onChange }: SheetTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Sheets"
      className="flex shrink-0 items-center gap-0.5 border-t border-border px-2 py-1"
    >
      {SHEETS.map((sheet) => {
        const isActive = sheet.id === active;
        return (
          <button
            key={sheet.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(sheet.id)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {sheet.label}
          </button>
        );
      })}
    </div>
  );
}
