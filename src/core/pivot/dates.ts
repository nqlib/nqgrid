import type { PivotDateGroup, PivotFieldSpec, PivotSpec } from "./types";

/**
 * Excel-style date grouping ("Group by Years / Quarters / Months / Days", fiscal years).
 *
 * A date field `orderDate` feeds derived key fields named `orderDate:year`, `orderDate:quarter`, …
 * (or any name declared in `spec.fields` with `source` + `dateGroup`). Values are parsed once per
 * record into wall-clock day numbers, deterministically in UTC (optionally shifted by a fixed
 * `timeZoneOffsetMinutes`), never through the runtime's local time zone or `Intl`. Keys sort
 * chronologically and labels are plain strings (`Q1 FY26`, `Jan 2026`), so every runtime prints the
 * same model. Rules: `docs/pivot-headless.md` ("Date grouping").
 */

/** Every date group, coarse to fine (also the order "Group by" applies them in). */
export const PIVOT_DATE_GROUPS: readonly PivotDateGroup[] = ["year", "yearQuarter", "quarter", "yearMonth", "month", "week", "day"];

/** Default month labels (override with `monthNames` on the field's catalogue entry). */
export const PIVOT_MONTH_NAMES: readonly string[] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Day number of invalid / missing dates (their key is `""`, shown as `(blank)`). */
export const PIVOT_INVALID_DAY = -2147483648;

/** Gap filling (`keepEmpty`) stops after this many keys per level (e.g. ~27 years of days). */
export const PIVOT_MAX_DATE_FILL = 10_000;

const GROUP_SET: ReadonlySet<string> = new Set(PIVOT_DATE_GROUPS);
/** Groups whose keys are calendar periods (an interval of days); `quarter` / `month` are cyclic. */
const PERIOD_GROUPS: ReadonlySet<PivotDateGroup> = new Set(["year", "yearQuarter", "yearMonth", "week", "day"]);

const GROUP_LABELS: Readonly<Record<PivotDateGroup, string>> = {
  year: "Year",
  yearQuarter: "Year-Quarter",
  quarter: "Quarter",
  yearMonth: "Year-Month",
  month: "Month",
  week: "Week",
  day: "Day",
};

export function isPivotDateGroup(value: unknown): value is PivotDateGroup {
  return typeof value === "string" && GROUP_SET.has(value);
}

/** English name of a date group (`Year`, `Quarter`, …), used in default field labels. */
export function pivotDateGroupLabel(group: PivotDateGroup): string {
  return GROUP_LABELS[group];
}

/** Conventional derived field name: `orderDate` + `year` → `orderDate:year`. */
export function pivotDateFieldName(source: string, group: PivotDateGroup): string {
  return `${source}:${group}`;
}

/** `orderDate:year` → `{ source: "orderDate", group: "year" }`; `null` for other names. */
export function parsePivotDateFieldName(field: string): { readonly source: string; readonly group: PivotDateGroup } | null {
  const at = field.lastIndexOf(":");
  if (at <= 0) return null;
  const group = field.slice(at + 1);
  return isPivotDateGroup(group) ? { source: field.slice(0, at), group } : null;
}

/** A resolved derived date field (`resolvePivotDateField`). */
export interface PivotDateFieldDef {
  /** The derived field (`orderDate:year`). */
  readonly field: string;
  /** The record field holding the dates. */
  readonly source: string;
  readonly group: PivotDateGroup;
  /** First month of the fiscal year, 1–12 (1 = calendar year). Fiscal years are named by the year they end in. */
  readonly fiscalYearStartMonth: number;
  /** Fixed offset applied to instants (epoch ms, `Date`, ISO strings with a zone) before taking the day. */
  readonly timeZoneOffsetMinutes: number;
  readonly monthNames: readonly string[];
}

const intOr = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : fallback;

