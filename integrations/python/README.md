# nqgrid-export-client (Python)

Python side of the nqgrid pivot export: send a `PivotSpec` plus leaf-grain rows to
[`nqgrid-export`](../../packages/nqgrid-export) and get back a PDF / XLSX that matches the grid in the app.
It is the reference integration for a Python backend whose MCP agents email reports (see
[docs/integrations/secolab.md](../../docs/integrations/secolab.md)).

| Module | What it does |
|--------|--------------|
| `nqgrid_export.client` | `NqgridExportClient` / `AsyncNqgridExportClient`: httpx client for `nqgrid-export serve` |
| `nqgrid_export.subprocess_exporter` | `SubprocessExporter`: one-shot `nqgrid-export --input - --out -`, same interface |
| `nqgrid_export.errors` | `NqgridExportError` and its subclasses, mapped from the error JSON / exit codes |
| `nqgrid_export.models` | Pydantic v2 models **generated** from `contract/pivot/v1/*.schema.json` |
| `nqgrid_export.validation` | JSON Schema + referential checks (`validate_pivot_spec`, `validate_export_request`, `check_fields`) |
| `nqgrid_export.request` | `build_export_request` (mirrors the TS `buildPivotExportRequest`) and JSON encoding of DB types |
| `nqgrid_export.xlsx` | `write_xlsx_from_sheet`: openpyxl workbook from `format="sheet"` JSON |
| `nqgrid_export.email` | `build_report_email`, `SmtpEmailSender` (env-configured), `OutboxEmailSender` (`.eml` files) |
| `nqgrid_export.mcp_tool` | Reference MCP server: `export_pivot_report`, `describe_pivot_spec`, schema / guide resources |

## Install

```bash
pip install "nqgrid-export-client[xlsx,mcp] @ git+https://github.com/nqlib/nqgrid#subdirectory=integrations/python"
# or vendor src/nqgrid_export into your backend (it only needs httpx, pydantic, jsonschema)
```

Python ≥ 3.10. Extras: `xlsx` (openpyxl), `mcp` (the official MCP SDK, 1.x `FastMCP` or 2.x `MCPServer`), `dev`.
The exporter itself is Node: run `nqgrid-export serve` (Docker image, or `node packages/nqgrid-export/dist/cli.js serve`).

## Client

```python
from nqgrid_export import NqgridExportClient, NqgridInvalidInput, NqgridExportError

client = NqgridExportClient("http://127.0.0.1:8787", timeout=60)   # or $NQGRID_EXPORT_URL
client.health()            # {"ok": True, "version": "0.1.0", "browser": "ready", "formats": [...]}

pdf: bytes = client.export(spec, rows, format="pdf", options={"generatedAt": "2026-10-30 09:00 UTC"})
xlsx: bytes = client.export(spec, rows, format="xlsx")
html: str = client.export(spec, rows, format="html")
model: dict = client.export(spec, rows, format="model")   # == contract/pivot/v1/examples/planning.model.json
sheet: dict = client.export(spec, rows, format="sheet")   # == planning.sheet.json

try:
    client.export(spec, rows)
except NqgridInvalidInput as e:      # HTTP 400 / exit 2: fix the input (e.details lists every problem)
    print(e.details)
except NqgridExportError as e:       # anything else: NqgridInternalError (500 / exit 1), NqgridUnavailable, …
    print(e.code, e.message)
```

`spec` / `options` may be dicts or the generated Pydantic models (`PivotSpec`, `Options`). Rows may contain
`Decimal`, `date`, `datetime`, `UUID` and `Enum` values. `AsyncNqgridExportClient` has the same API with `await`.

| Exception | When | Retry? |
|-----------|------|--------|
| `NqgridInvalidInput` (`.details`) | 400 `invalid_input`, exit 2, unknown format | No: fix the spec / rows / options |
| `NqgridPayloadTooLarge` | 413 (service `--max-body-mb`) | No: aggregate rows first |
| `NqgridInternalError` | 500, exit 1 (e.g. Chromium missing), unexpected status | Maybe |
| `NqgridUnavailable` | connection refused, timeout, CLI not installed | Yes, with backoff |

All derive from `NqgridExportError` (`code`, `message`, `details`, `status`, `to_dict()`).

## Subprocess exporter

```python
from nqgrid_export import SubprocessExporter

exporter = SubprocessExporter(["node", "/opt/nqgrid-export/dist/cli.js"], timeout=120)  # or $NQGRID_EXPORT_BIN / PATH
pdf = exporter.export(spec, rows, format="pdf")
```

Same `export()` / `health()` interface and exceptions (exit `2` → `NqgridInvalidInput`, `1` → `NqgridInternalError`,
timeout / missing binary → `NqgridUnavailable`). Each PDF launches Chromium (~1 s), so prefer serve mode for interactive use.

