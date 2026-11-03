# Secolab integration (Phase 4)

How Secolab, a Tauri app with a Python backend whose agents work through MCP and email reports, uses nqgrid
for pivot reports. Everything here is a **drop-in reference** tested in this repo against the real exporter.
Secolab copies or depends on it:

| Piece | Where | Use in Secolab |
|-------|-------|----------------|
| Export request contract | [`contract/pivot/v1/export-request.schema.json`](../../contract/pivot/v1/export-request.schema.json) (+ `pivot-spec.schema.json`, golden `examples/planning.request.json`) | The wire format between the app, the backend and the exporter |
| TS builders | `buildPivotExportRequest` (`@nqlib/nqgrid/core`), `pivotExportRequestFromGrid` (`@nqlib/nqgrid/pivot`) | Tauri Export button |
| Exporter service | [`packages/nqgrid-export`](../../packages/nqgrid-export/README.md) (CLI, `serve`, Dockerfile) | Sidecar next to the backend |
| Python package | [`integrations/python`](../../integrations/python/README.md) (`nqgrid-export-client`, import `nqgrid_export`) | Backend client, Pydantic models, MCP tool, email, openpyxl writer |

## Architecture

```
 Tauri app (nqgrid pivot)                 Python backend                         nqgrid-export sidecar
 ┌──────────────────────┐  spec + dataset  ┌────────────────────────────────┐  spec + rows  ┌──────────────────────┐
 │ usePivotGrid → spec  │ ───────────────► │ /reports/export (HTTP/invoke)  │ ────────────► │ POST /export?format= │
 │ "Export" button      │ ◄─────────────── │   RowProvider: dataset → rows  │ ◄──────────── │ PDF (Chromium) /     │
 └──────────────────────┘     PDF / XLSX   │                                │   file bytes  │ XLSX / model / sheet │
                                           │ MCP server (agents)            │               └──────────────────────┘
 LLM agent ── MCP ───────────────────────► │   describe_pivot_spec          │
   (writes a PivotSpec)                    │   export_pivot_report ─► save ─┼──► EmailSender ──► SMTP ──► inbox (PDF attached)
                                           └────────────────────────────────┘
```

- **The backend owns the data.** The app sends the spec it is showing (expanded groups, heat scope, … live in the
  spec) and a `dataset` reference, not the rows (`pivotExportRequestFromGrid` defaults to `includeRows: false`).
  The backend loads rows at the pivot's leaf grain, checks the user may see them, and calls the exporter.
- **One renderer.** Grouping, totals, "% of total", heat levels, number formats and layout come from
  `@nqlib/nqgrid/core` in the app and in the sidecar, so the emailed PDF matches the screen. Python never
  re-implements pivot logic; it builds specs, loads rows and moves files.
- **Agents author specs.** `describe_pivot_spec` returns the JSON Schema, an authoring guide, an example and the
  datasets with their fields. `export_pivot_report` validates everything and returns `validation_errors` the agent
  fixes and retries with. It never raises for bad input.

## The contract

```jsonc
// export-request.schema.json (draft 2020-12)
{
  "spec": { "version": 1, "rows": [...], "measures": [...] },  // $ref pivot-spec.schema.json
  "dataset": "planning-fy26",            // app → backend: the backend resolves it to rows
  "rows": [{ "department": "Camp", ... }], // backend → nqgrid-export (required there)
  "format": "pdf",                       // pdf | xlsx | html | model | sheet (?format= wins)
  "options": {                           // JSON-only render options; css / html are rejected
    "theme": "light", "page": { "size": "A4", "orientation": "landscape" },
    "title": "FY26 Sales Plan", "generatedAt": "2026-10-30 09:00 UTC", "maxColumnsPerPage": 6, "kpiPanel": true
  }
}
```

Contract tests run on both sides against `contract/pivot/v1/examples`: TS (ajv, `src/core/pivot/export-request.test.ts`,
`packages/nqgrid-export/test/contract.test.ts`, where the schema and the CLI validator must agree) and Python
(`jsonschema` + Pydantic, and `format=model` / `format=sheet` from the real service must equal `planning.model.json` /
`planning.sheet.json`).

## Deployment options

| Option | How | Good for | Notes |
|--------|-----|----------|-------|
| **Docker sidecar** (recommended for servers) | `docker build -f packages/nqgrid-export/Dockerfile -t nqgrid-export .`, then run it next to the backend | Production backends | Pinned Playwright + Chromium + fonts, non-root `pwuser`, `/healthz` health check. Publish only on loopback or an internal network. |
| **`serve` on localhost** | `nqgrid-export serve --port 8787` (systemd, supervisor, or a process the backend spawns) | Dev machines, single-host installs, a desktop backend | Needs Node ≥ 20, `playwright` and its Chromium (`npx playwright install chromium`). Binds to 127.0.0.1 by default. |
| **One-shot subprocess** | `SubprocessExporter()` runs `nqgrid-export --input - --out -` per report | Cron / batch reports, very low volume | No service to run, but ~1 s Chromium launch per PDF. Same exceptions as HTTP. |

