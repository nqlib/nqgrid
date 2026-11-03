import { useCallback, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@nqlib/nqui";
import {
  canMovePivotField,
  clearPivotFilters,
  generatePlanningPivotRows,
  planningFieldCatalog,
  planningPivotSpec,
  flightsTableShellExtraClass,
  pivotExportFilename,
  setPivotTopN,
  tableFooterClass,
  tableScrollAreaRootClass,
  tableScrollViewportStyle,
  tableShellClass,
  type PivotExportFormat,
  type PivotExportRequest,
  type PivotHeatScope,
  type PivotSpec,
} from "@nqlib/nqgrid";
import {
  PivotFieldList,
  PivotFilterIcon,
  PivotFilterMenu,
  PivotSlicer,
  PivotTable,
  pivotDropZoneProps,
  pivotExportRequestFromGrid,
  pivotFieldDragHandleProps,
  pivotFieldListProps,
  pivotFilterMenuProps,
  pivotSlicerProps,
  usePivotGrid,
  type PivotDimensionHeaderContext,
  type PivotGridState,
} from "@nqlib/nqgrid/pivot";

const HEAT_SCOPES: readonly { value: PivotHeatScope; label: string }[] = [
  { value: "all", label: "All Lines" },
  { value: "column", label: "Per month" },
  { value: "row", label: "Per line" },
  { value: "group", label: "Within department" },
];

/**
 * Optional: base URL of an `nqgrid-export serve` (or of a backend proxying it). Unset → the Export
 * panel only shows / downloads the request JSON. In dev, `VITE_NQGRID_EXPORT_URL=/nqgrid-export`
 * goes through the Vite proxy (`NQGRID_EXPORT_PROXY_TARGET`, default http://127.0.0.1:8787), which
 * avoids CORS (`serve` sends no CORS headers by design).
 */
const EXPORT_URL: string | undefined = (import.meta.env.VITE_NQGRID_EXPORT_URL as string | undefined)?.replace(/\/$/, "") || undefined;

const utcStamp = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** POST the request (with rows: nqgrid-export has no data of its own) and download the file. */
async function postExport(baseUrl: string, request: PivotExportRequest, format: PivotExportFormat) {
  const res = await fetch(`${baseUrl}/export?format=${format}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; details?: string[] } } | null;
    const details = body?.error?.details?.length ? `: ${body.error.details.join("; ")}` : "";
    throw new Error(`${body?.error?.message ?? `HTTP ${res.status}`}${details}`);
  }
  downloadBlob(await res.blob(), pivotExportFilename(request.spec, format));
}

function ExportPanel({ grid }: { grid: PivotGridState }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generatedAt = useMemo(() => utcStamp(new Date()), []);
  // What the Tauri app sends to the Python backend: spec (view state included) + dataset reference.
  const request = useMemo(
    () => pivotExportRequestFromGrid(grid, { format: "pdf", options: { theme: "light", generatedAt } }),
    [grid, generatedAt],
  );
  const json = useMemo(() => JSON.stringify(request, null, 2), [request]);

  const download = async (format: PivotExportFormat) => {
    if (!EXPORT_URL) return;
    setBusy(true);
    setStatus(`Exporting ${format.toUpperCase()}…`);
    try {
      const withRows = pivotExportRequestFromGrid(grid, { format, includeRows: true, options: request.options });
      await postExport(EXPORT_URL, withRows, format);
      setStatus(`Downloaded ${pivotExportFilename(request.spec, format)}`);
    } catch (error) {
      setStatus(`Export failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Export request (<code>contract/pivot/v1/export-request.schema.json</code>) — the backend resolves{" "}
          <code>dataset</code> to rows and calls nqgrid-export.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadBlob(new Blob([json], { type: "application/json" }), `${request.spec.id ?? "pivot"}.request.json`)}
          >
            Download request JSON
          </Button>
          {EXPORT_URL ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => void download("pdf")}>
                Download PDF
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void download("xlsx")}>
                Download XLSX
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {status ??
          (EXPORT_URL
            ? `PDF / XLSX via ${EXPORT_URL}`
            : "Set VITE_NQGRID_EXPORT_URL to download PDF / XLSX from nqgrid-export serve.")}
      </p>
      <pre className="max-h-72 overflow-auto rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">{json}</pre>
    </div>
  );
}

