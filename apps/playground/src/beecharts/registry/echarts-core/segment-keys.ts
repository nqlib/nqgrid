/** Config keys for pie / polar slices derived from tabular `data` + `nameKey`. */
export function segmentKeysFromData(
  data: readonly Record<string, unknown>[],
  nameKey: string,
): string[] {
  return data
    .map((row) => String(row[nameKey] ?? ""))
    .filter((key) => key.length > 0);
}
