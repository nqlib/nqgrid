import { describe, expect, it } from "vitest";

import { formatPivotNumber, roundHalfAway, toExcelNumFmt, toPivotNumber } from "./format";

const usdCompact = { style: "currency", currency: "USD", compact: true } as const;

describe("formatPivotNumber", () => {
  it("compacts currency with 3 significant digits", () => {
    expect(formatPivotNumber(302_400, usdCompact)).toBe("$302k");
    expect(formatPivotNumber(4_760_000, usdCompact)).toBe("$4.76M");
    expect(formatPivotNumber(14_620_000, usdCompact)).toBe("$14.6M");
    expect(formatPivotNumber(53_700_000, usdCompact)).toBe("$53.7M");
    expect(formatPivotNumber(89_000, usdCompact)).toBe("$89k");
    expect(formatPivotNumber(950, usdCompact)).toBe("$950");
    expect(formatPivotNumber(-1_250_000, usdCompact)).toBe("-$1.25M");
  });

  it("bumps to the next unit when rounding reaches 1000", () => {
    expect(formatPivotNumber(999_960, usdCompact)).toBe("$1M");
    expect(formatPivotNumber(999_996, { ...usdCompact, decimals: 2 })).toBe("$1.00M");
    expect(formatPivotNumber(999_960, { ...usdCompact, decimals: 2 })).toBe("$999.96k");
  });

  it("formats percent ratios with sign display", () => {
    expect(formatPivotNumber(0.24, { style: "percent" })).toBe("24%");
    expect(formatPivotNumber(-0.013, { style: "percent", decimals: 1 })).toBe("-1.3%");
    expect(formatPivotNumber(0.055, { style: "percent", decimals: 1, signDisplay: "exceptZero" })).toBe("+5.5%");
    expect(formatPivotNumber(0, { style: "percent", signDisplay: "exceptZero" })).toBe("0%");
    expect(formatPivotNumber(-0.0001, { style: "percent" })).toBe("0%");
  });

  it("groups thousands, trims decimal style, honors separators and parentheses", () => {
    expect(formatPivotNumber(1234567.891)).toBe("1,234,567.89");
    expect(formatPivotNumber(3)).toBe("3");
    expect(formatPivotNumber(1234.5, { decimals: 2, groupSeparator: ".", decimalSeparator: "," })).toBe("1.234,50");
    expect(formatPivotNumber(-42, { style: "currency", currency: "EUR", negative: "parentheses" })).toBe("(€42)");
    expect(formatPivotNumber(7, { suffix: " h", prefix: "~" })).toBe("~7 h");
    expect(formatPivotNumber(5, { style: "currency", currency: "XYZ" })).toBe("XYZ 5");
  });

  it("prints empty for non-numbers and accepts numeric strings", () => {
    expect(formatPivotNumber(null, { empty: "—" })).toBe("—");
    expect(formatPivotNumber("abc")).toBe("");
    expect(formatPivotNumber("1500.5", { decimals: 1 })).toBe("1,500.5");
  });
});

describe("helpers", () => {
  it("roundHalfAway is symmetric and stable", () => {
    expect(roundHalfAway(1.005, 2)).toBe(1.01);
    expect(roundHalfAway(-2.5, 0)).toBe(-3);
    expect(roundHalfAway(2.5, 0)).toBe(3);
  });

  it("toPivotNumber", () => {
    expect(toPivotNumber(3)).toBe(3);
    expect(toPivotNumber(" 4 ")).toBe(4);
    expect(toPivotNumber("")).toBeNull();
    expect(toPivotNumber(Number.NaN)).toBeNull();
    expect(toPivotNumber(true)).toBeNull();
  });
});

describe("toExcelNumFmt", () => {
  it("maps common formats", () => {
    expect(toExcelNumFmt({ style: "percent" })).toBe("#,##0%");
    expect(toExcelNumFmt({ style: "percent", decimals: 1, signDisplay: "exceptZero" })).toBe(
      "+#,##0.0%;-#,##0.0%;#,##0.0%",
    );
    expect(toExcelNumFmt({ style: "currency", currency: "USD" })).toBe('"$"#,##0');
    expect(toExcelNumFmt({ decimals: 2, negative: "parentheses" })).toBe("#,##0.00;(#,##0.00)");
    expect(toExcelNumFmt(usdCompact)).toBe('[>=1000000]"$"#,##0.0,,"M";[>=1000]"$"#,##0,"k";"$"#,##0');
  });
});