/**
 * The date-group definition of `field`, or `null` when it is not a derived date field. Derived
 * fields are catalogue entries with `source` + `dateGroup`, or names like `orderDate:year` without
 * a catalogue entry of their own. Settings (`fiscalYearStartMonth`, `timeZoneOffsetMinutes`,
 * `monthNames`): the field's own entry › the source field's entry › defaults.
 */
export function resolvePivotDateField(spec: Pick<PivotSpec, "fields">, field: string): PivotDateFieldDef | null {
  const fields = spec.fields ?? [];
  const own = fields.find((f) => f.field === field);
  let source: string;
  let group: PivotDateGroup;
  if (own?.source && isPivotDateGroup(own.dateGroup)) {
    source = own.source;
    group = own.dateGroup;
  } else {
    if (own && own.dateGroup === undefined && own.type !== undefined && own.type !== "date") return null;
    const parsed = parsePivotDateFieldName(field);
    if (!parsed) return null;
    ({ source, group } = parsed);
  }
  const src: PivotFieldSpec | undefined = fields.find((f) => f.field === source);
  const pick = <K extends "fiscalYearStartMonth" | "timeZoneOffsetMinutes" | "monthNames">(key: K) => own?.[key] ?? src?.[key];
  const names = pick("monthNames");
  return {
    field,
    source,
    group,
    fiscalYearStartMonth: intOr(pick("fiscalYearStartMonth"), 1, 12, 1),
    timeZoneOffsetMinutes: intOr(pick("timeZoneOffsetMinutes"), -840, 840, 0),
    monthNames: Array.isArray(names) && names.length === 12 ? names : PIVOT_MONTH_NAMES,
  };
}

/** Cache key of a definition's record keys (labels / month names excluded). */
export function pivotDateKeyId(def: PivotDateFieldDef): string {
  return `${def.source}\u0000${def.group}\u0000${def.fiscalYearStartMonth}\u0000${def.timeZoneOffsetMinutes}`;
}

// ---------------------------------------------------------------------------
// Civil calendar (proleptic Gregorian, no Date / time zone involved)
// ---------------------------------------------------------------------------

/** Days since 1970-01-01 for a civil date (H. Hinnant's algorithm). */
export function pivotDaysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Civil `[year, month (1–12), day]` of a day number. */
export function pivotCivilFromDays(days: number): [number, number, number] {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
}

const daysInMonth = (y: number, m: number): number =>
  m === 2 ? (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28) : m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;

const MS_PER_DAY = 86_400_000;
const MAX_MS = 8.64e15;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Two / four ASCII digits at `i`, or -1. */
function digits(s: string, i: number, n: number): number {
  let v = 0;
  for (let k = 0; k < n; k++) {
    const c = s.charCodeAt(i + k) - 48;
    if (!(c >= 0 && c <= 9)) return -1;
    v = v * 10 + c;
  }
  return v;
}

/**
 * Wall-clock day number of an ISO-8601 string, or `PIVOT_INVALID_DAY`. Accepts `YYYY-MM`,
 * `YYYY-MM-DD` and `YYYY-MM-DD[T ]HH:mm[:ss[.fff]][Z|±HH[:mm]]`. Strings without a zone are wall-clock
 * dates (taken as is); strings with `Z` / an offset are instants, shifted by `offsetMinutes`.
 */
