import { useCallback, useMemo, useState } from "react";

import type { FormatToolbarConfig } from "./types";

export interface UseCellFormatsOptions {
  /** Keys like `rowIdx:colKey` for targeted cells. */
  initialTargets?: ReadonlySet<string>;
}

/**
 * Minimal overlay format map (Bold / Italic / alignment) keyed by cell target id.
 */
export function useCellFormats(options: UseCellFormatsOptions = {}) {
  const [formatTargetKeys, setFormatTargetKeys] = useState<ReadonlySet<string>>(
    () => options.initialTargets ?? new Set(),
  );
  const [activeFormat, setActiveFormat] = useState<FormatToolbarConfig | undefined>();

  const toggleTarget = useCallback((key: string) => {
    setFormatTargetKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const getFormatForCell = useCallback(
    (key: string): FormatToolbarConfig | undefined => {
      if (!formatTargetKeys.has(key)) return undefined;
      return activeFormat;
    },
    [activeFormat, formatTargetKeys],
  );

  const handleBold = useCallback(() => {
    setActiveFormat((f) => ({ ...f, bold: !f?.bold }));
  }, []);

  const handleAlignCenter = useCallback(() => {
    setActiveFormat((f) => ({ ...f, align: "center" }));
  }, []);

  return useMemo(
    () => ({
      formatTargetKeys,
      activeFormat,
      toggleTarget,
      getFormatForCell,
      handleBold,
      handleAlignCenter,
    }),
    [activeFormat, formatTargetKeys, getFormatForCell, handleAlignCenter, handleBold, toggleTarget],
  );
}
