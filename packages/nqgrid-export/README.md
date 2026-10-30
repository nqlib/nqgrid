# @nqlib/nqgrid-export

Export nqgrid pivots — a `PivotSpec` plus leaf-grain rows — to **PDF** (Playwright Chromium), **XLSX**
(exceljs), standalone **HTML**, or the computed **model** / **sheet** JSON. The numbers, formatting and
layout come from `@nqlib/nqgrid/core` and `@nqlib/nqgrid/render-static`, so the file matches the grid the
user sees in the app. Use it as a CLI, a Node API, or a small HTTP service.

## Request

```jsonc
{
  "spec": { "version": 1, "rows": [/* … */], "measures": [/* … */] }, // PivotSpec (contract/pivot/v1)
  "rows": [{ "department": "Camp", "line": "Tents", "month": "Nov", "actual": 297000 }],
  "options": {                     // all optional
    "theme": "light",              // "light" | "dark"
    "page": { "size": "A4", "orientation": "landscape", "margins": { "top": 16, "right": 10, "bottom": 14, "left": 10 } }, // mm
    "title": "FY26 Sales Plan",    // default spec.title; null hides the report header
    "subtitle": "Actuals",
    "generatedAt": "2026-10-30 09:00 UTC", // printed verbatim (the exporter never reads the clock)
    "maxColumnsPerPage": 6,        // default: fit the page at minScale, else balanced column chunks
    "minScale": 0.7,
    "kpiPanel": true,              // department KPI side panels
    "headerFooter": true,          // PDF running header (title) + footer (generated · Page X of Y)
    "locale": { "lang": "de", "page": "Seite", "of": "von", "continued": "(Forts.)", "columns": "Spalten", "generated": "Erstellt" },
    "table": { "dimensionWidths": [184, 152], "valueWidth": 76, "rowHeight": 36, "headerChart": true }
  }
}
```

Specs are validated with `validatePivotSpec`; custom aggregators and `options.css` are rejected (they cannot
cross JSON). Every problem is reported at once.

The request is specified by [`contract/pivot/v1/export-request.schema.json`](../../contract/pivot/v1/export-request.schema.json)
(build it with `buildPivotExportRequest` from `@nqlib/nqgrid/core`). A `dataset` field is ignored here (it is the
app → backend reference); Python callers use [`integrations/python`](../../integrations/python/README.md).

## CLI

```bash
nqgrid-export --input req.json --format pdf --out report.pdf
cat req.json | nqgrid-export --input - --format xlsx --out - > report.xlsx
nqgrid-export --spec spec.json --rows rows.json [--options options.json] --out report.html   # format from extension
nqgrid-export --input req.json -f pdf --theme dark --page-size Letter --orientation portrait --max-columns 6 \
  --title "FY26 Sales Plan" --generated-at "2026-10-30 09:00 UTC" --out report.pdf
nqgrid-export --input req.json -f model    # buildPivotModel JSON (same as contract/pivot/v1/examples/*.model.json)
nqgrid-export --input req.json -f sheet    # pivotModelToSheet JSON
```

| Exit | Meaning | stderr |
|------|---------|--------|
| `0` | ok | — |
| `2` | invalid input (bad JSON, spec, options, flags, unreadable file) | `{"error":{"code":"invalid_input","message":"…","details":["spec: …"]}}` |
| `1` | internal error (e.g. Chromium missing) | `{"error":{"code":"internal","message":"…"}}` |

## Serve mode

```bash
nqgrid-export serve --port 8787 [--host 127.0.0.1] [--max-body-mb 10] [--concurrency 4] [--no-warm]
```

One Chromium instance stays warm (relaunched if it dies); every PDF renders in a fresh context with
JavaScript disabled and all network requests blocked. Binds to `127.0.0.1` by default.

| Route | Body | Response |
|-------|------|----------|
| `GET /healthz` | — | `200 {"ok":true,"version":"0.1.0","browser":"ready"\|"starting"\|"cold"\|"unavailable","formats":[…]}` |
| `POST /export?format=pdf\|xlsx\|html\|model\|sheet` | request JSON (`Content-Type: application/json`; `format` may also be a body field) | `200` file with `Content-Type` and `Content-Disposition: attachment; filename="<spec.id>.<ext>"` |

