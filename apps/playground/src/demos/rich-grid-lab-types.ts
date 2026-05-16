import {
  demoLeadPerson,
  type RichNumberFormatOptions,
  type RichNumberStyle,
  type RichPerson,
  type RichPillVariant,
  type RichSchemaColumnDef,
  type RichStatusMapEntry,
} from "@nqlib/nqgrid";

export type LabStatusChoice = {
  key: string;
  label: string;
  variant?: RichPillVariant;
  /** CSS text color — overrides variant when set. */
  color?: string;
  /** CSS background — overrides variant when set. */
  backgroundColor?: string;
  /** CSS border color — overrides variant when set. */
  borderColor?: string;
};

export const DEFAULT_LAB_STATUS_CHOICES: readonly LabStatusChoice[] = [
  { key: "todo", label: "To do", variant: "outline" },
  { key: "in_progress", label: "In progress", variant: "default" },
  { key: "done", label: "Done", variant: "secondary" },
];

export const DEFAULT_LAB_PEOPLE_ROSTER: readonly RichPerson[] = [
  demoLeadPerson("Maya Chen"),
  demoLeadPerson("Jordan Lee"),
  demoLeadPerson("Sam Okonkwo"),
  demoLeadPerson("Riley Park"),
  demoLeadPerson("Alex Rivera"),
];

export type LabColumnKind = "text" | "number" | "date" | "status" | "people";

/** Presets for the add-column picker (all map to `kind: "number"` with different `format.style`). */
export type LabAddColumnPreset = LabColumnKind | "number-currency" | "number-percent";

export type LabRow = { readonly id: string } & Record<string, unknown>;

export type LabColumn = {
  readonly id: string;
  name: string;
  kind: LabColumnKind;
  /** Row field key (dynamic). */
  fieldKey: string;
  width: number;
  align?: "left" | "right";
  numberFormat?: RichNumberFormatOptions;
  /** Ordered status options (preferred over legacy `statusMap`). */
  statusChoices?: LabStatusChoice[];
  /** @deprecated Use `statusChoices`. */
  statusMap?: Record<string, RichStatusMapEntry>;
  /** When true (default for status columns), cells use a dropdown. */
  statusEditable?: boolean;
  /** When true, cells use `renderPeoplePicker` from table config + roster below. */
  peopleEditable?: boolean;
  /** Max assignees displayed / selectable. */
  peopleMax?: number;
  /** Roster entries for combobox options (defaults to demo leads). */
  peopleOptions?: RichPerson[];
  datePreset?: "dateShort" | "dateMedium" | "datetimeShort" | "timeShort";
};

export function labStatusMapFromColumn(col: LabColumn): Record<string, RichStatusMapEntry> {
  if (col.statusChoices?.length) {
    return Object.fromEntries(
      col.statusChoices.map((c) => [
        c.key,
        {
          label: c.label,
          variant: c.variant,
          ...(isNonEmptyColor(c.color) ? { color: c.color!.trim() } : {}),
          ...(isNonEmptyColor(c.backgroundColor) ? { backgroundColor: c.backgroundColor!.trim() } : {}),
          ...(isNonEmptyColor(c.borderColor) ? { borderColor: c.borderColor!.trim() } : {}),
        } satisfies RichStatusMapEntry,
      ]),
    );
  }
  return col.statusMap ?? { todo: { label: "To do", variant: "outline" } };
}

function isNonEmptyColor(v: string | undefined): v is string {
  return v != null && v.trim().length > 0;
}

export function labStatusChoiceOrder(col: LabColumn): string[] {
  if (col.statusChoices?.length) return col.statusChoices.map((c) => c.key);
  return Object.keys(labStatusMapFromColumn(col));
}

export function slugStatusKey(label: string, existing: readonly string[]): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "status";
  let key = base;
  let n = 1;
  while (existing.includes(key)) {
    key = `${base}_${n++}`;
  }
  return key;
}

export const LAB_ADD_COLUMN_OPTIONS: readonly {
  readonly preset: LabAddColumnPreset;
  readonly label: string;
  readonly hint: string;
}[] = [
  { preset: "text", label: "Text", hint: "Plain string" },
  { preset: "number", label: "Number", hint: "Decimal, prefix/suffix, compact notation" },
  { preset: "number-currency", label: "Currency", hint: "Intl currency (ISO code)" },
  { preset: "number-percent", label: "Percent", hint: "Plain label or battery bar" },
  { preset: "date", label: "Date", hint: "Intl date/time preset" },
  { preset: "status", label: "Status", hint: "Badge pill from enum map" },
  { preset: "people", label: "People", hint: "Assignable roster combobox (playground styling)" },
];

export function newLabId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultValueForKind(kind: LabColumnKind, numberStyle?: RichNumberStyle): unknown {
  switch (kind) {
    case "text":
      return "New value";
    case "number":
      return numberStyle === "percent" ? 25 : 0;
    case "date":
      return new Date().toISOString();
    case "status":
      return "todo";
    case "people":
      return [];
    default:
      return "";
  }
}

function numberFormatForStyle(style: RichNumberStyle): RichNumberFormatOptions {
  switch (style) {
    case "currency":
      return {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      };
    case "percent":
      return {
        style: "percent",
        percentDisplay: "plain",
        valueScale: "hundred",
        suffix: "%",
      };
    default:
      return { style: "decimal", minimumFractionDigits: 2, maximumFractionDigits: 2 };
  }
}