export function parsePivotIsoDay(input: string, offsetMinutes = 0): number {
  const s = input.length > 0 && (input.charCodeAt(0) <= 32 || input.charCodeAt(input.length - 1) <= 32) ? input.trim() : input;
  const n = s.length;
  if (n < 7 || s.charCodeAt(4) !== 45) return PIVOT_INVALID_DAY;
  const y = digits(s, 0, 4);
  const m = digits(s, 5, 2);
  if (y < 0 || m < 1 || m > 12) return PIVOT_INVALID_DAY;
  if (n === 7) return pivotDaysFromCivil(y, m, 1);
  if (n < 10 || s.charCodeAt(7) !== 45) return PIVOT_INVALID_DAY;
  const d = digits(s, 8, 2);
  if (d < 1 || d > daysInMonth(y, m)) return PIVOT_INVALID_DAY;
  const day = pivotDaysFromCivil(y, m, d);
  if (n === 10) return day;
  const sep = s.charCodeAt(10);
  if ((sep !== 84 && sep !== 116 && sep !== 32) || n < 16 || s.charCodeAt(13) !== 58) return PIVOT_INVALID_DAY;
  const hh = digits(s, 11, 2);
  const mi = digits(s, 14, 2);
  if (hh < 0 || hh > 23 || mi < 0 || mi > 59) return PIVOT_INVALID_DAY;
  let i = 16;
  let ss = 0;
  let ms = 0;
  if (i < n && s.charCodeAt(i) === 58) {
    ss = digits(s, i + 1, 2);
    if (ss < 0 || ss > 60) return PIVOT_INVALID_DAY;
    i += 3;
    if (i < n && (s.charCodeAt(i) === 46 || s.charCodeAt(i) === 44)) {
      i++;
      const start = i;
      let scale = 100;
      while (i < n) {
        const c = s.charCodeAt(i) - 48;
        if (!(c >= 0 && c <= 9)) break;
        ms += c * scale;
        scale /= 10;
        i++;
      }
      if (i === start) return PIVOT_INVALID_DAY;
    }
  }
  if (i === n) return day; // wall-clock time without a zone
  const z = s.charCodeAt(i);
  let zoneMinutes: number;
  if ((z === 90 || z === 122) && i + 1 === n) {
    zoneMinutes = 0;
  } else if (z === 43 || z === 45) {
    const oh = digits(s, i + 1, 2);
    if (oh < 0 || oh > 18) return PIVOT_INVALID_DAY;
    let om = 0;
    const rest = n - (i + 3);
    if (rest === 3 && s.charCodeAt(i + 3) === 58) om = digits(s, i + 4, 2);
    else if (rest === 2) om = digits(s, i + 3, 2);
    else if (rest !== 0) return PIVOT_INVALID_DAY;
    if (om < 0 || om > 59) return PIVOT_INVALID_DAY;
    zoneMinutes = (z === 45 ? -1 : 1) * (oh * 60 + om);
  } else {
    return PIVOT_INVALID_DAY;
  }
  const utcMs = day * MS_PER_DAY + ((hh * 60 + mi - zoneMinutes) * 60 + ss) * 1000 + ms;
  return Math.floor((utcMs + offsetMinutes * 60_000) / MS_PER_DAY);
}

/**
 * Wall-clock day number (days since 1970-01-01) of a record value, or `PIVOT_INVALID_DAY`:
 * epoch milliseconds (numbers) and `Date`s are instants shifted by `offsetMinutes`; ISO strings
 * see `parsePivotIsoDay`. Anything else (including `""`, `null`, other strings) is invalid.
 */
