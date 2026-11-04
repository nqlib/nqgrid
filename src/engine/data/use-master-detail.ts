import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";

export interface UseMasterDetailOptions<M, D, K> {
  getMasterId: (master: M) => K;
  isExpanded: (master: M) => boolean;
  createDetailRow: (parentId: K) => D;
  isMasterRow: (row: M | D) => row is M;
}

/**
 * Inserts a synthetic detail row after each expanded master row (nqdg-compatible pattern).
 */
export function useMasterDetail<M, D, K>(
  initialMasterRows: M[],
  options: UseMasterDetailOptions<M, D, K>,
): {
  rows: readonly (M | D)[];
  masterRows: M[];
  setMasterRows: Dispatch<SetStateAction<M[]>>;
  onRowsChange: (rows: (M | D)[], data: { indexes: number[] }) => void;
} {
  const { getMasterId, isExpanded, createDetailRow, isMasterRow } = options;
  const [masterRows, setMasterRows] = useState<M[]>(initialMasterRows);

  const rows = useMemo(() => {
    const result: (M | D)[] = [];
    for (const master of masterRows) {
      result.push(master);
      if (isExpanded(master)) {
        result.push(createDetailRow(getMasterId(master)));
      }
    }
    return result;
  }, [masterRows, getMasterId, isExpanded, createDetailRow]);

  const onRowsChange = useCallback(
    (updatedRows: (M | D)[], data: { indexes: number[] }) => {
      if (data.indexes.length === 0) return;
      const idx = data.indexes[0]!;
      const updatedRow = updatedRows[idx];
      if (!isMasterRow(updatedRow)) return;
      const newMasterRows = updatedRows.filter(isMasterRow);
      setMasterRows(newMasterRows);
    },
    [isMasterRow],
  );

  return { rows, masterRows, setMasterRows, onRowsChange };
}