## Models and validation

```python
from nqgrid_export import PivotSpec, validate_pivot_spec, validate_export_request, check_fields

spec = PivotSpec.model_validate(raw)                         # structural (Pydantic)
errors = validate_pivot_spec(raw)                            # JSON Schema + referential checks → ["values[0] references unknown measure 'x' …"]
errors += check_fields(raw, rows)                            # fields the rows do not have (typos)
validate_export_request({"spec": raw, "dataset": "sales"})   # the whole request, incl. options (css is rejected)
```

`models.py` is generated; do not edit it. After a contract change:

```bash
scripts/generate_models.sh   # copies contract/pivot/v1 schemas + example into the package, runs datamodel-codegen
```

The Pydantic models cannot express the schema's one `if/then` rule (a measure needs `field` unless its aggregate
is `count`, `ratio` or `custom`) or the cross-references; `validate_pivot_spec` covers both, and nqgrid-export
re-validates everything.

## XLSX in Python

```python
from nqgrid_export import write_xlsx_from_sheet

sheet = client.export(spec, rows, format="sheet")        # all pivot logic done by nqgrid core
xlsx = write_xlsx_from_sheet(sheet, spec=spec)           # values + numFmt, merges, frozen panes, bold, heat fills
```

Use this when you want to customise workbooks in Python (extra sheets, charts, house styles). `format="xlsx"`
gives the reference workbook (adds a `KPIs` sheet and measured column widths). Strings starting with `=` are written
as text, never formulas.

## MCP tool

```python
from nqgrid_export import NqgridExportClient
from nqgrid_export.email import SmtpEmailSender
from nqgrid_export.mcp_tool import PivotReportService, create_mcp_server

class SecolabRows:                                   # implements RowProvider (and optionally DatasetCatalog)
    def get_rows(self, dataset: str) -> list[dict]: ...
    def list_datasets(self) -> list[dict]: ...       # [{"id", "description", "fields"}] for describe_pivot_spec

service = PivotReportService(
    NqgridExportClient(),                            # or SubprocessExporter()
    output_dir="/var/lib/secolab/reports",
    row_provider=SecolabRows(),
    email_sender=SmtpEmailSender.from_env(),         # NQGRID_SMTP_HOST, _PORT, _SECURITY, _USERNAME, _PASSWORD, _FROM
    allowed_recipient_domains=["secolab.example"],
)
create_mcp_server(service).run()                     # stdio; or mount it in your existing MCP server
```

Or, configured entirely from env: `nqgrid-export-mcp` / `python -m nqgrid_export.mcp_tool`
(`NQGRID_EXPORT_URL` or `NQGRID_EXPORT_MODE=subprocess`, `NQGRID_REPORT_DIR`, `NQGRID_DATASET_DIR`,
`NQGRID_SMTP_*` or `NQGRID_EMAIL_OUTBOX`, `NQGRID_EMAIL_ALLOWED_DOMAINS`, `NQGRID_MAX_ROWS`).

| Tool | Signature | Returns |
|------|-----------|---------|
| `export_pivot_report` | `(spec: dict, rows: list[dict] \| None = None, dataset: str \| None = None, format: "pdf" \| "xlsx" = "pdf", email_to: list[str] \| None = None, subject: str \| None = None, options: dict \| None = None, body: str \| None = None)` | `{ok, format, path, filename, bytes, pages, rows, dataset, recipients, emailed, validation_errors, error}` |
| `describe_pivot_spec` | `()` | `{guide, pivot_spec_schema, export_options_schema, example_spec, formats, datasets?}` |

Resources: `nqgrid://pivot-spec/v1/schema` (JSON) and `nqgrid://pivot-spec/v1/guide` (Markdown).

`export_pivot_report` never raises for bad input: it validates the spec, options, recipients and the fields
the spec reads against the rows, and returns `ok: false` with `validation_errors` the agent can act on. It caps rows
(`max_rows`) and the request size (`max_request_mb`, keep it below the service's `--max-body-mb`), keeps dataset ids
to `[A-Za-z0-9_.-]`, never accepts CSS / HTML, and only emails allowed domains when `allowed_recipient_domains` is set.
Call `PivotReportService.export_pivot_report(...)` directly in tests or non-MCP code.

## Development

```bash
cd integrations/python
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/pytest            # e2e tests start the real `nqgrid-export serve`; build it first:
                            #   pnpm build && pnpm --filter @nqlib/nqgrid-export build   (repo root)
.venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/mypy
```

End-to-end tests skip cleanly without `node` or the built CLI; PDF tests skip when the service reports no Chromium.
`NQGRID_EXPORT_CLI` points the tests at another `cli.js`.