export function pivotDayOf(value: unknown, offsetMinutes = 0): number {
  if (typeof value === "string") return parsePivotIsoDay(value, offsetMinutes);
  let ms: number;
  if (typeof value === "number") ms = value;
  else if (value instanceof Date) ms = value.getTime();
  else return PIVOT_INVALID_DAY;
  if (!Number.isFinite(ms) || Math.abs(ms) > MAX_MS) return PIVOT_INVALID_DAY;
  return Math.floor((ms + offsetMinutes * 60_000) / MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// Period ids, keys and labels
// ---------------------------------------------------------------------------

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const pad4 = (n: number) => (n < 10 ? `000${n}` : n < 100 ? `00${n}` : n < 1000 ? `0${n}` : String(n));

/** Fiscal year (named by the year it ends in) of a civil month. */
function fiscalYear(y: number, m: number, start: number): number {
  return start === 1 || m < start ? y : y + 1;
}

/** Fiscal quarter (1–4) of a civil month. */
function fiscalQuarter(m: number, start: number): number {
  return Math.floor(((m - start + 12) % 12) / 3) + 1;
}

/** ISO week `[weekYear, week]` of a day number. */
function isoWeek(days: number): [number, number] {
  const wd = (((days + 3) % 7) + 7) % 7; // Monday = 0
  const thursday = days - wd + 3;
  const [ty] = pivotCivilFromDays(thursday);
  return [ty, Math.floor((thursday - pivotDaysFromCivil(ty, 1, 1)) / 7) + 1];
}

/**
 * Integer id of the period containing `days` (equal ids ⇔ equal keys). Used by the encoding so a
 * key string is built once per distinct period, not once per record.
 */
export function pivotDatePeriodId(days: number, group: PivotDateGroup, fiscalStart: number): number {
  if (group === "day") return days;
  if (group === "week") {
    const [wy, w] = isoWeek(days);
    return wy * 100 + w;
  }
  const [y, m] = pivotCivilFromDays(days);
  switch (group) {
    case "year":
      return fiscalYear(y, m, fiscalStart);
    case "quarter":
      return fiscalQuarter(m, fiscalStart);
    case "month":
      return m;
    case "yearMonth":
      return y * 12 + (m - 1);
    case "yearQuarter":
      return fiscalYear(y, m, fiscalStart) * 4 + (fiscalQuarter(m, fiscalStart) - 1);
  }
}

/** Key of the period containing `days` (`""` for invalid days or years outside 1–9999). */
export function pivotDateKeyOfDay(days: number, group: PivotDateGroup, fiscalStart: number): string {
  if (days === PIVOT_INVALID_DAY) return "";
  return pivotDateKeyOfPeriod(pivotDatePeriodId(days, group, fiscalStart), group);
}

/** Key of a period id (see `pivotDatePeriodId`). */
export function pivotDateKeyOfPeriod(id: number, group: PivotDateGroup): string {
  const year = (y: number) => (y >= 1 && y <= 9999 ? pad4(y) : null);
  switch (group) {
    case "year":
      return year(id) ?? "";
    case "quarter":
      return `Q${id}`;
    case "month":
      return pad2(id);
    case "yearMonth": {
      const y = year(Math.floor(id / 12));
      return y === null ? "" : `${y}-${pad2((id % 12) + 1)}`;
    }
    case "yearQuarter": {
      const y = year(Math.floor(id / 4));
      return y === null ? "" : `${y}-Q${(id % 4) + 1}`;
    }
    case "week": {
      const y = year(Math.floor(id / 100));
      return y === null ? "" : `${y}-W${pad2(id % 100)}`;
    }
    case "day": {
      const [yy, m, d] = pivotCivilFromDays(id);
      const y = year(yy);
      return y === null ? "" : `${y}-${pad2(m)}-${pad2(d)}`;
    }
  }
}

interface ParsedKey {
  readonly y: number;
  /** Month (1–12), quarter (1–4) or week (1–53) depending on the group. */
  readonly a: number;
  readonly d: number;
}

function parseKey(key: string, group: PivotDateGroup): ParsedKey | null {
  switch (group) {
    case "year": {
      const y = key.length === 4 ? digits(key, 0, 4) : -1;
      return y > 0 ? { y, a: 0, d: 0 } : null;
    }
    case "quarter":
      return key.length === 2 && key[0] === "Q" && key[1]! >= "1" && key[1]! <= "4" ? { y: 0, a: Number(key[1]), d: 0 } : null;
    case "month": {
      const m = key.length === 2 ? digits(key, 0, 2) : -1;
      return m >= 1 && m <= 12 ? { y: 0, a: m, d: 0 } : null;
    }
    case "yearMonth": {
      const y = digits(key, 0, 4);
      const m = key.length === 7 && key[4] === "-" ? digits(key, 5, 2) : -1;
      return y > 0 && m >= 1 && m <= 12 ? { y, a: m, d: 0 } : null;
    }
    case "yearQuarter": {
      const y = digits(key, 0, 4);
      const q = key.length === 7 && key.slice(4, 6) === "-Q" ? digits(key, 6, 1) : -1;
      return y > 0 && q >= 1 && q <= 4 ? { y, a: q, d: 0 } : null;
    }
    case "week": {
      const y = digits(key, 0, 4);
      const w = key.length === 8 && key.slice(4, 6) === "-W" ? digits(key, 6, 2) : -1;
      return y > 0 && w >= 1 && w <= 53 ? { y, a: w, d: 0 } : null;
    }
    case "day": {
      const y = digits(key, 0, 4);
      const m = key.length === 10 && key[4] === "-" && key[7] === "-" ? digits(key, 5, 2) : -1;
      const d = m > 0 ? digits(key, 8, 2) : -1;
      return y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) ? { y, a: m, d } : null;
    }
  }
}

const shortYear = (y: number) => pad2(y % 100);

/**
 * Display label of a date key: `2026` / `FY26`, `Q1`, `Jan`, `Jan 2026`, `Q1 2026` / `Q1 FY26`,
 * `W03 2026`, `15 Jan 2026`. Fiscal labels apply when `fiscalYearStartMonth` is not 1. Unknown keys
 * are returned unchanged (the blank key is labelled by the dimension's `blankLabel`).
 */
export function pivotDateLabel(key: string, def: Pick<PivotDateFieldDef, "group" | "fiscalYearStartMonth" | "monthNames">): string {
  const p = parseKey(key, def.group);
  if (!p) return key;
  const fiscal = def.fiscalYearStartMonth !== 1;
  const month = (m: number) => def.monthNames[m - 1] ?? PIVOT_MONTH_NAMES[m - 1]!;
  switch (def.group) {
    case "year":
      return fiscal ? `FY${shortYear(p.y)}` : String(p.y);
    case "quarter":
      return `Q${p.a}`;
    case "month":
      return month(p.a);
    case "yearMonth":
      return `${month(p.a)} ${p.y}`;
    case "yearQuarter":
      return fiscal ? `Q${p.a} FY${shortYear(p.y)}` : `Q${p.a} ${p.y}`;
    case "week":
      return `W${pad2(p.a)} ${p.y}`;
    case "day":
      return `${p.d} ${month(p.a)} ${p.y}`;
  }
}

/**
 * Chronological key order (`""` last): code-unit order for keys that embed the year, fiscal order
 * for months (`fiscalYearStartMonth: 11` → Nov, Dec, Jan, …).
 */
export function pivotDateKeyComparator(def: Pick<PivotDateFieldDef, "group" | "fiscalYearStartMonth">): (a: string, b: string) => number {
  const start = def.fiscalYearStartMonth;
  const rank =
    def.group === "month"
      ? (k: string) => {
          const m = k.length === 2 ? digits(k, 0, 2) : -1;
          return m >= 1 && m <= 12 ? (m - start + 12) % 12 : 99;
        }
      : null;
  return (a, b) => {
    if (a === b) return 0;
    if (a === "") return 1;
    if (b === "") return -1;
    if (rank) {
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
    }
    return a < b ? -1 : 1;
  };
}

/** `[start, end)` day numbers of a period key, `null` for cyclic groups and invalid keys. */
export function pivotDateKeyInterval(key: string, def: Pick<PivotDateFieldDef, "group" | "fiscalYearStartMonth">): [number, number] | null {
  if (!PERIOD_GROUPS.has(def.group)) return null;
  const p = parseKey(key, def.group);
  if (!p) return null;
  const s = def.fiscalYearStartMonth;
  /** Day number of the civil month `index` months after (fiscal year `fy`'s first month). */
  const fiscalMonthStart = (fy: number, offset: number) => {
    const first = s === 1 ? fy * 12 : (fy - 1) * 12 + (s - 1);
    const mm = first + offset;
    return pivotDaysFromCivil(Math.floor(mm / 12), (mm % 12) + 1, 1);
  };
  switch (def.group) {
    case "year":
      return [fiscalMonthStart(p.y, 0), fiscalMonthStart(p.y, 12)];
    case "yearQuarter":
      return [fiscalMonthStart(p.y, (p.a - 1) * 3), fiscalMonthStart(p.y, p.a * 3)];
    case "yearMonth": {
      const start = pivotDaysFromCivil(p.y, p.a, 1);
      return [start, start + daysInMonth(p.y, p.a)];
    }
    case "week": {
      const jan4 = pivotDaysFromCivil(p.y, 1, 4);
      const monday = jan4 - ((((jan4 + 3) % 7) + 7) % 7) + (p.a - 1) * 7;
      return [monday, monday + 7];
    }
    case "day": {
      const day = pivotDaysFromCivil(p.y, p.a, p.d);
      return [day, day + 1];
    }
    default:
      return null;
  }
}

/**
 * Keys to show for `keepEmpty`: every period between the first and last of `seen` (period groups),
 * or every key of a cyclic group (12 months, 4 quarters), chronologically. At most
 * `PIVOT_MAX_DATE_FILL` keys; `seen` is returned unchanged beyond that.
 */
export function pivotDateFillKeys(seen: readonly string[], def: Pick<PivotDateFieldDef, "group" | "fiscalYearStartMonth">): string[] {
  const cmp = pivotDateKeyComparator(def);
  if (def.group === "month") return ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].sort(cmp);
  if (def.group === "quarter") return ["Q1", "Q2", "Q3", "Q4"];
  const valid = seen.filter((k) => pivotDateKeyInterval(k, def) !== null).sort(cmp);
  if (valid.length < 2) return valid;
  const last = pivotDateKeyInterval(valid[valid.length - 1]!, def)![0];
  const out: string[] = [];
  for (let day = pivotDateKeyInterval(valid[0]!, def)![0]; day <= last; ) {
    const key = pivotDateKeyOfDay(day, def.group, def.fiscalYearStartMonth);
    const range = pivotDateKeyInterval(key, def);
    if (!range || out.length >= PIVOT_MAX_DATE_FILL) return valid;
    out.push(key);
    day = range[1];
  }
  return out;
}

