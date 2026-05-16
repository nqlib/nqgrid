import { tableBodyClassFor } from "../styles";
import type { NqgridLibraryConfig } from "./types";

/** `TableBody` class string from `config.styles.tableBodyFill` (default solid). */
export function tableBodyClassFromLibraryConfig(config?: NqgridLibraryConfig): string {
  const fill = config?.styles?.tableBodyFill ?? "solid";
  return tableBodyClassFor(fill);
}
