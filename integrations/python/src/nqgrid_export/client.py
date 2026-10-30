"""HTTP client for ``nqgrid-export serve`` (sync :class:`NqgridExportClient`, async :class:`AsyncNqgridExportClient`).

Run the service next to the backend (``nqgrid-export serve --port 8787``, Docker sidecar, …) and keep
one client per process: the service keeps a warm Chromium, so PDFs take ~100 ms instead of a
browser launch each.

    client = NqgridExportClient("http://127.0.0.1:8787", timeout=60)
    pdf = client.export(spec, rows, format="pdf", options={"generatedAt": "2026-10-30 09:00 UTC"})
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from types import TracebackType
from typing import Any, Literal, overload

import httpx

from .errors import NqgridExportError, NqgridUnavailable, error_from_response
from .exporter import PivotExporter
from .formats import ExportFormat, ExportResult, ReportFormat, check_format, decode_result
from .request import OptionsInput, Rows, SpecInput, build_export_request, dumps_request

DEFAULT_BASE_URL = "http://127.0.0.1:8787"
DEFAULT_TIMEOUT = 60.0
"""Seconds for a whole export. Large PDFs take a few seconds; the service itself times out at 120 s."""
CONNECT_TIMEOUT = 5.0


def _timeout(timeout: float | httpx.Timeout) -> httpx.Timeout:
    if isinstance(timeout, httpx.Timeout):
        return timeout
    return httpx.Timeout(timeout, connect=min(CONNECT_TIMEOUT, timeout))


def _check(response: httpx.Response) -> bytes:
    if response.status_code != 200:
        raise error_from_response(response.status_code, response.content)
    return response.content


def _health(response: httpx.Response) -> dict[str, Any]:
    payload = response.json()
    if not isinstance(payload, dict):
        raise NqgridExportError("unexpected /healthz response", status=response.status_code)
    return payload


_HEADERS = {"content-type": "application/json", "accept": "*/*"}


class NqgridExportClient(PivotExporter):
    """Blocking client. ``base_url`` defaults to ``$NQGRID_EXPORT_URL`` or ``http://127.0.0.1:8787``."""

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float | httpx.Timeout = DEFAULT_TIMEOUT,
        *,
        http_client: httpx.Client | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        self.base_url = (base_url or os.environ.get("NQGRID_EXPORT_URL") or DEFAULT_BASE_URL).rstrip("/")
        self._owns_client = http_client is None
        self._http = http_client or httpx.Client(timeout=_timeout(timeout), headers=dict(headers or {}))

    def _export_bytes(self, body: bytes, fmt: ExportFormat) -> bytes:
        try:
            response = self._http.post(
                f"{self.base_url}/export", params={"format": fmt}, content=body, headers=_HEADERS
            )
        except httpx.TimeoutException as e:
            raise NqgridUnavailable(f"nqgrid-export timed out: {e}", code="timeout") from e
        except httpx.TransportError as e:
            raise NqgridUnavailable(f"cannot reach nqgrid-export at {self.base_url}: {e}") from e
        return _check(response)

    def health(self) -> dict[str, Any]:
        """``GET /healthz`` → ``{ok, version, browser, formats}``."""
        try:
            response = self._http.get(f"{self.base_url}/healthz")
        except httpx.TransportError as e:
            raise NqgridUnavailable(f"cannot reach nqgrid-export at {self.base_url}: {e}") from e
        _check(response)
        return _health(response)

    def close(self) -> None:
        if self._owns_client:
            self._http.close()

    def __enter__(self) -> NqgridExportClient:
        return self

    def __exit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, tb: TracebackType | None
    ) -> None:
        self.close()


class AsyncNqgridExportClient:
    """``asyncio`` / ``anyio`` variant of :class:`NqgridExportClient` (same arguments and results)."""

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float | httpx.Timeout = DEFAULT_TIMEOUT,
        *,
        http_client: httpx.AsyncClient | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        self.base_url = (base_url or os.environ.get("NQGRID_EXPORT_URL") or DEFAULT_BASE_URL).rstrip("/")
        self._owns_client = http_client is None
        self._http = http_client or httpx.AsyncClient(timeout=_timeout(timeout), headers=dict(headers or {}))

    @overload
    async def export(
        self, spec: SpecInput, rows: Rows, format: ReportFormat = ..., options: OptionsInput | None = ...
    ) -> bytes: ...
    @overload
    async def export(
        self, spec: SpecInput, rows: Rows, format: Literal["html"], options: OptionsInput | None = ...
    ) -> str: ...
    @overload
    async def export(
        self, spec: SpecInput, rows: Rows, format: Literal["model", "sheet"], options: OptionsInput | None = ...
    ) -> dict[str, Any]: ...
    @overload
    async def export(
        self, spec: SpecInput, rows: Rows, format: ExportFormat, options: OptionsInput | None = ...
    ) -> ExportResult: ...

    async def export(
        self, spec: SpecInput, rows: Rows, format: ExportFormat = "pdf", options: OptionsInput | None = None
    ) -> ExportResult:
        fmt = check_format(format)
        body = dumps_request(build_export_request(spec, rows, options=options))
        try:
            response = await self._http.post(
                f"{self.base_url}/export", params={"format": fmt}, content=body, headers=_HEADERS
            )
        except httpx.TimeoutException as e:
            raise NqgridUnavailable(f"nqgrid-export timed out: {e}", code="timeout") from e
        except httpx.TransportError as e:
            raise NqgridUnavailable(f"cannot reach nqgrid-export at {self.base_url}: {e}") from e
        return decode_result(fmt, _check(response))

    async def health(self) -> dict[str, Any]:
        try:
            response = await self._http.get(f"{self.base_url}/healthz")
        except httpx.TransportError as e:
            raise NqgridUnavailable(f"cannot reach nqgrid-export at {self.base_url}: {e}") from e
        _check(response)
        return _health(response)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._http.aclose()

    async def __aenter__(self) -> AsyncNqgridExportClient:
        return self

    async def __aexit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, tb: TracebackType | None
    ) -> None:
        await self.aclose()
