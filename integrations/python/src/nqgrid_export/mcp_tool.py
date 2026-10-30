"""Reference MCP server: let an agent export a pivot as PDF / XLSX and email it.

Tools
    ``describe_pivot_spec()``  JSON Schema + authoring guide + example (+ the datasets, if the row
                               provider lists them) so the agent can write a valid spec.
    ``export_pivot_report(spec, rows=None, dataset=None, format="pdf", email_to=None, subject=None,
                          options=None, body=None)``
                               validate → resolve rows → nqgrid-export → save → optionally email.
Resources
    ``nqgrid://pivot-spec/v1/schema`` (JSON) and ``nqgrid://pivot-spec/v1/guide`` (Markdown).

The logic lives in :class:`PivotReportService` (plain Python, unit-testable); :func:`create_mcp_server`
only registers it with the official ``mcp`` SDK (``MCPServer`` in mcp 2.x, ``FastMCP`` in 1.x).
Secolab plugs in its own :class:`RowProvider` (its data layer) and :class:`~nqgrid_export.email.EmailSender`.

Run over stdio (configuration from env, see :meth:`PivotReportService.from_env`)::

    NQGRID_EXPORT_URL=http://127.0.0.1:8787 NQGRID_DATASET_DIR=./data python -m nqgrid_export.mcp_tool
"""

from __future__ import annotations

import datetime as _dt
import functools
import json
import os
import re
from collections.abc import Callable, Collection, Mapping, Sequence
from pathlib import Path
from typing import Any, Literal, Protocol, runtime_checkable

from pydantic import BaseModel, Field

from .email import EmailSender, build_report_email, validate_recipients
from .errors import NqgridExportError, NqgridInvalidInput
from .exporter import PivotExporter
from .formats import CONTENT_TYPES, EXTENSIONS, ReportFormat, pdf_page_count
from .request import dumps_request
from .validation import (
    check_fields,
    example_spec,
    export_options_schema,
    pivot_spec_schema,
    validate_export_options,
    validate_pivot_spec,
)

# ---------------------------------------------------------------------------------------------
# Row providers (Secolab implements one against its data layer)
# ---------------------------------------------------------------------------------------------


class UnknownDatasetError(LookupError):
    """Raised by a :class:`RowProvider` for a dataset id it does not know."""


@runtime_checkable
class RowProvider(Protocol):
    """Resolves a ``dataset`` reference to leaf-grain rows (e.g. a saved query, a table, a cache key).

    Rows must already be at the pivot's leaf grain (e.g. Department × Line × Month) — nqgrid does
    grouping, totals and formatting, not SQL. Raise :class:`UnknownDatasetError` for unknown ids.
    """

    def get_rows(self, dataset: str) -> Sequence[Mapping[str, Any]]: ...


@runtime_checkable
class DatasetCatalog(Protocol):
    """Optional: a provider that can list its datasets for ``describe_pivot_spec``."""

    def list_datasets(self) -> Sequence[Mapping[str, Any]]:
        """``[{"id": "...", "description": "...", "fields": ["department", ...]}, ...]``."""
        ...


def _describe_rows(
    dataset_id: str, rows: Sequence[Mapping[str, Any]], description: str | None = None
) -> dict[str, Any]:
    fields: dict[str, None] = {}
    for row in rows[:200]:
        fields.update(dict.fromkeys(row))
    out: dict[str, Any] = {"id": dataset_id, "rows": len(rows), "fields": list(fields)}
    if description:
        out["description"] = description
    return out


class DictRowProvider:
    """In-memory datasets ``{id: rows}`` (tests, demos, small lookup tables)."""

    def __init__(
        self, datasets: Mapping[str, Sequence[Mapping[str, Any]]], descriptions: Mapping[str, str] | None = None
    ) -> None:
        self._datasets = dict(datasets)
        self._descriptions = dict(descriptions or {})

    def get_rows(self, dataset: str) -> Sequence[Mapping[str, Any]]:
        try:
            return self._datasets[dataset]
        except KeyError:
            raise UnknownDatasetError(dataset) from None

    def list_datasets(self) -> Sequence[Mapping[str, Any]]:
        return [_describe_rows(k, v, self._descriptions.get(k)) for k, v in self._datasets.items()]


