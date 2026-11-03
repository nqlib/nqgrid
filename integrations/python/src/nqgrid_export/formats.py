"""Export formats, content types and result decoding (mirrors ``PIVOT_EXPORT_*`` in nqgrid core)."""

from __future__ import annotations

import json
import re
from typing import Any, Literal, get_args

ExportFormat = Literal["pdf", "xlsx", "html", "model", "sheet"]
ReportFormat = Literal["pdf", "xlsx"]
"""Formats an MCP agent may email (``model`` / ``sheet`` are JSON for programs)."""

EXPORT_FORMATS: tuple[ExportFormat, ...] = get_args(ExportFormat)
BINARY_FORMATS: frozenset[str] = frozenset({"pdf", "xlsx"})

CONTENT_TYPES: dict[ExportFormat, str] = {
    "pdf": "application/pdf",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "html": "text/html; charset=utf-8",
    "model": "application/json; charset=utf-8",
    "sheet": "application/json; charset=utf-8",
}

EXTENSIONS: dict[ExportFormat, str] = {
    "pdf": "pdf",
    "xlsx": "xlsx",
    "html": "html",
    "model": "model.json",
    "sheet": "sheet.json",
}

ExportResult = bytes | str | dict[str, Any]
"""``bytes`` for pdf / xlsx, ``str`` for html, ``dict`` (parsed JSON) for model / sheet."""


def check_format(value: object) -> ExportFormat:
    if not isinstance(value, str) or value not in EXPORT_FORMATS:
        from .errors import NqgridInvalidInput

        raise NqgridInvalidInput(f"format must be one of {', '.join(EXPORT_FORMATS)} (got {value!r})")
    return value


def decode_result(fmt: ExportFormat, data: bytes) -> ExportResult:
    """Exporter output bytes → the Python value ``export()`` returns for ``fmt``."""
    if fmt in BINARY_FORMATS:
        return data
    text = data.decode("utf-8")
    if fmt == "html":
        return text
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError(f"{fmt} export did not return a JSON object")
    return parsed


def export_filename(spec: object, fmt: ExportFormat) -> str:
    """``<spec.id>.<ext>`` — the name ``nqgrid-export serve`` puts in ``Content-Disposition``."""
    spec_id = spec.get("id") if isinstance(spec, dict) else getattr(spec, "id", None)
    stem = re.sub(r"[^\w.-]+", "_", spec_id if isinstance(spec_id, str) and spec_id else "pivot", flags=re.ASCII)
    return f"{stem}.{EXTENSIONS[fmt]}"


_PAGE = re.compile(rb"/Type\s*/Page(?![A-Za-z])")


def pdf_page_count(data: bytes) -> int:
    """Pages in a PDF from nqgrid-export (Chromium writes plain ``/Type /Page`` objects)."""
    return len(_PAGE.findall(data))
