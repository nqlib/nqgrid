"""Python client for nqgrid-export: pivot reports (PDF / XLSX) that match the nqgrid app.

- :class:`NqgridExportClient` / :class:`AsyncNqgridExportClient` — HTTP client for ``nqgrid-export serve``.
- :class:`SubprocessExporter` — one-shot ``nqgrid-export --input - --out -`` runner, same interface.
- :mod:`nqgrid_export.models` — Pydantic v2 models generated from ``contract/pivot/v1``.
- :func:`validate_pivot_spec` / :func:`validate_export_request` — JSON Schema + referential checks.
- :func:`write_xlsx_from_sheet` — openpyxl workbook from ``format="sheet"`` JSON.
- :mod:`nqgrid_export.mcp_tool` — reference MCP server (``export_pivot_report``, ``describe_pivot_spec``).
- :mod:`nqgrid_export.email` — report emails through an injectable sender.
"""

from .client import AsyncNqgridExportClient, NqgridExportClient
from .errors import (
    NqgridExportError,
    NqgridInternalError,
    NqgridInvalidInput,
    NqgridPayloadTooLarge,
    NqgridUnavailable,
)
from .exporter import PivotExporter
from .formats import EXPORT_FORMATS, ExportFormat, ExportResult, ReportFormat, export_filename, pdf_page_count
from .models import PivotExportRequest, PivotSpec
from .request import build_export_request
from .subprocess_exporter import SubprocessExporter
from .validation import (
    check_fields,
    export_request_schema,
    pivot_spec_schema,
    validate_export_options,
    validate_export_request,
    validate_pivot_spec,
)
from .xlsx import write_xlsx_from_sheet

__version__ = "0.1.0"

__all__ = [
    "EXPORT_FORMATS",
    "AsyncNqgridExportClient",
    "ExportFormat",
    "ExportResult",
    "NqgridExportClient",
    "NqgridExportError",
    "NqgridInternalError",
    "NqgridInvalidInput",
    "NqgridPayloadTooLarge",
    "NqgridUnavailable",
    "PivotExportRequest",
    "PivotExporter",
    "PivotSpec",
    "ReportFormat",
    "SubprocessExporter",
    "__version__",
    "build_export_request",
    "check_fields",
    "export_filename",
    "export_request_schema",
    "pdf_page_count",
    "pivot_spec_schema",
    "validate_export_options",
    "validate_export_request",
    "validate_pivot_spec",
    "write_xlsx_from_sheet",
]
