import { useMemo } from "react";

import { COMMAND_IDS } from "./commands";
import type { SpreadsheetCommand } from "./types";

export interface UseSpreadsheetCommandsOptions {
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
}

/**
 * Headless command list for spreadsheet chrome (menus / toolbars compose UI).
 */
export function useSpreadsheetCommands(options: UseSpreadsheetCommandsOptions = {}): readonly SpreadsheetCommand[] {
  const { onExportCsv, onExportPdf, onCopy, onPaste } = options;
  return useMemo(
    () => [
      {
        id: COMMAND_IDS.EXPORT_CSV,
        label: "Export CSV",
        disabled: !onExportCsv,
        onExecute: onExportCsv,
      },
      {
        id: COMMAND_IDS.EXPORT_PDF,
        label: "Export PDF",
        disabled: !onExportPdf,
        onExecute: onExportPdf,
      },
      {
        id: COMMAND_IDS.COPY,
        label: "Copy",
        disabled: !onCopy,
        onExecute: onCopy,
      },
      {
        id: COMMAND_IDS.PASTE,
        label: "Paste",
        disabled: !onPaste,
        onExecute: onPaste,
      },
    ],
    [onExportCsv, onExportPdf, onCopy, onPaste],
  );
}
