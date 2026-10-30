import { describe, expect, it } from "vitest";

import { normalizeRichSchemaColumnDef } from "./normalize-rich-schema";
import {
  formatNumberValue,
  getByPath,
  mergeRichDateFormatLocale,
  normalizePercentToHundred,
  richPersonOptionKey,
  formatPercentPlain,
} from "../core/rich-value-format";

describe("getByPath", () => {
  it("reads nested keys", () => {
    expect(getByPath({ a: { b: 3 } }, "a.b")).toBe(3);
  });
  it("returns undefined for missing path", () => {
    expect(getByPath({ a: 1 }, "a.c")).toBeUndefined();
  });
});

describe("richPersonOptionKey", () => {
  it("prefers id", () => {
    expect(richPersonOptionKey({ id: "x", name: "Y" })).toBe("x");
  });

  it("falls back to name", () => {
    expect(richPersonOptionKey({ name: "Ada" })).toBe("Ada");
  });
});

describe("normalizePercentToHundred", () => {
  it("treats ratio scale", () => {
    expect(normalizePercentToHundred(0.5, { valueScale: "ratio" })).toBe(50);
  });
  it("clamps hundred scale", () => {
    expect(normalizePercentToHundred(120, { valueScale: "hundred" })).toBe(100);
    expect(normalizePercentToHundred(-5, { valueScale: "hundred" })).toBe(0);
  });
});

describe("formatPercentPlain", () => {
  it("roundWhole uses suffix", () => {
    const { text } = formatPercentPlain(61.2, { roundWhole: true, suffix: "%" }, "");
    expect(text).toBe("61%");
  });
});

describe("mergeRichDateFormatLocale", () => {
  it("fills preset when missing", () => {
    const m = mergeRichDateFormatLocale(undefined, "en-US");
    expect(m).toEqual({ preset: "dateShort", locale: "en-US" });
  });
});

describe("formatNumberValue unified styles", () => {
  it("formats currency via style metadata", () => {
    const s = formatNumberValue(42.5, { style: "currency", currency: "USD", locale: "en-US" });
    expect(s).toMatch(/\$42\.50/);
  });

  it("formats percent via style metadata", () => {
    const s = formatNumberValue(61, { style: "percent", valueScale: "hundred", roundWhole: true });
    expect(s).toBe("61%");
  });
});

describe("normalizeRichSchemaColumnDef", () => {
  it("maps legacy percent kind to number + format.style", () => {
    const n = normalizeRichSchemaColumnDef({
      id: "p",
      name: "P",
      kind: "percent",
      accessorKey: "progress",
      format: { display: "battery", valueScale: "hundred" },
    });
    expect(n.kind).toBe("number");
    if (n.kind === "number") {
      expect(n.format?.style).toBe("percent");
      expect(n.format?.percentDisplay).toBe("battery");
    }
  });
});
