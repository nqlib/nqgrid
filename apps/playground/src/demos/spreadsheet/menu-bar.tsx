import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nqlib/nqui";
import { ORDER_DIMENSIONS } from "./mock-data";

/** Actions the engine can really perform, wired from the page. */
export interface MenuBarActions {
  onExportCsv: () => void;
  onCopy: () => void;
  onSelectAll: () => void;
  onFreezePanes: () => void;
  onFreezeTopRow: () => void;
  onFreezeFirstColumn: () => void;
  onUnfreezeAll: () => void;
  freezeActive: boolean;
  onGroupBy: (dimensionKey: string) => void;
  onOpenPivot: () => void;
  canCopy: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onFindReplace: () => void;
  onInsertChart: () => void;
}

/** Enabled menu item with a "Soon"-style hint shown only while disabled. */
function HistoryItem({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenuItem onClick={onClick} disabled={disabled} className="justify-between">
      <span>{label}</span>
      {disabled ? <span className="text-xs text-muted-foreground">Nothing</span> : null}
    </DropdownMenuItem>
  );
}

/** Disabled roadmap row — renders the item but makes the lack of support honest. */
function SoonItem({ label }: { label: string }) {
  return (
    <DropdownMenuItem disabled className="justify-between">
      <span>{label}</span>
      <span className="text-xs text-muted-foreground">Soon</span>
    </DropdownMenuItem>
  );
}

function MenuTrigger({ label }: { label: string }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-sm font-normal text-foreground data-[state=open]:bg-accent"
      >
        {label}
      </Button>
    </DropdownMenuTrigger>
  );
}

/** Excel-style menu bar — File / Edit / View / Insert / Format / Data. */
export function MenuBar({
  onExportCsv,
  onCopy,
  onSelectAll,
  onFreezePanes,
  onFreezeTopRow,
  onFreezeFirstColumn,
  onUnfreezeAll,
  freezeActive,
  onGroupBy,
  onOpenPivot,
  canCopy,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onFindReplace,
  onInsertChart,
}: MenuBarActions) {
  return (
    <div
      role="menubar"
      aria-label="Spreadsheet menus"
      className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border px-2 py-1"
    >
      <DropdownMenu>
        <MenuTrigger label="File" />
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onClick={onExportCsv}>Export CSV</DropdownMenuItem>
          <DropdownMenuSeparator />
          <SoonItem label="Import" />
          <SoonItem label="Print" />
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Edit" />
        <DropdownMenuContent align="start" className="w-52">
          <HistoryItem label="Undo" onClick={onUndo} disabled={!canUndo} />
          <HistoryItem label="Redo" onClick={onRedo} disabled={!canRedo} />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onCopy} disabled={!canCopy}>
            Copy
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSelectAll}>Select all</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onFindReplace}>Find &amp; replace</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="View" />
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Freeze panes</DropdownMenuLabel>
          <DropdownMenuItem onClick={onFreezePanes}>Freeze panes</DropdownMenuItem>
          <DropdownMenuItem onClick={onFreezeTopRow}>Freeze top row</DropdownMenuItem>
          <DropdownMenuItem onClick={onFreezeFirstColumn}>Freeze first column</DropdownMenuItem>
          <DropdownMenuItem onClick={onUnfreezeAll} disabled={!freezeActive}>
            Unfreeze all
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <SoonItem label="Gridlines" />
          <SoonItem label="Zoom" />
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Insert" />
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onClick={onInsertChart}>Insert chart</DropdownMenuItem>
          <SoonItem label="Insert function" />
          <SoonItem label="Insert rows" />
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Format" />
        <DropdownMenuContent align="start" className="w-56">
          <SoonItem label="Number format" />
          <SoonItem label="Conditional formatting" />
          <SoonItem label="Merge cells" />
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Data" />
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Group by</DropdownMenuLabel>
          {ORDER_DIMENSIONS.map((dim) => (
            <DropdownMenuItem key={dim.key} onClick={() => onGroupBy(dim.key)}>
              {dim.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenPivot}>Pivot table</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
