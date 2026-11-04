/** Pure TSV / HTML matrix helpers live in `src/core/clipboard-tsv.ts` (framework-free). */
export * from "../../core/clipboard-tsv";

import { matrixToHtml, matrixToTsv } from "../../core/clipboard-tsv";

/**
 * Write a 2-D matrix to the clipboard.
 * Writes both text/plain (TSV) and text/html simultaneously where the
 * Clipboard API supports multi-format writes; falls back to TSV-only.
 */
export async function copyMatrixToClipboard(rows: readonly (readonly string[])[]): Promise<boolean> {
  if (rows.length === 0) return false;
  const tsv = matrixToTsv(rows);
  const html = matrixToHtml(rows);
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([tsv], { type: 'text/plain' }),
      }),
    ]);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(tsv);
      return true;
    } catch {
      return false;
    }
  }
}
