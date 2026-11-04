import type { ColumnType } from "../contract";

/** Plain text. compareKey is a case-folded string so sort is locale-friendly. */
export const textType: ColumnType<unknown, string> = {
  name: "text",
  parse(raw) {
    if (raw == null) return "";
    return String(raw);
  },
  format(parsed) {
    return parsed;
  },
  style(parsed) {
    return parsed.length === 0 ? { muted: true } : {};
  },
  compareKey(parsed) {
    return parsed.toLowerCase();
  },
  editor() {
    return { control: "text" };
  },
};
