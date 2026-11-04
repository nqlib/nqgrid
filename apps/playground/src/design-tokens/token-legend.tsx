import { cn } from "@nqlib/nqui";
import type { TableColorTokens } from "../lib/nqgrid-styling";

export type TokenSpec = {
  id: string;
  path: string;
  label: string;
  classes: string;
  hint?: string;
};

export function TokenLegend({
  title,
  specs,
  activeId,
  onHover,
  className,
}: {
  title: string;
  specs: TokenSpec[];
  activeId?: string | null;
  onHover?: (id: string | null) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className="space-y-2">
        {specs.map((spec) => (
          <li key={spec.id}>
            <button
              type="button"
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                activeId === spec.id
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/60 bg-muted/20 hover:bg-muted/35 dark:bg-muted/10",
              )}
              onMouseEnter={() => onHover?.(spec.id)}
              onMouseLeave={() => onHover?.(null)}
              onFocus={() => onHover?.(spec.id)}
              onBlur={() => onHover?.(null)}
            >
              <span className="block text-xs font-medium text-foreground">{spec.label}</span>
              <span className="block font-mono text-[10px] text-muted-foreground">{spec.path}</span>
              {spec.classes ? (
                <code className="mt-1 block break-all font-mono text-[10px] leading-relaxed text-foreground/80">
                  {spec.classes}
                </code>
              ) : null}
              {spec.hint ? <span className="mt-1 block text-[10px] text-muted-foreground">{spec.hint}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function highlightRing(active: boolean) {
  return cn(
    "transition-[box-shadow,outline-color]",
    active && "rounded-md outline outline-2 outline-offset-2 outline-primary/70",
  );
}

export function cardTokenSpecs(tokens: TableColorTokens, bundle: {
  body: string;
  header: string;
  headCell: string;
  pinnedHeadFill: string;
  pinnedBodyFill: string;
  footer: string;
  tableShell: string;
}): TokenSpec[] {
  return [
    {
      id: "shell",
      path: "shell.*",
      label: "Card shell",
      classes: [tokens.shell.bg, tokens.shell.border, tokens.shell.text, tokens.shell.shadow].filter(Boolean).join(" · "),
      hint: "Outer Card + bounded scroll region",
    },
    {
      id: "header",
      path: "header.row",
      label: "Sticky header row",
      classes: bundle.header,
    },
    {
      id: "headCell",
      path: "header.cell",
      label: "Header cell",
      classes: [tokens.header.cell, tokens.header.cellText].join(" · "),
    },
    {
      id: "bodyFill",
      path: `body.fillMode = ${tokens.body.fillMode}`,
      label: "Row fill",
      classes:
        tokens.body.fillMode === "striped"
          ? [tokens.body.rowStripeOdd, tokens.body.rowStripeEven].join(" · ")
          : tokens.body.rowSolid,
    },
    {
      id: "rowHover",
      path: "body.rowHover",
      label: "Row hover",
      classes: tokens.body.rowHover,
      hint: "Hover row 2 in the preview",
    },
    {
      id: "rowSelected",
      path: "body.rowSelected",
      label: "Row selected",
      classes: tokens.body.rowSelected,
      hint: "Row 3 uses data-state=selected",
    },
    {
      id: "pinnedHead",
      path: "pinned.headFill",
      label: "Pinned header fill",
      classes: bundle.pinnedHeadFill,
    },
    {
      id: "pinnedBody",
      path: "pinned.bodyFill + bodyHoverLock",
      label: "Pinned body fill",
      classes: bundle.pinnedBodyFill,
    },
    {
      id: "footer",
      path: "footer.*",
      label: "Footer strip",
      classes: [tokens.footer.bg, tokens.footer.border].join(" · "),
    },
    {
      id: "cellFocus",
      path: "cell.focus",
      label: "Focused cell",
      classes: tokens.cell.focus,
      hint: "Shown on “Stage” in row 1",
    },
  ];
}

export function spreadsheetTokenSpecs(
  tokens: TableColorTokens,
  bundle: {
    gridShell: string;
    header: string;
    gridHeadCell: string;
    gridBody: string;
    pinnedHeadFill: string;
    pinnedBodyFill: string;
  },
): TokenSpec[] {
  return [
    {
      id: "shell",
      path: "shell.bg",
      label: "Grid shell",
      classes: tokens.shell.bg,
      hint: "Dense spreadsheet outer surface",
    },
    {
      id: "header",
      path: "header.row",
      label: "Sticky header",
      classes: bundle.header,
    },
    {
      id: "headCell",
      path: "header.cell",
      label: "Header cell",
      classes: bundle.gridHeadCell,
    },
    {
      id: "bodyHover",
      path: "body.rowHover",
      label: "Row hover",
      classes: tokens.body.rowHover,
      hint: "Muted hover (not accent)",
    },
    {
      id: "rowSelected",
      path: "body.rowSelected",
      label: "Row selected",
      classes: tokens.body.rowSelected,
    },
    {
      id: "borderColumn",
      path: "border.column + cell.default",
      label: "Cell borders",
      classes: [tokens.border.column, tokens.cell.default].filter(Boolean).join(" · "),
    },
    {
      id: "pinnedHead",
      path: "pinned.headFill",
      label: "Pinned # / Name header",
      classes: bundle.pinnedHeadFill,
    },
    {
      id: "pinnedBody",
      path: "pinned.bodyFill",
      label: "Pinned body cells",
      classes: bundle.pinnedBodyFill,
      hint: "Opaque — no bleed when scrolling",
    },
    {
      id: "cellRange",
      path: "cell.rangeFill / rangeActive",
      label: "Range selection",
      classes: [tokens.cell.rangeFill, tokens.cell.rangeActive].join(" · "),
      hint: "Keyboard grid demo cell",
    },
  ];
}
