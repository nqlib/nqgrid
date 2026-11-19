import type { PivotDesignChangeInfo, PivotTableDesign } from "./design";
import { PIVOT_DEFAULT_COMPACT_WIDTH, PIVOT_DEFAULT_DIMENSION_WIDTHS } from "./layout";
import type { PivotTableProps } from "./pivot-table";

/** The `PivotTable` props `pivotDesignProps` sets. */
export type PivotDesignProps = Pick<
  PivotTableProps,
  | "valueWidth"
  | "valueWidths"
  | "measureWidths"
  | "dimensionWidths"
  | "rowHeight"
  | "headRowHeight"
  | "measureOrder"
  | "freezeHeader"
  | "freezeDimensions"
  | "bandedRows"
  | "heat"
  | "bars"
  | "measureLayout"
  | "numberFormats"
  | "onValueWidthChange"
  | "onMeasureWidthChange"
  | "onDimensionWidthChange"
  | "onRowHeightChange"
  | "onMeasureOrderChange"
>;

export interface PivotDesignPropsOptions {
  /**
   * What a column resize handle sets: `column` (default) one column (`valueWidths`), `measure` every
   * column of its measure (`measureWidths`).
   */
  readonly widthScope?: "column" | "measure";
  /** `compact` when the model uses the compact layout (its one label column defaults to 260 px). */
  readonly layout?: "tabular" | "compact";
}

/**
 * A stored `PivotTableDesign` as `PivotTable` props, plus (with `onDesignChange`) the callbacks that
 * return the next design: `<PivotTable model={m} {...pivotDesignProps(design, save)} />`. Pure: the
 * host keeps the design (state, chart params, a database row). Save it when `info.final` is true;
 * the `final: false` calls only keep a dragged edge under the pointer.
 */
export function pivotDesignProps(
  design: PivotTableDesign,
  onDesignChange?: (next: PivotTableDesign, info: PivotDesignChangeInfo) => void,
  options: PivotDesignPropsOptions = {},
): PivotDesignProps {
  const props: Record<string, unknown> = {};
  for (const key of [
    "valueWidth",
    "valueWidths",
    "measureWidths",
    "dimensionWidths",
    "rowHeight",
    "headRowHeight",
    "measureOrder",
    "freezeHeader",
    "freezeDimensions",
    "bandedRows",
    "heat",
    "bars",
    "measureLayout",
    "numberFormats",
  ] as const) {
    if (design[key] !== undefined) props[key] = design[key];
  }
  if (!onDesignChange) return props as PivotDesignProps;
  const emit = (next: PivotTableDesign, change: PivotDesignChangeInfo["change"], final: boolean) =>
    onDesignChange({ version: 1, ...next }, { change, final });
  if (options.widthScope === "measure") {
    props.onMeasureWidthChange = ((measureId, width, info) =>
      emit({ ...design, measureWidths: { ...design.measureWidths, [measureId]: width } }, "measureWidth", info.final)) satisfies PivotDesignProps["onMeasureWidthChange"];
  } else {
    props.onValueWidthChange = ((key, width, info) =>
      emit({ ...design, valueWidths: { ...design.valueWidths, [key]: width } }, "valueWidth", info.final)) satisfies PivotDesignProps["onValueWidthChange"];
  }
  props.onDimensionWidthChange = ((index, width, info) => {
    // Fill the columns before `index` with their defaults, so the stored array has no holes.
    const defaults = options.layout === "compact" ? [PIVOT_DEFAULT_COMPACT_WIDTH] : PIVOT_DEFAULT_DIMENSION_WIDTHS;
    const widths = Array.from({ length: Math.max(index + 1, design.dimensionWidths?.length ?? 0) }, (_, i) =>
      i === index ? width : (design.dimensionWidths?.[i] ?? defaults[i] ?? defaults[defaults.length - 1]!),
    );
    emit({ ...design, dimensionWidths: widths }, "dimensionWidth", info.final);
  }) satisfies PivotDesignProps["onDimensionWidthChange"];
  props.onRowHeightChange = ((rowHeight, info) => emit({ ...design, rowHeight }, "rowHeight", info.final)) satisfies PivotDesignProps["onRowHeightChange"];
  props.onMeasureOrderChange = ((measureOrder) => emit({ ...design, measureOrder }, "measureOrder", true)) satisfies PivotDesignProps["onMeasureOrderChange"];
  return props as PivotDesignProps;
}