_DATASET_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")


class JsonDirectoryRowProvider:
    """``<directory>/<dataset>.rows.json`` or ``<dataset>.json`` (a JSON array of row objects).

    Dataset ids are restricted to ``[A-Za-z0-9_.-]`` (no path separators, no ``..``), so an agent
    cannot read files outside ``directory``.
    """

    def __init__(self, directory: str | Path) -> None:
        self.directory = Path(directory).resolve()

    def _path(self, dataset: str) -> Path:
        if not _DATASET_ID.match(dataset) or ".." in dataset:
            raise UnknownDatasetError(dataset)
        for name in (f"{dataset}.rows.json", f"{dataset}.json"):
            path = (self.directory / name).resolve()
            if path.parent == self.directory and path.is_file():
                return path
        raise UnknownDatasetError(dataset)

    def get_rows(self, dataset: str) -> Sequence[Mapping[str, Any]]:
        data = json.loads(self._path(dataset).read_text("utf-8"))
        if not isinstance(data, list):
            raise ValueError(f"dataset {dataset!r} is not a JSON array")
        return data

    def list_datasets(self) -> Sequence[Mapping[str, Any]]:
        out = []
        for path in sorted(self.directory.glob("*.json")):
            if path.name.endswith((".spec.json", ".model.json", ".sheet.json", ".request.json")):
                continue
            dataset = path.name.removesuffix(".json").removesuffix(".rows")
            try:
                out.append(_describe_rows(dataset, self.get_rows(dataset)))
            except (ValueError, UnknownDatasetError):
                continue
        return out


# ---------------------------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------------------------

PIVOT_SPEC_AUTHORING_GUIDE = """\
# Writing an nqgrid PivotSpec (v1)

A PivotSpec describes a pivot table over **leaf-grain rows** (one row per e.g. department × line × month).
nqgrid computes groups, subtotals, grand totals, "% of total", heat colours and number formatting; you
only describe the layout. The PDF/XLSX matches what users see in the app.

## Required
- `version`: always `1`.
- `rows`: row dimensions, outermost first: `[{"field": "department", "label": "Department"}, {"field": "line"}]`.
  Every level but the last becomes a collapsible group with subtotals. `attributes: ["owner"]` copies
  a field onto that level's rows (shown as the KPI caption).
- `measures`: `[{"id": "actual", "field": "actual", "label": "Actual", "format": {...}}]`.
  `aggregate` defaults to `"sum"`; also `avg | min | max | count | first | last`,
  `{"type": "weightedAvg", "weightField": "units"}`, or
  `{"type": "ratio", "numeratorField": "actual", "denominatorField": "priorYear", "offset": -1}` (offset -1 = growth).
  `field` is required except for `count` and `ratio`. Custom aggregators are not available.

## Optional
- `id` (also the file name), `title`, `subtitle`.
- `columns`: one column dimension, e.g. `{"field": "month", "order": ["Nov", "Dec", ...], "keepEmpty": true}`.
- `values`: measure ids shown as grid columns (default: all measures). Other measures can still feed `kpis`.
- `format`: `{"style": "currency", "currency": "USD", "compact": true}`,
  `{"style": "percent", "signDisplay": "exceptZero"}`, `{"style": "decimal", "decimals": 1}`.
- `showAs` / `groupShowAs`: `percentOfColumnTotal | percentOfParentRow | percentOfRowTotal | percentOfGrandTotal`.
- `totals`: `{"grandTotal": true, "grandTotalPosition": "bottom", "rowTotal": false}`.
- `heat`: `{"measure": "actual", "scope": "all | column | row | group", "applyTo": "leaf | group | all"}`;
  `null` = no heat.
- `headerCharts`: `{"measure": "actual", "type": "bar", "breakdown": true}` (bars above the column headers).
- `kpis`: `[{"id": "growth", "label": "Growth", "measure": "growth", "compareTo": "plan"}]`, `kpiLevels: [0]`.
- `expanded`: `"all"` (default), `"none"`, or key paths of expanded groups, e.g. `[["Camp"], ["Packs"]]`.

## Rules
- Every `field` must exist in the rows (see `datasets[].fields`); every measure id you reference must be defined.
- Unknown keys are rejected. Never put HTML or CSS anywhere: styling is built in.
- Render `options` (separate argument): `theme` (`light | dark`), `page` (`size` A4 | A3 | Letter | Legal | Tabloid,
  `orientation`), `title` / `subtitle`, `maxColumnsPerPage`, `kpiPanel`, `locale`.

## Workflow
1. Call `describe_pivot_spec` and pick a dataset and its fields.
2. Call `export_pivot_report(spec=..., dataset=..., format="pdf", email_to=[...])`.
3. If `ok` is false, read `validation_errors`, fix the spec and call again.
"""


