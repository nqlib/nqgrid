# @nqlib/nqgantt

Headless **gantt / timeline** engine — the time-axis member of the `table · gantt · board`
family. It does not define its own data model: it **projects the same schema-typed rows**
that [`@nqlib/nqgrid`](https://www.npmjs.com/package/@nqlib/nqgrid) renders as a grid onto a
horizontal time axis, with **zero data duplication**.

A task that is a row of cells in the grid becomes a bar in the gantt — positioned by its
`timeline` column (`toInterval`), colored by its `status` column (`style`), and lane'd by an
assignee/status column (`compareKey`). Edits in either view commit **raw dates** back through
the same store, so both re-derive instantly.

## The one seam

The table renders cells via `parse → format → style`. The gantt needs exactly one more thing
from a column type: **`toInterval(parsed) → { start, end }`**, exposed by nqgrid's `timeline`
and `date` column kinds. Columns that don't implement it (`number`, `text`, `select`) are
ignored by the axis — but their `format`/`style` still drive bar labels and colors.

## Install

```bash
pnpm add @nqlib/nqgantt @nqlib/nqgrid react react-dom
```

## Usage

```tsx
import { Gantt } from "@nqlib/nqgantt";
import type { RichSchemaColumnDef } from "@nqlib/nqgrid";

type Task = { id: string; title: string; status: string; assignee: string; span: { start: string; end: string } };

const schema: RichSchemaColumnDef<Task>[] = [
  { id: "title", name: "Task", kind: "text", accessorKey: "title" },
  { id: "status", name: "Status", kind: "status", accessorKey: "status", map: STATUS_MAP, choiceOrder: [...] },
  { id: "assignee", name: "Owner", kind: "text", accessorKey: "assignee" },
  { id: "span", name: "Timeline", kind: "timeline", accessorKey: "span" }, // ◀ the seam
];

<Gantt
  rows={tasks}
  schema={schema}
  roles={{ labelColumnId: "title", colorColumnId: "status", laneColumnId: "assignee" }}
  getRowId={(t) => t.id}
  zoom="week"
  dependencies={[{ from: "t1", to: "t2" }]}
  onReschedule={(id, next) => commit(id, next)} // next = { start: Date, end: Date } — raw
/>;
```

## API

| Export | Purpose |
|--------|---------|
| `Gantt` | React renderer: time header, swimlanes, bars, milestones, dependency arrows, drag-to-reschedule. |
| `buildGanttModel` | Pure projection of `{ rows, schema, roles }` → `{ items, lanes, domain }`. |
| `createTimeScale` | Invertible date↔pixel scale (`toX` / `toDate` / `toDuration`) + ticks per zoom unit. |
| `rescheduleInterval` / `snapDate` | Convert a drag delta into new snapped **dates** (move / resize). |
| `routeDependencies` | Finish-to-start orthogonal connector geometry over bar boxes. |

## Principles

- **Store `raw` only.** Bar geometry is recomputed from `toInterval(parse(raw))` every
  render — never a stored pixel position. Dragging commits dates, not coordinates.
- **No business types.** The engine never branches on `"status"`; it asks the column plugin
  for a color and the timeline plugin for an interval.
- **Shared grouping key.** Swimlanes use the same `compareKey` the table sorts/groups by — so
  "group by status" behaves identically across grid, gantt, and a future board.

## License

MIT
