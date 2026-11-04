/** Tab-separated matrix for spreadsheet-style clipboard round-trips. */

export function matrixToTsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(escapeCell).join("\t")).join("\n");
}

/**
 * Parse TSV as Excel / Google Sheets put it on the clipboard. Quotes are handled
 * across line breaks (a quoted cell may contain newlines and tabs), CRLF and CR
 * line endings are accepted, and the trailing newline Excel appends does not
 * produce an extra empty row.
 */
export function tsvToMatrix(tsv: string): string[][] {
  const text = tsv.replace(/\r\n?/g, "\n");
  if (!text.trim()) return [];
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === "\t") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (ch === '"' && cur === "") {
      // A quote only opens a quoted field when it is the first character of the
      // field. A quote mid-cell (e.g. an inch mark `5"`) is a literal character.
      inQuotes = true;
    } else {
      cur += ch;
    }
  }
  // No trailing newline: flush the last row. With one, the loop already did,
  // and an empty final line is Excel's terminator, not data.
  if (cur !== "" || row.length > 0 || !text.endsWith("\n")) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function matrixToHtml(rows: readonly (readonly string[])[]): string {
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table>${body}</table>`;
}

function escapeCell(value: string): string {
  // Quote when the cell contains a delimiter/newline, OR when it starts with a
  // quote — splitTsvLine treats a leading `"` as a quoted-field opener, so an
  // unquoted leading-quote cell would be mis-parsed (columns merged / quote
  // dropped) on the round-trip.
  if (
    value.includes("\t") ||
    value.includes("\n") ||
    value.includes("\r") ||
    value.startsWith('"')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