```yaml
# docker-compose.yml (sketch)
services:
  backend:
    build: ./backend
    environment:
      NQGRID_EXPORT_URL: http://nqgrid-export:8787
  nqgrid-export:
    image: nqgrid-export:0.1.0
    command: ["serve", "--host", "0.0.0.0", "--port", "8787", "--max-body-mb", "10", "--concurrency", "2"]
    expose: ["8787"]           # internal network only, no "ports:" mapping
    read_only: true
    tmpfs: [/tmp]
```

If the Python backend ships inside the Tauri bundle (a local sidecar), run `serve` on 127.0.0.1 as a second
sidecar process, or use `SubprocessExporter` with the bundled Node and `NQGRID_EXPORT_BIN`.

## Security

- **Bind to localhost / an internal network.** `serve` has no authentication by design; it defaults to `127.0.0.1`.
  Use `--host 0.0.0.0` only inside a container whose port is not published (or published as `127.0.0.1:8787:8787`).
  It sends no CORS headers, so browsers cannot call it cross-origin. The app goes through the backend.
- **Cap bodies.** `--max-body-mb` (default 10) on the service; `PivotReportService(max_rows=…, max_request_mb=…)` in
  Python (keep `max_request_mb` below the service cap). The backend should aggregate to the leaf grain first. A pivot
  never needs raw transactions.
- **No raw HTML / CSS from agents or users.** The schema has no `css` / `html` options, the CLI rejects `options.css`,
  `buildPivotExportRequest` / `sanitizePivotExportOptions` drop unknown keys, and `export_pivot_report` validates options
  against the schema. PDFs render with JavaScript disabled and all network requests blocked.
- **Data access stays in the backend.** `dataset` is an opaque id resolved by Secolab's `RowProvider`. Check that the
  calling user or agent may read it there. `JsonDirectoryRowProvider` shows the pattern: an id allow-list
  (`[A-Za-z0-9_.-]`) and no path traversal.
- **Email.** Restrict recipients (`allowed_recipient_domains`) so an agent cannot mail data out of the organisation.
  Subjects and filenames must be single lines (no header injection). Bodies are plain text. SMTP uses STARTTLS / TLS
  with certificate verification. Keep credentials in env / a secret store (`NQGRID_SMTP_*`).
- **Spreadsheet formulas.** The openpyxl writer stores strings starting with `=` as text (exceljs does the same).

### Timeouts

