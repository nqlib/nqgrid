"""The exporter interface shared by the HTTP client and the subprocess runner."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal, overload

from .formats import ExportFormat, ExportResult, ReportFormat, check_format, decode_result
from .request import OptionsInput, Rows, SpecInput, build_export_request, dumps_request

DIAGNOSTICS_HEADER = "x-nqgrid-diagnostics"
"""Response header of ``POST /export`` with ``model.diagnostics`` (JSON array)."""


@dataclass(frozen=True)
class ExportOutput:
    """:meth:`PivotExporter.export_report` result: the file plus nqgrid's ``model.diagnostics``.

    Each diagnostic is a dict with ``code`` (``unparsedNumbers``, ``missingField``, ``invalidDates``,
    ``mixedKeyTypes``, ``filterItemsNotFound``, ``baseItemNotFound``), ``field``, ``path``, ``message`` and,
    depending on the code, ``count``, ``samples`` (``[{"row", "value"}]``), ``types`` or ``items``.
    """

    data: ExportResult
    diagnostics: list[dict[str, Any]] = field(default_factory=list)


def parse_diagnostics(text: str | None) -> list[dict[str, Any]]:
    """A diagnostics JSON array (header value or CLI stderr payload) → list of dicts (``[]`` if malformed)."""
    if not text:
        return []
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        return []
    return [d for d in value if isinstance(d, dict)] if isinstance(value, list) else []


class PivotExporter(ABC):
    """Turns ``(spec, rows, format, options)`` into a file via nqgrid-export.

    Subclasses implement :meth:`_export_bytes` (send the request JSON, return the raw output) and
    :meth:`health`. A test double only needs those two methods.
    """

    @overload
    def export(
        self, spec: SpecInput, rows: Rows, format: ReportFormat = ..., options: OptionsInput | None = ...
    ) -> bytes: ...
    @overload
    def export(
        self, spec: SpecInput, rows: Rows, format: Literal["html"], options: OptionsInput | None = ...
    ) -> str: ...
    @overload
    def export(
        self, spec: SpecInput, rows: Rows, format: Literal["model", "sheet"], options: OptionsInput | None = ...
    ) -> dict[str, Any]: ...
    @overload
    def export(
        self, spec: SpecInput, rows: Rows, format: ExportFormat, options: OptionsInput | None = ...
    ) -> ExportResult: ...

    def export(
        self, spec: SpecInput, rows: Rows, format: ExportFormat = "pdf", options: OptionsInput | None = None
    ) -> ExportResult:
        """Export a pivot: ``bytes`` for pdf / xlsx, ``str`` for html, ``dict`` for model / sheet.

        Raises :class:`~nqgrid_export.errors.NqgridInvalidInput` (with ``details``) when nqgrid-export
        rejects the spec / rows / options, and another :class:`~nqgrid_export.errors.NqgridExportError`
        subclass for everything else.
        """
        fmt = check_format(format)
        body = dumps_request(build_export_request(spec, rows, options=options))
        return decode_result(fmt, self._export_bytes(body, fmt))

    def export_report(
        self, spec: SpecInput, rows: Rows, format: ExportFormat = "pdf", options: OptionsInput | None = None
    ) -> ExportOutput:
        """Like :meth:`export`, plus the model's ``diagnostics``: data problems that leave cells empty or
        totals short (amounts that are not numbers, fields no row has, invalid dates, …). ``[]`` when none."""
        fmt = check_format(format)
        body = dumps_request(build_export_request(spec, rows, options=options))
        data, diagnostics = self._export_bytes_with_diagnostics(body, fmt)
        return ExportOutput(decode_result(fmt, data), diagnostics)

    def _export_bytes_with_diagnostics(self, body: bytes, fmt: ExportFormat) -> tuple[bytes, list[dict[str, Any]]]:
        """``_export_bytes`` plus diagnostics; exporters that cannot report them return ``[]``."""
        return self._export_bytes(body, fmt), []

    @abstractmethod
    def _export_bytes(self, body: bytes, fmt: ExportFormat) -> bytes:
        """Send a serialized request; return the exporter's raw output."""

    @abstractmethod
    def health(self) -> dict[str, Any]:
        """``{ok, version, browser, formats}`` (serve mode's ``GET /healthz``)."""
