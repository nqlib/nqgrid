/** Tab-separated matrix for spreadsheet-style clipboard round-trips. */

export function matrixToTsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(escapeCell).join("\t")).join("\n");
}

export function tsvToMatrix(tsv: string): string[][] {
  const text = tsv.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!text.trim()) return [];
  return text.split("\n").map((line) => splitTsvLine(line));
}

function escapeCell(value: string): string {
  if (value.includes("\t") || value.includes("\n") || value.includes("\r")) {
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
    } else if (ch === '"') {
      inQuotes = true;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