| Hop | Timeout |
|-----|---------|
| Python → `serve` connect | 5 s (`NqgridExportClient`) |
| Python → `serve` export | 60 s (`NqgridExportClient(timeout=60)`); the planning example renders well under a second with a warm browser |
| `serve` request | 120 s (`server.requestTimeout`) |
| One-shot subprocess | 120 s (`SubprocessExporter(timeout=120)`), Chromium launch included |
| Tauri → backend | 90 s (above the export timeout, so the backend's error reaches the UI) |
| SMTP | 30 s (`NQGRID_SMTP_TIMEOUT`) |

Treat `NqgridUnavailable` (connection / timeout) as retryable with backoff. Never retry `NqgridInvalidInput`:
return its `details` to the user or agent.

## Backend endpoint for the app (sketch)

The Tauri Export button posts `{ spec, dataset, format, options }`. A FastAPI version:

```python
from fastapi import FastAPI, HTTPException, Response
from nqgrid_export import NqgridExportClient, NqgridInvalidInput, export_filename, validate_export_request
from nqgrid_export.formats import CONTENT_TYPES

app, client = FastAPI(), NqgridExportClient()            # $NQGRID_EXPORT_URL

@app.post("/reports/export")
def export_report(body: dict, format: str = "pdf") -> Response:
    if format not in ("pdf", "xlsx") or (errors := validate_export_request(body)):
        raise HTTPException(400, {"errors": errors or ["format must be pdf or xlsx"]})
    rows = secolab_rows.get_rows(body["dataset"])          # + authorization for the current user
    try:
        data = client.export(body["spec"], rows, format, body.get("options"))
    except NqgridInvalidInput as e:
        raise HTTPException(400, {"errors": e.details or [e.message]}) from e
    name = export_filename(body["spec"], format)
    return Response(data, media_type=CONTENT_TYPES[format], headers={"content-disposition": f'attachment; filename="{name}"'})
```

To email from the app instead ("send me this report"), call `PivotReportService.export_pivot_report(spec, dataset=…,
email_to=[user.email])`, the same code path the MCP tool uses.

## Tauri: Export button

TypeScript (React), building the request with nqgrid:

```tsx
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { pivotExportFilename } from "@nqlib/nqgrid";
import { pivotExportRequestFromGrid, type PivotGridState } from "@nqlib/nqgrid/pivot";

export function ExportButton({ grid, format = "pdf" }: { grid: PivotGridState; format?: "pdf" | "xlsx" }) {
  const onClick = async () => {
    // Spec as on screen (expanded groups, heat scope) + dataset reference; the backend loads the rows.
    const request = pivotExportRequestFromGrid(grid, {
      format,
      dataset: "planning-fy26",                 // default: spec.id
      options: { theme: "light", generatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC" },
    });
    const bytes = await invoke<ArrayBuffer>("export_pivot_report", { request, format });
    const path = await save({ defaultPath: pivotExportFilename(request.spec, format) });
    if (path) await writeFile(path, new Uint8Array(bytes));
  };
  return <button onClick={() => void onClick()}>Export {format.toUpperCase()}</button>;
}
```

Rust command (Tauri 2) forwarding to the Python backend. Rust's HTTP client is not subject to webview CORS, and the
backend URL / token stay out of the frontend:

```rust
use std::time::Duration;

#[tauri::command]
async fn export_pivot_report(request: serde_json::Value, format: String) -> Result<tauri::ipc::Response, String> {
    if format != "pdf" && format != "xlsx" {
        return Err("format must be pdf or xlsx".into());
    }
    let backend = std::env::var("SECOLAB_BACKEND_URL").unwrap_or_else(|_| "http://127.0.0.1:8000".into());
    let res = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?
        .post(format!("{backend}/reports/export"))
        .query(&[("format", &format)])
        .json(&request)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(res.text().await.unwrap_or_else(|_| "export failed".into())); // {"detail": {"errors": [...]}}
    }
    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes.to_vec())) // arrives as an ArrayBuffer
}
// .invoke_handler(tauri::generate_handler![export_pivot_report])
```

Without a Rust command, `fetch` from the webview to the Python backend works too, if the backend allows the Tauri
origin (`tauri://localhost`, `http://tauri.localhost` on Windows) via CORS, or via `@tauri-apps/plugin-http`
with the backend URL in its capability scope. The playground's Planning pivot demo shows the request JSON and,
with `VITE_NQGRID_EXPORT_URL` set, downloads the PDF / XLSX through a dev proxy.

## Adopting it in Secolab (checklist for when the code is shared)

1. **Pick the deployment.** Docker sidecar on the backend host, or `serve` on localhost for desktop / dev. Add a
   `/healthz` check to Secolab's readiness probe (`NqgridExportClient().health()["browser"] == "ready"`).
2. **Add the Python package.** Depend on `nqgrid-export-client[xlsx,mcp]` (git subdirectory) or vendor
   `integrations/python/src/nqgrid_export`. Match Secolab's `mcp` major (1.x `FastMCP` and 2.x `MCPServer` both work)
   and its httpx / pydantic versions.
3. **Implement `RowProvider`** (and optionally `DatasetCatalog.list_datasets()` with field names) against Secolab's data
   layer: dataset id → leaf-grain rows, with authorization. Raise `UnknownDatasetError` for unknown ids.
4. **Wire email.** Wrap Secolab's existing mailer in an `EmailSender` (`send(EmailMessage)`), or use
   `SmtpEmailSender.from_env()`. Set `allowed_recipient_domains`.
5. **Register the tools.** Either run `create_mcp_server(service)` as its own MCP server, or register
   `service.export_pivot_report` / `service.describe_pivot_spec` on Secolab's existing MCP server with the same
   signatures (copy the two `@server.tool` wrappers from `mcp_tool.py`).
6. **Map Secolab's report definitions to PivotSpecs.** Start from `contract/pivot/v1/examples/planning.spec.json`, and
   keep specs as JSON next to their dataset so the app and agents share them.
7. **App side.** Use `usePivotGrid(spec, rows)` + `PivotTable`; the Export button sends
   `pivotExportRequestFromGrid(grid, { format })` through a Tauri command (above) to the backend endpoint.
8. **Tests.** Copy `integrations/python/tests/conftest.py` (`export_service` fixture) and add a contract test per
   Secolab report: its spec validates, and `format=model` of a fixed row set matches a committed golden file.
9. **CI.** Build the exporter (or pull the image), install Chromium, run the Python tests (see
   [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)).
10. **Ops.** Size `--concurrency` to the host's CPUs / memory (each PDF is a Chromium page). Log the one-line JSON
    request logs from `serve`. Alert on `NqgridUnavailable`.

Open questions to settle with the Secolab code: how datasets are named and authorized, whether reports are stored
(`output_dir`) or only emailed, which MCP SDK version and transport the backend uses, and whether the Tauri app
talks to the backend through Rust commands or HTTP.
