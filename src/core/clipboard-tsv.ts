/** Tab-separated matrix for spreadsheet-style clipboard round-trips. */

export function matrixToTsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(escapeCell).join("\t")).join("\n");
}

export function tsvToMatrix(tsv: string): string[][] {
  const text = tsv.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!text.trim()) return [];
  return text.split("\n").map((line) => splitTsvLine(line));
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

function splitTsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === "\t") {
      out.push(cur);
      cur = "";
    } else if (ch === '"' && cur === "") {
      // A quote only opens a quoted field when it is the first character of the
      // field. A quote mid-cell (e.g. an inch mark `5"`) is a literal character.
      inQuotes = true;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