export function createLabColumnFromPreset(preset: LabAddColumnPreset, name?: string): LabColumn {
  if (preset === "number-currency") {
    return createLabColumn("number", name ?? "Currency", "currency");
  }
  if (preset === "number-percent") {
    return createLabColumn("number", name ?? "Percent", "percent");
  }
  return createLabColumn(preset, name);
}

export function createLabColumn(
  kind: LabColumnKind,
  name?: string,
  numberStyle: RichNumberStyle = "decimal",
): LabColumn {
  const id = newLabId("col");
  const fieldKey = `f_${id}`;
  const base: LabColumn = { id, name: name ?? kindLabel(kind), kind, fieldKey, width: 128 };
  switch (kind) {
    case "number":
      return {
        ...base,
        align: "right",
        numberFormat: numberFormatForStyle(numberStyle),
      };
    case "date":
      return { ...base, datePreset: "dateShort" };
    case "status":
      return {
        ...base,
        width: 148,
        statusEditable: true,
        statusChoices: [...DEFAULT_LAB_STATUS_CHOICES],
      };
    case "people":
      return {
        ...base,
        width: 240,
        peopleEditable: true,
        peopleMax: 5,
        peopleOptions: [...DEFAULT_LAB_PEOPLE_ROSTER],
      };
    default:
      return base;
  }
}

export function kindLabel(kind: LabColumnKind): string {
  return LAB_ADD_COLUMN_OPTIONS.find((o) => o.preset === kind)?.label ?? kind;
}

export function labNumberStyle(col: LabColumn): RichNumberStyle {
  return col.numberFormat?.style ?? "decimal";
}

export function labColumnToRichDef(col: LabColumn, locale: string): RichSchemaColumnDef<LabRow> {
  const accessorKey = col.fieldKey as keyof LabRow & string;
  const base = {
    id: col.id,
    name: col.name,
    header: col.name,
    width: col.width,
    accessorKey,
  };

  switch (col.kind) {
    case "text":
      return { ...base, kind: "text" };
    case "number":
      return {
        ...base,
        kind: "number",
        align: col.align ?? "right",
        format: { ...col.numberFormat, locale: col.numberFormat?.locale ?? locale },
      };
    case "date":
      return {
        ...base,
        kind: "date",
        format: { preset: col.datePreset ?? "dateShort", locale },
      };
    case "status":
      return {
        ...base,
        kind: "status",
        map: labStatusMapFromColumn(col),
        choiceOrder: labStatusChoiceOrder(col),
        editable: col.statusEditable ?? true,
      };
    case "people":
      return {
        ...base,
        kind: "people",
        max: col.peopleMax ?? 4,
        editable: col.peopleEditable === true,
        ...(col.peopleEditable === true && col.peopleOptions?.length
          ? { pickerOptions: col.peopleOptions }
          : {}),
      };
    default:
      return { ...base, kind: "text" };
  }
}

export const INITIAL_LAB_COLUMNS: LabColumn[] = [
  { id: "label", name: "Scenario", kind: "text", fieldKey: "label", width: 200 },
  {
    id: "amount",
    name: "Amount",
    kind: "number",
    fieldKey: "amount",
    width: 140,
    align: "right",
    numberFormat: { style: "decimal", prefix: "$", minimumFractionDigits: 2, maximumFractionDigits: 2 },
  },
  {
    id: "hours",
    name: "Effort",
    kind: "number",
    fieldKey: "hours",
    width: 120,
    align: "right",
    numberFormat: { style: "decimal", suffix: " h", minimumFractionDigits: 0, maximumFractionDigits: 2 },
  },
  {
    id: "progress",
    name: "Progress",
    kind: "number",
    fieldKey: "progress",
    width: 120,
    align: "right",
    numberFormat: { style: "percent", percentDisplay: "battery", valueScale: "hundred" },
  },
  {
    id: "status",
    name: "Status",
    kind: "status",
    fieldKey: "status",
    width: 148,
    statusEditable: true,
    statusChoices: [...DEFAULT_LAB_STATUS_CHOICES],
  },
  {
    id: "assignees",
    name: "Assignees",
    kind: "people",
    fieldKey: "assignees",
    width: 260,
    peopleEditable: true,
    peopleMax: 5,
    peopleOptions: [...DEFAULT_LAB_PEOPLE_ROSTER],
  },
];

export function createInitialRows(): LabRow[] {
  return [
    {
      id: "r1",
      label: "Northwind rollout",
      amount: 128_400.5,
      hours: 1240.75,
      progress: 61,
      status: "in_progress",
      assignees: [DEFAULT_LAB_PEOPLE_ROSTER[0]!, DEFAULT_LAB_PEOPLE_ROSTER[1]!],
    },
    {
      id: "r2",
      label: "Latency budget",
      amount: -912.34,
      hours: 18.25,
      progress: 12,
      status: "todo",
      assignees: [DEFAULT_LAB_PEOPLE_ROSTER[2]!],
    },
    {
      id: "r3",
      label: "Pilot cohort",
      amount: 99.995,
      hours: 6,
      progress: 100,
      status: "done",
      assignees: [DEFAULT_LAB_PEOPLE_ROSTER[4]!, DEFAULT_LAB_PEOPLE_ROSTER[3]!],
    },
  ];
}
