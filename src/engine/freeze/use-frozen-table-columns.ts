import type { FreezePanesState } from "./freeze-panes";
import type { PinnedLayoutResult } from "../pinning/pinned-layout";
import {
  usePinnedTableColumns,
  type UsePinnedTableColumnsOptions,
} from "../pinning/use-pinned-table-columns";

export type UseFrozenTableColumnsOptions<TData> = UsePinnedTableColumnsOptions<TData> & {
  /** When set, `frozenLeftColumnIds` from freeze state replace `pinnedLeftIds`. */
  freezePanes?: Pick<FreezePanesState, "frozenLeftColumnIds">;
};

/**
 * Freeze-panes alias for {@link usePinnedTableColumns}.
 */
export function useFrozenTableColumns<TData>(
  options: UseFrozenTableColumnsOptions<TData>,
): PinnedLayoutResult {
  const { freezePanes, pinnedLeftIds = [], ...rest } = options;
  const ids = freezePanes?.frozenLeftColumnIds ?? pinnedLeftIds;
  return usePinnedTableColumns({ ...rest, pinnedLeftIds: ids });
}
