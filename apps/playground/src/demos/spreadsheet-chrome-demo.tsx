import { useState } from "react";
import { Button } from "@nqlib/nqui";
import { matrixToTsv, useCellFormats, useSpreadsheetCommands } from "@nqlib/nqgrid";

export function SpreadsheetChromeDemo() {
  const [log, setLog] = useState<string[]>([]);
  const push = (m: string) => setLog((l) => [m, ...l].slice(0, 6));

  const commands = useSpreadsheetCommands({
    onExportCsv: () => push("export csv"),
    onExportPdf: () => push("export pdf"),
    onCopy: () => push(`copy: ${matrixToTsv([["a", "b"], ["1", "2"]])}`),
    onPaste: () => push("paste"),
  });

  const formats = useCellFormats();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Headless <code className="rounded bg-muted px-1">useSpreadsheetCommands</code> +{" "}
        <code className="rounded bg-muted px-1">useCellFormats</code> — compose menus/toolbars with nqui.
      </p>
      <div className="flex flex-wrap gap-2">
        {commands.map((c) => (
          <Button key={c.id} type="button" size="sm" variant="secondary" disabled={c.disabled} onClick={() => c.onExecute?.()}>
            {c.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={formats.handleBold}>
          Toggle bold format
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Active format: {JSON.stringify(formats.activeFormat ?? {})}</p>
      <ul className="text-xs text-muted-foreground">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
