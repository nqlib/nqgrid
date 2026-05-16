import { useCallback, useMemo, useState } from "react";
import { VirtualSheet } from "@nqlib/nqgrid";

export function SheetVirtualDemo() {
  const [seed] = useState(() => Date.now());

  const getCellValue = useCallback(
    (row: number, col: number) => {
      const v = ((row * 31 + col * 17 + seed) % 997) / 10;
      return v.toFixed(1);
    },
    [seed],
  );

  const columnWidths = useMemo(() => Array.from({ length: 80 }, (_, i) => (i < 2 ? 56 : 72)), []);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Windowed sheet: 4k rows × 80 columns (two frozen). Uses <code className="rounded bg-muted px-1">computeSheetViewport</code>{" "}
        from <code className="rounded bg-muted px-1">@nqlib/nqgrid/sheet</code>.
      </p>
      <VirtualSheet
        rowCount={4000}
        columnCount={80}
        frozenColumnCount={2}
        rowHeight={26}
        columnWidths={columnWidths}
        getCellValue={getCellValue}
      />
    </div>
  );
}
