"""HTTP client: unit tests (httpx.MockTransport) and end-to-end tests against the real ``nqgrid-export serve``."""

from __future__ import annotations

import io
import json
from typing import Any

import httpx
import pytest

from nqgrid_export import (
    AsyncNqgridExportClient,
    NqgridExportClient,
    NqgridInternalError,
    NqgridInvalidInput,
    NqgridPayloadTooLarge,
    NqgridUnavailable,
    PivotSpec,
    pdf_page_count,
)

from .conftest import GOLDEN_GENERATED_AT, ExportService

# --- unit: error mapping ------------------------------------------------------------------------


def _client(handler: Any) -> NqgridExportClient:
    return NqgridExportClient("http://exporter.test", http_client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_posts_the_request_json_with_the_format_query() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["type"] = request.headers["content-type"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, content=b'{"title":"x","cells":[]}')

    sheet = _client(handler).export({"version": 1}, [{"a": 1}], format="sheet", options={"theme": "dark"})
    assert sheet == {"title": "x", "cells": []}
    assert seen == {
        "url": "http://exporter.test/export?format=sheet",
        "type": "application/json",
        "body": {"spec": {"version": 1}, "rows": [{"a": 1}], "options": {"theme": "dark"}},
    }


@pytest.mark.parametrize(
    ("status", "payload", "exc", "code"),
    [
        (
            400,
            {"error": {"code": "invalid_input", "message": "invalid export request", "details": ["spec: x"]}},
            NqgridInvalidInput,
            "invalid_input",
        ),
        (
            413,
            {"error": {"code": "payload_too_large", "message": "too big"}},
            NqgridPayloadTooLarge,
            "payload_too_large",
        ),
        (500, {"error": {"code": "internal", "message": "Chromium crashed"}}, NqgridInternalError, "internal"),
        (
            415,
            {"error": {"code": "unsupported_media_type", "message": "send application/json"}},
            NqgridInternalError,
            "unsupported_media_type",
        ),
        (502, None, NqgridInternalError, "internal"),
    ],
)
def test_maps_error_json_to_exceptions(status: int, payload: Any, exc: type[Exception], code: str) -> None:
    body = json.dumps(payload).encode() if payload else b"<html>bad gateway</html>"
    client = _client(lambda _r: httpx.Response(status, content=body))
    with pytest.raises(exc) as info:
        client.export({"version": 1}, [], format="pdf")
    err = info.value
    assert getattr(err, "code", None) == code
    assert getattr(err, "status", None) == status
    if status == 400:
        assert getattr(err, "details", None) == ["spec: x"]
    if status == 502:
        assert "bad gateway" in str(err)


def test_connection_errors_and_timeouts_are_unavailable() -> None:
    def refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    def slow(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    with pytest.raises(NqgridUnavailable, match="cannot reach"):
        _client(refuse).export({"version": 1}, [])
    with pytest.raises(NqgridUnavailable) as info:
        _client(slow).export({"version": 1}, [])
    assert info.value.code == "timeout"
    with pytest.raises(NqgridUnavailable):
        _client(refuse).health()


def test_rejects_unknown_formats_locally() -> None:
    with pytest.raises(NqgridInvalidInput, match="format must be one of"):
        _client(lambda _r: httpx.Response(200)).export({"version": 1}, [], format="docx")  # type: ignore[call-overload]


def test_base_url_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NQGRID_EXPORT_URL", "http://sidecar:9000/")
    with NqgridExportClient() as client:
        assert client.base_url == "http://sidecar:9000"


# --- end to end: real nqgrid-export serve ---------------------------------------------------------

OPTIONS = {"generatedAt": GOLDEN_GENERATED_AT}


@pytest.fixture(scope="module")
def client(export_service: ExportService) -> Any:
    with NqgridExportClient(export_service.url, timeout=60) as c:
        yield c


@pytest.mark.e2e
def test_health(client: NqgridExportClient) -> None:
    health = client.health()
    assert health["ok"] is True
    assert health["formats"] == ["pdf", "xlsx", "html", "model", "sheet"]
    assert health["browser"] in ("ready", "unavailable")


@pytest.mark.e2e
def test_model_and_sheet_match_the_golden_files(
    client: NqgridExportClient,
    planning_spec: dict[str, Any],
    planning_rows: list[dict[str, Any]],
    planning_model: dict[str, Any],
    planning_sheet: dict[str, Any],
) -> None:
    assert client.export(planning_spec, planning_rows, format="model") == planning_model
    assert client.export(planning_spec, planning_rows, format="sheet") == planning_sheet
    # Pydantic models serialize to the same spec.
    assert client.export(PivotSpec.model_validate(planning_spec), planning_rows, format="model") == planning_model


@pytest.mark.e2e
def test_html(client: NqgridExportClient, planning_spec: dict[str, Any], planning_rows: list[dict[str, Any]]) -> None:
    html = client.export(planning_spec, planning_rows, format="html", options=OPTIONS)
    assert isinstance(html, str)
    assert "<title>FY26 Sales Plan</title>" in html
    assert GOLDEN_GENERATED_AT in html


@pytest.mark.e2e
def test_pdf(chromium: ExportService, planning_spec: dict[str, Any], planning_rows: list[dict[str, Any]]) -> None:
    with NqgridExportClient(chromium.url) as c:
        pdf = c.export(planning_spec, planning_rows, format="pdf", options=OPTIONS)
    assert pdf[:4] == b"%PDF"
    assert pdf_page_count(pdf) >= 1


@pytest.mark.e2e
def test_xlsx_opens_with_openpyxl(
    client: NqgridExportClient,
    planning_spec: dict[str, Any],
    planning_rows: list[dict[str, Any]],
    planning_sheet: dict[str, Any],
) -> None:
    openpyxl = pytest.importorskip("openpyxl")
    data = client.export(planning_spec, planning_rows, format="xlsx", options=OPTIONS)
    assert data[:2] == b"PK"
    wb = openpyxl.load_workbook(io.BytesIO(data))
    ws = wb.worksheets[0]
    assert ws.title == "FY26 Sales Plan"
    assert ws.freeze_panes == "C2"
    assert ws.cell(row=1, column=1).value == planning_sheet["cells"][0][0]["v"]
    assert ws.cell(row=4, column=3).value == pytest.approx(planning_sheet["cells"][3][2]["v"])
    assert "KPIs" in wb.sheetnames


@pytest.mark.e2e
def test_invalid_input_carries_details(client: NqgridExportClient, planning_spec: dict[str, Any]) -> None:
    bad = {**planning_spec, "version": 2, "values": ["nope"]}
    with pytest.raises(NqgridInvalidInput) as info:
        client.export(bad, [{"department": "Camp"}], format="pdf", options={"theme": "sepia"})
    err = info.value
    assert err.status == 400
    assert err.code == "invalid_input"
    assert "spec: version must be 1 (got 2)" in err.details
    assert any('unknown measure "nope"' in d for d in err.details)
    assert 'options.theme must be "light" | "dark"' in err.details
    assert err.to_dict()["error"]["details"] == err.details


@pytest.mark.e2e
def test_body_cap_is_payload_too_large(client: NqgridExportClient, planning_spec: dict[str, Any]) -> None:
    rows = [{"department": "x" * 1000, "n": i} for i in range(3000)]  # ~3 MB > --max-body-mb 2
    with pytest.raises(NqgridPayloadTooLarge):
        client.export(planning_spec, rows, format="model")


@pytest.mark.e2e
async def test_async_client(
    export_service: ExportService,
    planning_spec: dict[str, Any],
    planning_rows: list[dict[str, Any]],
    planning_sheet: dict[str, Any],
) -> None:
    async with AsyncNqgridExportClient(export_service.url) as c:
        assert (await c.health())["ok"] is True
        assert await c.export(planning_spec, planning_rows, format="sheet") == planning_sheet
        with pytest.raises(NqgridInvalidInput):
            await c.export({"version": 1}, [], format="model")
