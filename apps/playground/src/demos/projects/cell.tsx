/**
 * THE shared cell renderer. One component runs the engine pipeline
 * (parse → format → style) for every column type and maps the returned `CellStyle`
 * DATA onto nqui visuals. Table, list, and board all reuse this exact output — a
 * card field in list/board is the same cell as a table cell. No per-type markup.
 */
import { cn } from "@nqlib/nqui";
import { renderCell, type ColumnSchema } from "@nqlib/nqgrid/engine";
import { pmRegistry, taskValue, type Task } from "./pm-schema";

/** Soft chip from a raw color value — the look the engine's CellStyle describes. */
function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `${color}1f`, borderColor: `${color}55` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {children}
    </span>
  );
}

export function Cell({
  task,
  schema,
  className,
}: {
  task: Task;
  schema: ColumnSchema;
  className?: string;
}) {
  const type = pmRegistry.require(schema.type);
  const { display, style, error } = renderCell(taskValue(task, schema.id), type, schema);

  if (error || display === "") {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  // A chip color in CellStyle → a pill (status, priority, person).
  if (style.chipBackground) {
    return (
      <span className={className}>
        <Chip color={style.chipBackground}>{display}</Chip>
      </span>
    );
  }

  // Percent bar from style.bar (number type with percent format).
  if (style.bar != null) {
    const pct = Math.round(style.bar * 100);
    return (
      <span className={cn("inline-flex min-w-[5rem] items-center gap-2", className)}>
        <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-muted">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-primary/80"
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="tabular-nums text-xs">{display}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "tabular-nums",
        style.align === "right" && "text-right",
        style.muted && "text-muted-foreground",
        className,
      )}
    >
      {display}
    </span>
  );
}
