import { useMemo, useState } from "react";
import { Button } from "@nqlib/nqui";
import { pivotExportFilename, type PivotExportFormat, type PivotExportRequest } from "@nqlib/nqgrid/core";
import { pivotExportRequestFromGrid, type PivotGridState } from "@nqlib/nqgrid/pivot";
import { renderPivotHtml, type PivotStaticProfile } from "@nqlib/nqgrid/render-static";
import { ToolChoice } from "../tool-controls";
import { CodeBlock, CopyButton } from "./code-block";

/**
 * Base URL of an `nqgrid-export serve` (or a backend proxying it). In dev,
 * `VITE_NQGRID_EXPORT_URL=/nqgrid-export` goes through the Vite proxy (`NQGRID_EXPORT_PROXY_TARGET`,
 * default http://127.0.0.1:8787), which avoids CORS (`serve` sends no CORS headers by design).
 */
const EXPORT_URL: string | undefined = (import.meta.env.VITE_NQGRID_EXPORT_URL as string | undefined)?.replace(/\/$/, "") || undefined;

const SERVE_STEPS = `pnpm --filter @nqlib/nqgrid-export build
npx playwright install chromium        # once, for PDF
node packages/nqgrid-export/dist/cli.js serve --port 8787
VITE_NQGRID_EXPORT_URL=/nqgrid-export pnpm --filter nqgrid-playground dev`;

/** Fixed so the request and the preview are stable while you look at them (the exporter never reads the clock). */
const utcStamp = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** POST the request (rows included: nqgrid-export has no data of its own) and download the file. */
async function postExport(baseUrl: string, request: PivotExportRequest, format: PivotExportFormat) {
  const res = await fetch(`${baseUrl}/export?format=${format}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; details?: string[] } } | null;
    const details = body?.error?.details?.length ? `: ${body.error.details.join("; ")}` : "";
    throw new Error(`${body?.error?.message ?? `HTTP ${res.status}`}${details}`);
  }
  downloadBlob(await res.blob(), pivotExportFilename(request.spec, format));
}

/**
 * "Export what I see": the request a desktop app sends its backend (the spec, view state included, plus a
 * dataset reference), a static HTML preview from `renderPivotHtml`, and PDF / XLSX through nqgrid-export.
 */
export function ExportPanel({ grid, theme }: { grid: PivotGridState; theme: "light" | "dark" }) {
  const [profile, setProfile] = useState<PivotStaticProfile>(() => (grid.spec.layout === "compact" ? "statement" : "report"));
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const generatedAt = useMemo(() => utcStamp(new Date()), []);
  const options = useMemo(() => ({ theme, profile, generatedAt }), [theme, profile, generatedAt]);
  const request = useMemo(() => pivotExportRequestFromGrid(grid, { format: "pdf", options }), [grid, options]);
  const json = useMemo(() => JSON.stringify(request, null, 2), [request]);
  const html = useMemo(() => renderPivotHtml(grid.model, options), [grid.model, options]);

  const download = async (format: PivotExportFormat) => {
    if (!EXPORT_URL) return;
    setBusy(true);
    setStatus(`Exporting ${format.toUpperCase()}…`);
    try {
      await postExport(EXPORT_URL, pivotExportRequestFromGrid(grid, { format, includeRows: true, options }), format);
      setStatus(`Downloaded ${pivotExportFilename(request.spec, format)}`);
    } catch (error) {
      setStatus(`Export failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToolChoice<PivotStaticProfile>
          label="Print profile"
          value={profile}
          options={[
            { value: "report", label: "Report" },
            { value: "statement", label: "Statement" },
          ]}
          onValueChange={setProfile}
        />
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={json} label="Copy request" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadBlob(new Blob([html], { type: "text/html" }), pivotExportFilename(request.spec, "html"))}
          >
            Download HTML
          </Button>
          {EXPORT_URL ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => void download("pdf")}>
                Download PDF
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void download("xlsx")}>
                Download XLSX
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {status ?? (EXPORT_URL ? `PDF and XLSX come from nqgrid-export at ${EXPORT_URL}.` : "PDF and XLSX need nqgrid-export serve. Start it from the repo root:")}
      </p>
      {EXPORT_URL ? null : <CodeBlock code={SERVE_STEPS} label="How to run nqgrid-export serve" className="h-auto" />}
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-medium">Export request</span>
          <CodeBlock code={json} label="Export request (JSON)" className="h-[28rem]" />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-medium">Static preview (renderPivotHtml)</span>
          <iframe
            title={`Static ${profile} preview of ${grid.model.title ?? "the pivot"}`}
            srcDoc={html}
            sandbox=""
            className="h-[28rem] w-full rounded-lg border border-border/70 bg-background"
          />
        </div>
      </div>
    </div>
  );
}
