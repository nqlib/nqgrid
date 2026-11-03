"""The exporter interface shared by the HTTP client and the subprocess runner."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Literal, overload

from .formats import ExportFormat, ExportResult, ReportFormat, check_format, decode_result
from .request import OptionsInput, Rows, SpecInput, build_export_request, dumps_request


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

    @abstractmethod
    def _export_bytes(self, body: bytes, fmt: ExportFormat) -> bytes:
        """Send a serialized request; return the exporter's raw output."""

    @abstractmethod
    def health(self) -> dict[str, Any]:
        """``{ok, version, browser, formats}`` (serve mode's ``GET /healthz``)."""