/**
 * The planning spec plus slicer facets and a field catalogue (labels, types, allowed areas) for the
 * field list. Filters, sort, Top N and the layout are changed by the controls.
 */
const demoSpec: PivotSpec = { ...planningPivotSpec, facets: ["department", "line"], fields: planningFieldCatalog };

/**
 * Row-dimension header: a drag handle (drop it on the field list's areas, or on another header to
 * reorder the row levels), the sort / filter indicator and an nqui popover holding `PivotFilterMenu`.
 */
function DimensionHeaderMenu({ grid, context }: { grid: PivotGridState; context: PivotDimensionHeaderContext }) {
  const [open, setOpen] = useState(false);
  const active = context.status.filtered || context.status.sort !== null;
  const field = context.dimension.field;
  const source = { field, from: "rows" as const, label: context.label };
  return (
    <div
      className="flex min-w-0 items-center justify-between gap-1 rounded-sm data-[nqg-drop-active]:bg-primary/10"
      {...pivotDropZoneProps("rows", { axis: "x", offset: context.level })}
      data-nqg-drop-item=""
    >
      <span
        className="flex min-w-0 items-center gap-1"
        title={`Drag ${context.label} to the field list or another header`}
        {...pivotFieldDragHandleProps({
          source,
          canDrop: (target) => canMovePivotField(grid.spec, { ...source, to: target.to, index: target.index }, { fields: grid.fields }),
          onDrop: (target) => grid.moveField({ ...source, to: target.to, index: target.index }),
        })}
      >
        <span className="truncate">{context.label}</span>
        {context.indicator}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Filter and sort ${context.label}`}
            className={cn("size-6", active ? "text-primary" : "text-muted-foreground")}
          >
            <PivotFilterIcon filled={active} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-[var(--radix-popover-content-available-height)] w-auto overflow-y-auto p-3">
          <PivotFilterMenu {...pivotFilterMenuProps(grid, field)} onClose={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Department / Line slicers plus the active-filter summary. */
function SlicerBar({ grid }: { grid: PivotGridState }) {
  const [multi, setMulti] = useState<Record<string, boolean>>({});
  const filters = grid.model.filters ?? [];
  const counts = grid.model.recordCount;
  const slicer = (field: string, columns: number, className: string, listClassName?: string) => (
    <PivotSlicer
      {...pivotSlicerProps(grid, field)}
      columns={columns}
      multiSelect={multi[field] ?? false}
      onMultiSelectChange={(v) => setMulti((m) => ({ ...m, [field]: v }))}
      className={className}
      classNames={listClassName ? { list: listClassName } : undefined}
    />
  );
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border/70 px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        {slicer("department", 2, "w-64 shadow-none")}
        {slicer("line", 6, "min-w-[28rem] flex-1 shadow-none", "max-h-[4.5rem] overflow-y-auto pr-1")}
      </div>
      <div className="flex min-h-7 flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {filters.length ? (
          <>
            <span>Filters</span>
            {filters.map((f, i) => (
              <Badge key={`${f.field}:${i}`} variant="secondary" className="font-normal">
                {f.text}
              </Badge>
            ))}
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => grid.setSpec((s) => clearPivotFilters(s.rows.reduce((acc, d) => setPivotTopN(acc, d.field, null), s)))}>
              Clear all
            </Button>
          </>
        ) : (
          <span>Click a slicer value to filter (Ctrl/⌘-click or the multi-select button to pick several); use a row header menu for sort and Top N.</span>
        )}
        {counts ? (
          <span className="ml-auto tabular-nums">
            {counts.matched} of {counts.total} records
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Planning grid from `@nqlib/nqgrid/pivot`: pinned Department (KPI panel, real rowSpan) and Line
 * columns, heat-colored months and a stacked header chart band, with Department / Line slicers and
 * an Excel-style filter menu on the Line header. Every control edits the spec — "Export" builds the
 * request a Tauri app sends to its backend, so the PDF/XLSX matches the screen (filters included).
 */
export function PlanningPivotDemo() {
  // `extraFields` adds region, channel and units to drag around (the other fields are unchanged).
  const rows = useMemo(() => generatePlanningPivotRows(7, { extraFields: true }), []);
  const pivot = usePivotGrid(demoSpec, rows);
  const { model, spec } = pivot;
  const [showExport, setShowExport] = useState(false);
  const [showFields, setShowFields] = useState(true);
  const scope = spec.heat?.scope ?? "all";
  const renderDimensionHeader = useCallback(
    (context: PivotDimensionHeaderContext) => <DimensionHeaderMenu grid={pivot} context={context} />,
    [pivot],
  );
  const layoutText = `${model.rowDimensions.map((d) => d.label).join(" → ")}${model.columnDimension ? ` × ${model.columnDimension.label}` : ""} · ${(spec.values ?? spec.measures.map((m) => m.id))
    .map((id) => spec.measures.find((m) => m.id === id)?.label ?? id)
    .join(", ")}`;

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[36rem] flex-col gap-3">
      <div className="flex min-h-0 flex-1 gap-3">
        <div className={cn(tableShellClass, flightsTableShellExtraClass, "min-w-0 flex-1")}>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold leading-tight">{model.title}</h2>
              <p className="text-xs text-muted-foreground" data-testid="pivot-layout">
                {layoutText}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Heat by</span>
              <Select value={scope} onValueChange={(v) => pivot.setHeatScope(v as PivotHeatScope)}>
                <SelectTrigger size="sm" minWidth="10rem" aria-label="Heat by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEAT_SCOPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={pivot.expandAll}>
                Expand all
              </Button>
              <Button size="sm" variant="outline" onClick={pivot.collapseAll}>
                Collapse all
              </Button>
              <Button size="sm" variant={showFields ? "secondary" : "outline"} aria-pressed={showFields} onClick={() => setShowFields((v) => !v)}>
                Fields
              </Button>
              <Button size="sm" onClick={() => setShowExport((v) => !v)}>
                {showExport ? "Hide export" : "Export"}
              </Button>
            </div>
          </div>

          <SlicerBar grid={pivot} />

          <ScrollArea
            orientation="both"
            fadeMask={false}
            className={tableScrollAreaRootClass}
            viewportStyle={tableScrollViewportStyle}
          >
            <PivotTable
              model={model}
              onToggleGroup={pivot.toggleGroup}
              renderDimensionHeader={renderDimensionHeader}
              aria-label="FY26 sales plan pivot"
            />
          </ScrollArea>

          <div className={tableFooterClass}>
            <p className="text-sm text-muted-foreground">
              {model.rows.length} visible rows · {model.columns.length} value columns · heat scope{" "}
              <span className="font-medium text-foreground">{HEAT_SCOPES.find((s) => s.value === scope)?.label}</span>
            </p>
            <p className="text-xs text-muted-foreground">Group rows show % of month total; lines show actuals.</p>
          </div>
        </div>
        {showFields ? (
          <aside className="flex w-80 shrink-0 flex-col overflow-y-auto" aria-label="Pivot field list">
            <PivotFieldList {...pivotFieldListProps(pivot)} className="shadow-none" />
          </aside>
        ) : null}
      </div>

      {showExport ? <ExportPanel grid={pivot} /> : null}
    </div>
  );
}