Errors are JSON `{"error":{"code","message","details?"}}`: `400 invalid_input`, `404`, `405`, `413 payload_too_large`,
`415` (not JSON), `500 internal`. One JSON log line per request goes to stderr.

### From Python

Use the client in [`integrations/python`](../../integrations/python/README.md) (`NqgridExportClient`, `SubprocessExporter`,
typed errors). Without it:

```python
import httpx, json, subprocess

req = {"spec": spec, "rows": rows, "options": {"generatedAt": "2026-10-30 09:00 UTC"}}

# Service (preferred: no browser launch per request)
r = httpx.post("http://127.0.0.1:8787/export", params={"format": "pdf"}, json=req, timeout=60)
if r.status_code != 200:
    raise RuntimeError(r.json()["error"])          # 400 → fix the spec / rows
pdf_bytes = r.content

# One-shot CLI
p = subprocess.run(["nqgrid-export", "--input", "-", "--format", "xlsx", "--out", "-"],
                   input=json.dumps(req).encode(), capture_output=True)
if p.returncode != 0:
    raise RuntimeError(json.loads(p.stderr.splitlines()[-1])["error"])  # 2 = invalid input, 1 = internal
xlsx_bytes = p.stdout
```

## Node API

```ts
import { exportPivot, createPivotExporter, startPivotExportServer } from "@nqlib/nqgrid-export";

const pdf = await exportPivot({ spec, rows, format: "pdf", options: { generatedAt } }); // Uint8Array
const html = await exportPivot({ spec, rows, format: "html" });                       // string

const exporter = createPivotExporter();      // keeps one Chromium for repeated PDFs
await exporter.export({ spec, rows, format: "pdf" });
await exporter.close();

const service = await startPivotExportServer({ port: 8787 });  // service.url, service.close()
```

Errors are `PivotExportError` (`code: "invalid_input" | "payload_too_large" | "internal"`, `details`, `exitCode`, `status`).

## Output

- **PDF / HTML** — `renderPivotHtml` from `@nqlib/nqgrid/render-static`: landscape A4 by default, header chart band and
  column headers repeated on every page, each department kept on one page, wide pivots split into balanced column
  chunks (dimension columns repeated, "(cont.)" titles), KPI side panels, heat colors, light or dark.
- **XLSX** — from `pivotModelToSheet`: numeric values with Excel `numFmt`, merges, frozen panes, bold subtotals, heat
  fills, column widths; a `KPIs` sheet (grand + department KPIs, "vs Plan" deltas); a hidden `Spec` sheet with the
  spec JSON for traceability.

## Requirements

- Node ≥ 20. PDF needs [`playwright`](https://playwright.dev) (optional peer, resolved from this package, the cwd or
  `NODE_PATH`) and its Chromium (`npx playwright install chromium`); `NQGRID_CHROMIUM_PATH` points at another binary.
  XLSX / HTML / JSON need no browser.

## Docker

```bash
docker build -f packages/nqgrid-export/Dockerfile -t nqgrid-export .     # from the repo root
docker run --rm -p 127.0.0.1:8787:8787 nqgrid-export                      # serve (listens on 0.0.0.0 inside)
docker run --rm -i nqgrid-export --input - --format pdf < req.json > report.pdf
```

Based on `mcr.microsoft.com/playwright:v1.63.0-noble`; bump the `PLAYWRIGHT_VERSION` build arg together with the
image tag. Adds `fonts-inter`, runs as `pwuser`, and has a `/healthz` health check.

## Development

```bash
pnpm build                                     # library dist (consumed by this package's build)
pnpm --filter @nqlib/nqgrid-export build       # dist/index.js + dist/cli.js
pnpm --filter @nqlib/nqgrid-export test        # runs against the library sources; PDF tests skip without Chromium
pnpm --filter @nqlib/nqgrid-export typecheck
```