class ExportPivotReportResult(BaseModel):
    """What ``export_pivot_report`` returns (structured MCP tool output)."""

    ok: bool
    format: str
    path: str | None = Field(default=None, description="Absolute path of the saved file")
    filename: str | None = None
    pages: int | None = Field(default=None, description="PDF page count")
    rows: int | None = Field(default=None, description="Data rows exported")
    dataset: str | None = None
    recipients: list[str] = Field(default_factory=list)
    emailed: bool = False
    validation_errors: list[str] = Field(default_factory=list, description="Fix these in the spec / options and retry")
    error: str | None = Field(default=None, description="Non-validation failure (exporter down, email failed, …)")
    bytes: int | None = Field(default=None, description="File size")


Clock = Callable[[], _dt.datetime]


def _utc_now() -> _dt.datetime:
    return _dt.datetime.now(_dt.timezone.utc)


def _stamp(now: _dt.datetime) -> str:
    return now.astimezone(_dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


class PivotReportService:
    """Validation, row resolution, export, storage and email for :func:`create_mcp_server`.

    ``exporter`` is an :class:`~nqgrid_export.client.NqgridExportClient` (serve mode) or a
    :class:`~nqgrid_export.subprocess_exporter.SubprocessExporter`. ``allowed_recipient_domains``
    limits where an agent may send reports; ``max_rows`` / ``max_request_mb`` cap the payload
    (keep the latter under the service's ``--max-body-mb``).
    """

    def __init__(
        self,
        exporter: PivotExporter,
        *,
        output_dir: str | Path,
        row_provider: RowProvider | None = None,
        email_sender: EmailSender | None = None,
        email_from: str | None = None,
        allowed_recipient_domains: Collection[str] | None = None,
        max_rows: int = 200_000,
        max_request_mb: float = 9.5,
        default_options: Mapping[str, Any] | None = None,
        clock: Clock = _utc_now,
    ) -> None:
        self.exporter = exporter
        self.output_dir = Path(output_dir)
        self.row_provider = row_provider
        self.email_sender = email_sender
        self.email_from = email_from or getattr(email_sender, "sender", None)
        self.allowed_recipient_domains = allowed_recipient_domains
        self.max_rows = max_rows
        self.max_request_bytes = int(max_request_mb * 1024 * 1024)
        self.default_options = dict(default_options or {})
        self.clock = clock

    # -- describe ------------------------------------------------------------------------------

    def describe_pivot_spec(self) -> dict[str, Any]:
        """Schema, options schema, guide, example and datasets for an LLM agent."""
        out: dict[str, Any] = {
            "guide": PIVOT_SPEC_AUTHORING_GUIDE,
            "pivot_spec_schema": pivot_spec_schema(),
            "export_options_schema": export_options_schema(),
            "example_spec": example_spec(),
            "formats": ["pdf", "xlsx"],
        }
        if isinstance(self.row_provider, DatasetCatalog):
            try:
                out["datasets"] = [dict(d) for d in self.row_provider.list_datasets()]
            except Exception as e:  # a catalog failure must not hide the schema
                out["datasets_error"] = str(e)
        return out

    # -- export --------------------------------------------------------------------------------

    def _file_path(self, spec: Mapping[str, Any], fmt: ReportFormat, now: _dt.datetime) -> Path:
        spec_id = spec.get("id")
        stem = re.sub(r"[^\w.-]+", "_", spec_id if isinstance(spec_id, str) and spec_id else "pivot", flags=re.ASCII)[
            :80
        ]
        base = f"{stem}-{now.astimezone(_dt.timezone.utc):%Y%m%d-%H%M%S}"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        path = self.output_dir / f"{base}.{EXTENSIONS[fmt]}"
        n = 1
        while path.exists():
            n += 1
            path = self.output_dir / f"{base}-{n}.{EXTENSIONS[fmt]}"
        return path.resolve()

    def export_pivot_report(
        self,
        spec: Mapping[str, Any],
        rows: Sequence[Mapping[str, Any]] | None = None,
        dataset: str | None = None,
        format: ReportFormat = "pdf",
        email_to: Sequence[str] | None = None,
        subject: str | None = None,
        options: Mapping[str, Any] | None = None,
        body: str | None = None,
    ) -> ExportPivotReportResult:
        """Validate, export, save and (optionally) email one report. Never raises for bad input:
        problems come back in ``validation_errors`` / ``error`` so the agent can react."""
        result = ExportPivotReportResult(ok=False, format=format, dataset=dataset, recipients=list(email_to or []))
        if format not in ("pdf", "xlsx"):
            result.validation_errors = [f"format must be 'pdf' or 'xlsx' (got {format!r})"]
            return result

        spec_dict = dict(spec) if isinstance(spec, Mapping) else spec
        merged_options = {**self.default_options, **dict(options or {})}
        now = self.clock()
        merged_options.setdefault("generatedAt", _stamp(now))

        errors = validate_pivot_spec(spec_dict, prefix="spec.")
        errors += validate_export_options(merged_options)
        if rows is None and not dataset:
            errors.append("pass rows or a dataset reference")
        if rows is not None and dataset:
            errors.append("pass rows or dataset, not both")
        if email_to:
            if self.email_sender is None or not self.email_from:
                result.error = "email is not configured on this server"
            errors += validate_recipients(email_to, allowed_domains=self.allowed_recipient_domains)
        if subject is not None and ("\n" in subject or "\r" in subject or len(subject) > 200):
            errors.append("subject must be a single line of at most 200 characters")
        if errors or result.error:
            result.validation_errors = errors
            return result

        # Rows: inline, or from the backend's data layer.
        if rows is None:
            assert dataset is not None
            if self.row_provider is None:
                result.error = "this server has no row provider; pass rows"
                return result
            try:
                resolved = self.row_provider.get_rows(dataset)
            except UnknownDatasetError:
                known = ""
                if isinstance(self.row_provider, DatasetCatalog):
                    known = f" (available: {', '.join(str(d.get('id')) for d in self.row_provider.list_datasets())})"
                result.validation_errors = [f"unknown dataset {dataset!r}{known}"]
                return result
            except Exception as e:
                result.error = f"could not load dataset {dataset!r}: {e}"
                return result
        else:
            resolved = rows
        row_list = [dict(r) for r in resolved]
        result.rows = len(row_list)
        if len(row_list) > self.max_rows:
            result.validation_errors = [
                f"{len(row_list)} rows exceed the limit of {self.max_rows}; aggregate to the pivot's leaf grain first"
            ]
            return result
        if any(not isinstance(r, dict) for r in row_list):
            result.validation_errors = ["rows must be objects"]
            return result
        field_errors = check_fields(spec_dict, row_list)
        if field_errors:
            result.validation_errors = field_errors
            return result
        size = len(dumps_request({"spec": spec_dict, "rows": row_list, "options": merged_options}))
        if size > self.max_request_bytes:
            result.validation_errors = [
                f"request is {size / 1048576:.1f} MiB (limit {self.max_request_bytes / 1048576:.1f}); "
                "aggregate rows first"
            ]
            return result

        # Export.
        try:
            data = self.exporter.export(spec_dict, row_list, format, merged_options)
        except NqgridInvalidInput as e:
            result.validation_errors = e.details or [e.message]
            return result
        except NqgridExportError as e:
            result.error = f"export failed ({e.code}): {e.message}"
            return result

        path = self._file_path(spec_dict, format, now)
        path.write_bytes(data)
        result.path = str(path)
        result.filename = path.name
        result.bytes = len(data)
        if format == "pdf":
            result.pages = pdf_page_count(data)

        # Email.
        if email_to:
            assert self.email_sender is not None and self.email_from
            title = str(spec_dict.get("title") or spec_dict.get("id") or "Pivot report")
            pages = f", {result.pages} page{'s' if result.pages != 1 else ''}" if result.pages else ""
            default_body = (
                f"{title}\n\nAttached: {path.name} ({format.upper()}{pages}).\n"
                f"Generated {merged_options['generatedAt']}.\n"
            )
            try:
                message = build_report_email(
                    sender=self.email_from,
                    to=list(email_to),
                    subject=subject or f"{title} ({format.upper()})",
                    body=body or default_body,
                    attachment=data,
                    filename=path.name,
                    mime_type=CONTENT_TYPES[format],
                )
                self.email_sender.send(message)
            except Exception as e:
                result.error = f"report saved to {path} but email failed: {e}"
                return result
            result.emailed = True

        result.ok = True
        return result

    # -- configuration -------------------------------------------------------------------------

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> PivotReportService:
        """Build from env vars (all optional except where noted).

        ``NQGRID_EXPORT_URL`` (serve mode, default ``http://127.0.0.1:8787``) or ``NQGRID_EXPORT_MODE=subprocess``
        (+ ``NQGRID_EXPORT_BIN``); ``NQGRID_EXPORT_TIMEOUT`` (s, default 60); ``NQGRID_REPORT_DIR`` (default
        ``./reports``); ``NQGRID_DATASET_DIR`` (a :class:`JsonDirectoryRowProvider`); ``NQGRID_SMTP_*`` (see
        :mod:`nqgrid_export.email`) or ``NQGRID_EMAIL_OUTBOX`` (write ``.eml`` files); ``NQGRID_EMAIL_ALLOWED_DOMAINS``
        (comma-separated); ``NQGRID_MAX_ROWS``.
        """
        from .client import NqgridExportClient
        from .email import OutboxEmailSender, SmtpEmailSender
        from .subprocess_exporter import SubprocessExporter

        env = os.environ if environ is None else environ
        timeout = float(env.get("NQGRID_EXPORT_TIMEOUT", 60))
        exporter: PivotExporter
        if env.get("NQGRID_EXPORT_MODE", "http") == "subprocess":
            exporter = SubprocessExporter(env.get("NQGRID_EXPORT_BIN"), timeout=max(timeout, 120))
        else:
            exporter = NqgridExportClient(env.get("NQGRID_EXPORT_URL"), timeout=timeout)
        sender: EmailSender | None = None
        email_from = env.get("NQGRID_SMTP_FROM")
        if env.get("NQGRID_SMTP_HOST"):
            sender = SmtpEmailSender.from_env(env)
        elif env.get("NQGRID_EMAIL_OUTBOX"):
            sender = OutboxEmailSender(env["NQGRID_EMAIL_OUTBOX"])
            email_from = email_from or "reports@localhost.localdomain"
        domains = [d.strip() for d in env.get("NQGRID_EMAIL_ALLOWED_DOMAINS", "").split(",") if d.strip()]
        return cls(
            exporter,
            output_dir=env.get("NQGRID_REPORT_DIR", "reports"),
            row_provider=JsonDirectoryRowProvider(env["NQGRID_DATASET_DIR"]) if env.get("NQGRID_DATASET_DIR") else None,
            email_sender=sender,
            email_from=email_from,
            allowed_recipient_domains=domains or None,
            max_rows=int(env.get("NQGRID_MAX_ROWS", 200_000)),
        )


# ---------------------------------------------------------------------------------------------
# MCP wiring
# ---------------------------------------------------------------------------------------------

SCHEMA_URI = "nqgrid://pivot-spec/v1/schema"
GUIDE_URI = "nqgrid://pivot-spec/v1/guide"

EXPORT_TOOL_DESCRIPTION = (
    "Render a pivot report (PDF or XLSX) from an nqgrid PivotSpec and email it as an attachment. "
    "Pass `dataset` (preferred: the server loads the rows) or inline `rows` at the pivot's leaf grain. "
    "Call describe_pivot_spec first. If ok is false, fix the spec using validation_errors and retry."
)
DESCRIBE_TOOL_DESCRIPTION = (
    "Return the PivotSpec JSON Schema, render-options schema, an authoring guide, an example spec and "
    "the available datasets with their fields. Call before export_pivot_report."
)


def _server_class() -> Any:
    try:
        from mcp.server.mcpserver import MCPServer  # mcp >= 2

        return MCPServer
    except ImportError:
        from mcp.server.fastmcp import FastMCP  # type: ignore[attr-defined,unused-ignore]  # mcp 1.x

        return FastMCP


def create_mcp_server(service: PivotReportService, *, name: str = "nqgrid-reports") -> Any:
    """An ``MCPServer`` (mcp 2.x) / ``FastMCP`` (mcp 1.x) exposing the service's tools and resources."""
    import anyio.to_thread

    server = _server_class()(name, instructions=DESCRIBE_TOOL_DESCRIPTION)

    @server.tool(name="export_pivot_report", description=EXPORT_TOOL_DESCRIPTION)
    async def export_pivot_report(
        spec: dict[str, Any],
        rows: list[dict[str, Any]] | None = None,
        dataset: str | None = None,
        format: Literal["pdf", "xlsx"] = "pdf",
        email_to: list[str] | None = None,
        subject: str | None = None,
        options: dict[str, Any] | None = None,
        body: str | None = None,
    ) -> ExportPivotReportResult:
        # Export and SMTP block: keep them off the event loop.
        call = functools.partial(
            service.export_pivot_report,
            spec,
            rows=rows,
            dataset=dataset,
            format=format,
            email_to=email_to,
            subject=subject,
            options=options,
            body=body,
        )
        return await anyio.to_thread.run_sync(call)

    @server.tool(name="describe_pivot_spec", description=DESCRIBE_TOOL_DESCRIPTION)
    def describe_pivot_spec() -> dict[str, Any]:
        return service.describe_pivot_spec()

    @server.resource(
        SCHEMA_URI, name="pivot-spec-schema", description="PivotSpec v1 JSON Schema", mime_type="application/json"
    )
    def pivot_spec_schema_resource() -> str:
        return json.dumps(pivot_spec_schema(), indent=2)

    @server.resource(
        GUIDE_URI, name="pivot-spec-guide", description="How to write a PivotSpec", mime_type="text/markdown"
    )
    def pivot_spec_guide_resource() -> str:
        return PIVOT_SPEC_AUTHORING_GUIDE

    return server


def main() -> None:
    """``nqgrid-export-mcp`` / ``python -m nqgrid_export.mcp_tool``: stdio MCP server configured from env."""
    create_mcp_server(PivotReportService.from_env()).run()


if __name__ == "__main__":
    main()
