import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@nqlib/nqui";
import { ORDER_DIMENSIONS } from "./mock-data";
import type { FrozenPane } from "./spreadsheet-page";
import type { SheetCanvasMode } from "./infinite-sheet-canvas";
import { DEFAULT_SHEET_RESIZE } from "./sheet-resize-preferences";
import type { CellFormat, CellNumberFormat, TextStyleKey } from "./format";

export interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  frozenPane: FrozenPane;
  onFreezePanes: () => void;
  onFreezeTopRow: () => void;
  onFreezeFirstColumn: () => void;
  onUnfreezeAll: () => void;
  onGroupBy: (dimensionKey: string) => void;
  groupByKey: string | null;
  pivotActive: boolean;
  onTogglePivot: () => void;
  /** Disabled when the active sheet has no sortable grid (pivot/summary). */
  searchDisabled?: boolean;
  /** Pivot / summary — toggle infinite sheet canvas vs compact data fit. */
  showAnalyticsCanvasToggle?: boolean;
  analyticsCanvasMode?: SheetCanvasMode;
  onAnalyticsCanvasModeChange?: (mode: SheetCanvasMode) => void;
  columnResizeEnabled?: boolean;
  rowResizeEnabled?: boolean;
  onColumnResizeEnabledChange?: (enabled: boolean) => void;
  onRowResizeEnabledChange?: (enabled: boolean) => void;
  /** Per-cell formatting handlers (operate on the current selection). */
  onApplyTextStyle?: (key: TextStyleKey) => void;
  onApplyAlign?: (align: NonNullable<CellFormat["align"]>) => void;
  onApplyValign?: (valign: NonNullable<CellFormat["valign"]>) => void;
  onApplyNumberFormat?: (format: CellNumberFormat) => void;
  /** Active-cell format — drives the pressed states of the format controls. */
  activeFormat?: CellFormat;
  /** Disabled on non-grid sheets (pivot/summary) where there's no cell selection. */
  formattingDisabled?: boolean;
}

