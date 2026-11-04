import type { ColumnSchema, SelectOption } from "@nqlib/nqgrid/engine";
import { catalogEntry } from "./column-model-catalog";
import {
  DEFAULT_STATUS_OPTIONS,
  PRIORITY_OPTIONS_EXPORT,
  cloneStatusOptions,
  normalizeStatusOrders,
} from "./pm-schema";

/** Per-column project field model — Linear/Jira field settings over ColumnSchema. */
export interface PmColumnModel extends ColumnSchema {
  /** Show in table / list views. */
  visible: boolean;
  /** Drive kanban columns (select types only). */
  boardGroup?: boolean;
  /** Title field — cannot delete or hide. */
  locked?: boolean;
}

export function toColumnSchema(model: PmColumnModel): ColumnSchema {
  const { visible: _v, boardGroup: _b, locked: _l, ...schema } = model;
  return schema;
}

export function visibleColumns(models: readonly PmColumnModel[]): ColumnSchema[] {
  return models.filter((m) => m.visible).map(toColumnSchema);
}

export function boardGroupColumn(models: readonly PmColumnModel[]): PmColumnModel | undefined {
  return models.find((m) => m.visible && m.boardGroup && m.type === "select");
}

export function nextFieldId(models: readonly PmColumnModel[], base: string): string {
  let n = 1;
  let id = base;
  while (models.some((m) => m.id === id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  return id;
}

export function createColumnModel(
  typeId: string,
  models: readonly PmColumnModel[],
  label?: string,
): PmColumnModel {
  const entry = catalogEntry(typeId);
  const id = nextFieldId(models, typeId === "select" ? "field" : typeId);
  const defaultOptions =
    typeId === "select"
      ? [{ id: "opt_1", label: "Option 1", order: 0, color: "#64748b" }]
      : entry?.defaultSchema?.options;

  const base: PmColumnModel = {
    id,
    label: label ?? entry?.label ?? typeId,
    type: typeId,
    visible: true,
    ...entry?.defaultSchema,
    ...(defaultOptions ? { options: [...defaultOptions] } : {}),
  };

  return base;
}

export const DEFAULT_COLUMN_MODELS: PmColumnModel[] = [
  { id: "title", label: "Task", type: "text", visible: true, locked: true },
  {
    id: "status",
    label: "Status",
    type: "select",
    visible: true,
    boardGroup: true,
    options: cloneStatusOptions(DEFAULT_STATUS_OPTIONS),
  },
  {
    id: "priority",
    label: "Priority",
    type: "select",
    visible: true,
    options: cloneStatusOptions(PRIORITY_OPTIONS_EXPORT),
  },
  { id: "assignee", label: "Assignee", type: "person", visible: true },
  { id: "effort", label: "Effort", type: "number", visible: true, format: { suffix: " pt" } },
  {
    id: "progress",
    label: "Progress",
    type: "number",
    visible: true,
    format: { style: "percent", valueScale: "hundred" },
  },
  {
    id: "budget",
    label: "Budget",
    type: "number",
    visible: true,
    format: { style: "currency", currency: "USD" },
  },
  { id: "due", label: "Due", type: "date", visible: true, format: { preset: "dateMedium" } },
  {
    id: "timeline",
    label: "Timeline",
    type: "dateRange",
    visible: true,
    format: { preset: "dateMedium" },
  },
];

export function patchColumnModel(
  models: PmColumnModel[],
  id: string,
  patch: Partial<PmColumnModel>,
): PmColumnModel[] {
  return models.map((m) => (m.id === id ? { ...m, ...patch } : m));
}

export function setBoardGroup(models: PmColumnModel[], id: string): PmColumnModel[] {
  return models.map((m) => ({
    ...m,
    boardGroup: m.id === id && m.type === "select" ? true : undefined,
  }));
}

export function changeColumnType(models: PmColumnModel[], id: string, typeId: string): PmColumnModel[] {
  const fresh = createColumnModel(typeId, models.filter((m) => m.id !== id));
  return models.map((m) => {
    if (m.id !== id) return m;
    return {
      ...fresh,
      id: m.id,
      label: m.label,
      visible: m.visible,
      locked: m.locked,
      boardGroup: typeId === "select" ? m.boardGroup : undefined,
    };
  });
}

export function updateSelectOptions(
  models: PmColumnModel[],
  columnId: string,
  options: SelectOption[],
): PmColumnModel[] {
  return patchColumnModel(models, columnId, { options: normalizeStatusOrders(options) });
}

export function removeColumnModel(models: PmColumnModel[], id: string): PmColumnModel[] {
  const target = models.find((m) => m.id === id);
  if (!target || target.locked) return models;
  return models.filter((m) => m.id !== id);
}

export function moveColumnModel(models: PmColumnModel[], id: string, direction: "up" | "down"): PmColumnModel[] {
  const index = models.findIndex((m) => m.id === id);
  if (index < 0) return models;
  const swap = direction === "up" ? index - 1 : index + 1;
  if (swap < 0 || swap >= models.length) return models;
  const next = [...models];
  [next[index], next[swap]] = [next[swap]!, next[index]!];
  return next;
}

/** Reorder visible columns after a header drag; hidden fields keep their relative tail order. */
export function applyVisibleColumnOrder(
  models: readonly PmColumnModel[],
  orderedVisibleIds: readonly string[],
): PmColumnModel[] {
  const byId = new Map(models.map((m) => [m.id, m]));
  const reordered = orderedVisibleIds
    .map((id) => byId.get(id))
    .filter((m): m is PmColumnModel => m != null);
  const tail = models.filter((m) => !orderedVisibleIds.includes(m.id));
  return [...reordered, ...tail];
}