/** Civil months (1–12) a key covers: one for months, three for quarters, all for longer periods. */
function monthsOf(key: string, def: Pick<PivotDateFieldDef, "group" | "fiscalYearStartMonth">): Set<number> | null {
  const p = parseKey(key, def.group);
  if (!p) return null;
  if (def.group === "month") return new Set([p.a]);
  if (def.group === "quarter") {
    const first = ((def.fiscalYearStartMonth - 1 + (p.a - 1) * 3) % 12) + 1;
    return new Set([first, (first % 12) + 1, ((first + 1) % 12) + 1]);
  }
  const range = pivotDateKeyInterval(key, def);
  if (!range) return null;
  const out = new Set<number>();
  for (let day = range[0]; day < range[1] && out.size < 12; ) {
    const [y, m] = pivotCivilFromDays(day);
    out.add(m);
    day = pivotDaysFromCivil(y, m, 1) + daysInMonth(y, m);
  }
  return out;
}

/**
 * Can `childKey` (of `child`) occur under `parentKey` (of `parent`)? Used when `keepEmpty` fills
 * a nested date level, so `2026 › Q1 › Jan` gets Jan–Mar but not Apr. Always true unless both
 * fields group the same source with the same fiscal year and offset.
 */
export function pivotDateKeyWithin(parent: PivotDateFieldDef, parentKey: string, child: PivotDateFieldDef, childKey: string): boolean {
  if (
    parent.source !== child.source ||
    parent.fiscalYearStartMonth !== child.fiscalYearStartMonth ||
    parent.timeZoneOffsetMinutes !== child.timeZoneOffsetMinutes ||
    parentKey === "" ||
    childKey === ""
  ) {
    return true;
  }
  const pr = pivotDateKeyInterval(parentKey, parent);
  const cr = pivotDateKeyInterval(childKey, child);
  if (pr && cr) return cr[0] < pr[1] && cr[1] > pr[0];
  const pm = monthsOf(parentKey, parent);
  const cm = monthsOf(childKey, child);
  if (!pm || !cm) return true;
  for (const m of cm) if (pm.has(m)) return true;
  return false;
}