/** Disabled roadmap button — present but honestly not yet wired. */
function SoonButton({ label, ariaLabel }: { label: string; ariaLabel: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled
      aria-label={`${ariaLabel} — soon`}
      className="h-7 w-7 p-0 font-medium"
    >
      {label}
    </Button>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />;

/** Excel-style toolbar strip — functional sort/filter/freeze/group/pivot + disabled roadmap controls. */
export function Toolbar({
  search,
  onSearchChange,
  frozenPane,
  onFreezePanes,
  onFreezeTopRow,
  onFreezeFirstColumn,
  onUnfreezeAll,
  onGroupBy,
  groupByKey,
  pivotActive,
  onTogglePivot,
  searchDisabled = false,
  showAnalyticsCanvasToggle = false,
  analyticsCanvasMode = "infinite",
  onAnalyticsCanvasModeChange,
  columnResizeEnabled = DEFAULT_SHEET_RESIZE.columnResize,
  rowResizeEnabled = DEFAULT_SHEET_RESIZE.rowResize,
  onColumnResizeEnabledChange,
  onRowResizeEnabledChange,
  onApplyTextStyle,
  onApplyAlign,
  onApplyValign,
  onApplyNumberFormat,
  activeFormat,
  formattingDisabled = false,
}: ToolbarProps) {
  // Active-cell text styles → ToggleGroup multiple value.
  const textStyleValue = [
    activeFormat?.bold ? "bold" : null,
    activeFormat?.italic ? "italic" : null,
    activeFormat?.underline ? "underline" : null,
  ].filter(Boolean) as string[];
  const alignValue = activeFormat?.align ?? "";
  const valignValue = activeFormat?.valign ?? "";
  const numberFormat = activeFormat?.numberFormat;
  const groupLabel = groupByKey
    ? (ORDER_DIMENSIONS.find((d) => d.key === groupByKey)?.label ?? "Group by")
    : "Group by";

  const freezeActive = frozenPane.col > 0 || frozenPane.row > 0;

  return (
    <div
      role="toolbar"
      aria-label="Spreadsheet toolbar"
      className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-2 py-1.5"
    >
      <ToggleGroup
        type="multiple"
        size="sm"
        variant="outline"
        aria-label="Text style"
        disabled={formattingDisabled}
        value={textStyleValue}
        onValueChange={(next) => {
          // Diff against the active cell's current styles, toggle what changed.
          for (const key of ["bold", "italic", "underline"] as const) {
            const was = textStyleValue.includes(key);
            const now = next.includes(key);
            if (was !== now) onApplyTextStyle?.(key);
          }
        }}
      >
        <ToggleGroupItem value="bold" aria-label="Bold" className="h-7 w-7 font-semibold">
          B
        </ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="Italic" className="h-7 w-7 italic">
          I
        </ToggleGroupItem>
        <ToggleGroupItem value="underline" aria-label="Underline" className="h-7 w-7 underline">
          U
        </ToggleGroupItem>
      </ToggleGroup>

      <Divider />

      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        aria-label="Horizontal alignment"
        disabled={formattingDisabled}
        value={alignValue}
        onValueChange={(value) => {
          if (value === "left" || value === "center" || value === "right") {
            onApplyAlign?.(value);
          }
        }}
      >
        <ToggleGroupItem value="left" aria-label="Align left" className="h-7 w-7">
          ⇤
        </ToggleGroupItem>
        <ToggleGroupItem value="center" aria-label="Align center" className="h-7 w-7">
          ⇆
        </ToggleGroupItem>
        <ToggleGroupItem value="right" aria-label="Align right" className="h-7 w-7">
          ⇥
        </ToggleGroupItem>
      </ToggleGroup>

      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        aria-label="Vertical alignment"
        disabled={formattingDisabled}
        value={valignValue}
        onValueChange={(value) => {
          if (value === "top" || value === "middle" || value === "bottom") {
            onApplyValign?.(value);
          }
        }}
      >
        <ToggleGroupItem value="top" aria-label="Align top" className="h-7 w-7">
          ⤒
        </ToggleGroupItem>
        <ToggleGroupItem value="middle" aria-label="Align middle" className="h-7 w-7">
          ⥯
        </ToggleGroupItem>
        <ToggleGroupItem value="bottom" aria-label="Align bottom" className="h-7 w-7">
          ⤓
        </ToggleGroupItem>
      </ToggleGroup>

      <Divider />

      <Button
        type="button"
        size="sm"
        variant={numberFormat === "currency" ? "secondary" : "ghost"}
        aria-pressed={numberFormat === "currency"}
        aria-label="Currency format"
        disabled={formattingDisabled}
        className="h-7 w-7 p-0 font-medium"
        onClick={() => onApplyNumberFormat?.("currency")}
      >
        $
      </Button>
      <Button
        type="button"
        size="sm"
        variant={numberFormat === "percent" ? "secondary" : "ghost"}
        aria-pressed={numberFormat === "percent"}
        aria-label="Percent format"
        disabled={formattingDisabled}
        className="h-7 w-7 p-0 font-medium"
        onClick={() => onApplyNumberFormat?.("percent")}
      >
        %
      </Button>
      <Button
        type="button"
        size="sm"
        variant={numberFormat === "thousands" ? "secondary" : "ghost"}
        aria-pressed={numberFormat === "thousands"}
        aria-label="Thousands separator"
        disabled={formattingDisabled}
        className="h-7 w-7 p-0 font-medium"
        onClick={() => onApplyNumberFormat?.("thousands")}
      >
        ,
      </Button>

      <Divider />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={freezeActive ? "secondary" : "ghost"}
            aria-pressed={freezeActive}
            className="h-7"
          >
            Freeze
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onClick={onFreezePanes}>Freeze panes</DropdownMenuItem>
          <DropdownMenuItem onClick={onFreezeTopRow}>Freeze top row</DropdownMenuItem>
          <DropdownMenuItem onClick={onFreezeFirstColumn}>Freeze first column</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onUnfreezeAll} disabled={!freezeActive}>
            Unfreeze all
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {freezeActive ? (
        <span
          className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground"
          aria-label={`Frozen ${frozenPane.row} rows and ${frozenPane.col} columns`}
        >
          Frozen R{frozenPane.row}·C{frozenPane.col}
        </span>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={groupByKey ? "secondary" : "ghost"}
            className="h-7"
          >
            {groupLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Group rows by</DropdownMenuLabel>
          {ORDER_DIMENSIONS.map((dim) => (
            <DropdownMenuItem
              key={dim.key}
              onClick={() => onGroupBy(dim.key)}
              className={cn(groupByKey === dim.key && "font-medium")}
            >
              {dim.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        size="sm"
        variant={pivotActive ? "secondary" : "ghost"}
        onClick={onTogglePivot}
        aria-pressed={pivotActive}
        className="h-7"
      >
        Pivot
      </Button>

      <Divider />

      <Button
        type="button"
        size="sm"
        variant={columnResizeEnabled ? "secondary" : "ghost"}
        aria-pressed={columnResizeEnabled}
        className="h-7 text-xs"
        onClick={() => onColumnResizeEnabledChange?.(!columnResizeEnabled)}
      >
        Col resize
      </Button>
      <Button
        type="button"
        size="sm"
        variant={rowResizeEnabled ? "secondary" : "ghost"}
        aria-pressed={rowResizeEnabled}
        className="h-7 text-xs"
        onClick={() => onRowResizeEnabledChange?.(!rowResizeEnabled)}
      >
        Row resize
      </Button>

      <Divider />

      {showAnalyticsCanvasToggle ? (
        <>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={analyticsCanvasMode}
            onValueChange={(value) => {
              if (value === "compact" || value === "infinite") {
                onAnalyticsCanvasModeChange?.(value);
              }
            }}
            aria-label="Sheet canvas"
          >
            <ToggleGroupItem value="infinite" className="h-7 px-2 text-xs">
              Sheet canvas
            </ToggleGroupItem>
            <ToggleGroupItem value="compact" className="h-7 px-2 text-xs">
              Fit data
            </ToggleGroupItem>
          </ToggleGroup>
          <Divider />
        </>
      ) : null}

      <SoonButton label="◫" ariaLabel="Conditional formatting" />

      <Input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search orders…"
        aria-label="Search orders"
        disabled={searchDisabled}
        className="ml-auto h-7 w-48 text-xs"
      />
    </div>
  );
}
