import { useMemo, useState } from "react";
import {
  Card,
  CardFooter,
  Label,
  ScrollArea,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@nqlib/nqui";
import type { TableBodyFillMode } from "../lib/nqgrid-styling";
import {
  buildRowFillClass,
} from "../lib/nqgrid-styling";
import {
  cardTokenSpecs,
  highlightRing,
  TokenLegend,
} from "./token-legend";
import {
  resolvePlaygroundTableClassBundle,
  resolvePlaygroundTableBodyChromeClass,
  resolvePlaygroundTableColorTokens,
  resolvePlaygroundVirtualDataGridBundle,
  resolvePlaygroundVirtualDataGridTokens,
  resolvePlaygroundVirtualDataRowFillTokens,
} from "../lib/playground-table-tokens";
import {
  tableScrollAreaEdgeClass,
  tableScrollAreaRootClass,
  tableScrollViewportStyle,
  tableShellLayoutClass,
} from "../lib/nqui-table-shell";
import { PlaygroundOpaqueTableHead, PlaygroundStickyTableHeader } from "../lib/playground-table-chrome";
import { usePlaygroundTableSettings } from "../playground-table-settings";
import {
  VirtualDataTokenSpecimen,
  virtualDataTokenSpecs,
} from "./virtual-data-token-specimen";
import { RegionLabel } from "./region-label";

const CARD_ROWS = [
  { id: "1", name: "Acme Corp", stage: "Lead", selected: false, focus: true },
  { id: "2", name: "Globex", stage: "Trial", selected: false, focus: false },
  { id: "3", name: "Initech", stage: "Won", selected: true, focus: false },
] as const;

function CardTableSpecimen({
  activeId,
  onHover,
}: {
  activeId: string | null;
  onHover: (id: string | null) => void;
}) {
  const { libraryConfig } = usePlaygroundTableSettings();
  const tokens = useMemo(
    () => resolvePlaygroundTableColorTokens(libraryConfig, "card"),
    [libraryConfig],
  );
  const bundle = useMemo(() => resolvePlaygroundTableClassBundle(libraryConfig), [libraryConfig]);

  return (
    <div
      className={cn("relative", highlightRing(activeId === "shell"))}
      onMouseEnter={() => onHover("shell")}
      onMouseLeave={() => onHover(null)}
    >
      <RegionLabel className="left-3 top-3">shell.bg</RegionLabel>
      <Card className={cn(tableShellLayoutClass, "max-w-2xl shadow-sm", tokens.shell.bg, tokens.shell.border)}>
        <ScrollArea
          orientation="both"
          fadeMask={false}
          className={tableScrollAreaRootClass}
          viewportStyle={tableScrollViewportStyle}
        >
          <div className={tableScrollAreaEdgeClass}>
            <Table className="w-full caption-bottom border-separate border-spacing-0 text-sm">
              <PlaygroundStickyTableHeader
                className={cn("relative", highlightRing(activeId === "header"))}
                onMouseEnter={() => onHover("header")}
                onMouseLeave={() => onHover(null)}
              >
                <TableRow>
                  {(["#", "Account", "Stage"] as const).map((label, i, arr) => (
                    <PlaygroundOpaqueTableHead
                      key={label}
                      pinned={i === 0}
                      className={cn(
                        "relative",
                        highlightRing(activeId === (i === 0 ? "pinnedHead" : "headCell")),
                      )}
                      onMouseEnter={() => onHover(i === 0 ? "pinnedHead" : "headCell")}
                      onMouseLeave={() => onHover(null)}
                    >
                      {i === 0 ? <RegionLabel className="-top-2 left-1">pinned.head</RegionLabel> : null}
                      {i === arr.length - 1 ? (
                        <RegionLabel className="right-3 top-1">header.row</RegionLabel>
                      ) : null}
                      {label}
                    </PlaygroundOpaqueTableHead>
                  ))}
                </TableRow>
              </PlaygroundStickyTableHeader>
              <TableBody
                className={cn(
                  "relative",
                  resolvePlaygroundTableBodyChromeClass(libraryConfig),
                  highlightRing(activeId === "bodyFill" || activeId === "rowHover" || activeId === "rowSelected"),
                )}
                onMouseEnter={() => onHover("bodyFill")}
                onMouseLeave={() => onHover(null)}
              >
                {CARD_ROWS.map((row, rowIndex) => (
                  <TableRow
                    key={row.id}
                    data-state={row.selected ? "selected" : undefined}
                    className={cn(
                      bundle.row,
                      buildRowFillClass(tokens, rowIndex),
                      row.selected ? highlightRing(activeId === "rowSelected") : undefined,
                    )}
                    onMouseEnter={() => onHover(row.selected ? "rowSelected" : "rowHover")}
                    onMouseLeave={() => onHover(null)}
                  >
                    <TableCell
                      className={cn(
                        "relative",
                        highlightRing(activeId === "pinnedBody"),
                      )}
                      onMouseEnter={(e) => {
                        e.stopPropagation();
                        onHover("pinnedBody");
                      }}
                      onMouseLeave={() => onHover(null)}
                    >
                      {rowIndex === 0 ? (
                        <RegionLabel className="left-3 top-8">body.fill</RegionLabel>
                      ) : null}
                      {row.id}
                    </TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell
                      className={cn(row.focus && tokens.cell.focus, highlightRing(activeId === "cellFocus" && row.focus))}
                      onMouseEnter={() => row.focus && onHover("cellFocus")}
                      onMouseLeave={() => onHover(null)}
                    >
                      {row.stage}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
        <CardFooter
          className={cn(
            "relative shrink-0 border-t px-4 py-3 text-xs text-muted-foreground",
            tokens.footer.bg,
            tokens.footer.border,
            highlightRing(activeId === "footer"),
          )}
          onMouseEnter={() => onHover("footer")}
          onMouseLeave={() => onHover(null)}
        >
          <RegionLabel className="-top-2 left-3">footer.bg</RegionLabel>
          Pagination / row count
        </CardFooter>
      </Card>
    </div>
  );
}

export function DesignTokensPage() {
  const { libraryConfig, setTableBodyFill } = usePlaygroundTableSettings();
  const [cardHover, setCardHover] = useState<string | null>(null);
  const [virtualDataHover, setVirtualDataHover] = useState<string | null>(null);

  const rowFill = libraryConfig.styles?.tableBodyFill ?? "solid";

  const cardTokens = useMemo(
    () => resolvePlaygroundTableColorTokens(libraryConfig, "card"),
    [libraryConfig],
  );
  const cardBundle = useMemo(() => resolvePlaygroundTableClassBundle(libraryConfig), [libraryConfig]);
  const virtualDataGridTokens = useMemo(
    () => resolvePlaygroundVirtualDataGridTokens(libraryConfig),
    [libraryConfig],
  );
  const virtualDataRowFillTokens = useMemo(
    () => resolvePlaygroundVirtualDataRowFillTokens(libraryConfig),
    [libraryConfig],
  );
  const virtualDataGridBundle = useMemo(
    () => resolvePlaygroundVirtualDataGridBundle(libraryConfig),
    [libraryConfig],
  );

  const cardSpecs = useMemo(() => cardTokenSpecs(cardTokens, cardBundle), [cardTokens, cardBundle]);
  const virtualDataSpecs = useMemo(
    () => virtualDataTokenSpecs(virtualDataGridTokens, virtualDataRowFillTokens, virtualDataGridBundle),
    [virtualDataGridTokens, virtualDataRowFillTokens, virtualDataGridBundle],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 pb-8">
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Table design tokens</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Visual map of <code className="rounded bg-muted px-1">@nqlib/nqgrid/tokens</code>. The{" "}
          <strong className="font-medium text-foreground">Virtual Data</strong> specimen matches{" "}
          <code className="rounded bg-muted px-1">virtual-data-demo.tsx</code> — canonical analytics grid (
          <code className="rounded bg-muted px-1">grid-styles.ts</code>, row-index gutter, sticky pins). Card
          preset covers legacy dashboard tables (Portfolio / Flights).
        </p>
      </div>

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Virtual Data (canonical)</h3>
          <p className="text-sm text-muted-foreground">
            Default for new tables — <code className="rounded bg-muted px-1">nquiVirtualDataGridPreset()</code> grid
            chrome + card row fill. Scroll horizontally to inspect pinned row-index gutter tokens.
          </p>
        </div>
        <div className="grid gap-8 xl:grid-cols-[1fr_minmax(16rem,22rem)]">
          <VirtualDataTokenSpecimen activeId={virtualDataHover} onHover={setVirtualDataHover} />
          <TokenLegend
            title="Virtual Data legend"
            specs={virtualDataSpecs}
            activeId={virtualDataHover}
            onHover={setVirtualDataHover}
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Row fill (shared with Virtual Data + card tables)</Label>
            <ToggleGroup
              type="single"
              value={rowFill}
              onValueChange={(v) => v && setTableBodyFill(v as Exclude<TableBodyFillMode, "none">)}
              variant="outline"
              size="sm"
              aria-label="Row background"
            >
              <ToggleGroupItem value="solid" className="text-xs">
                Solid
              </ToggleGroupItem>
              <ToggleGroupItem value="striped" className="text-xs">
                Striped
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1fr_minmax(16rem,22rem)]">
          <CardTableSpecimen activeId={cardHover} onHover={setCardHover} />
          <TokenLegend
            title="Card preset legend"
            specs={cardSpecs}
            activeId={cardHover}
            onHover={setCardHover}
          />
        </div>
      </section>
    </div>
  );
}
