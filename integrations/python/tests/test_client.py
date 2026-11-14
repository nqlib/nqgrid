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
    validate_pivot_spec,
    write_xlsx_from_sheet,
)

from .conftest import EXAMPLES, GOLDEN_GENERATED_AT, ExportService, load_example

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


def test_export_report_reads_the_diagnostics_header() -> None:
    diagnostics = [{"code": "missingField", "field": "vv", "path": "measures[0].field", "message": "No record …"}]

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"%PDF", headers={"x-nqgrid-diagnostics": json.dumps(diagnostics)})

    out = _client(handler).export_report({"version": 1}, [], format="pdf")
    assert out.data == b"%PDF"
    assert out.diagnostics == diagnostics
    plain = _client(lambda r: httpx.Response(200, content=b"%PDF")).export_report({"version": 1}, [])
    assert plain.diagnostics == []


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
def test_filtered_spec_matches_the_golden_files(
    client: NqgridExportClient,
    filtered_spec: dict[str, Any],
    planning_rows: list[dict[str, Any]],
    filtered_model: dict[str, Any],
    filtered_sheet: dict[str, Any],
) -> None:
    """Filters, Top N with "Other", sort by value and facets are computed by nqgrid, not by Python."""
    assert client.export(filtered_spec, planning_rows, format="model") == filtered_model
    assert client.export(filtered_spec, planning_rows, format="sheet") == filtered_sheet
    assert client.export(PivotSpec.model_validate(filtered_spec), planning_rows, format="model") == filtered_model
    html = client.export(filtered_spec, planning_rows, format="html", options=OPTIONS)
    assert html == (EXAMPLES / "planning-filtered.html").read_text("utf-8")
    assert "Filters: Department = Camp, Packs" in html


@pytest.mark.e2e
@pytest.mark.parametrize(
    ("name", "rows_name"),
    [
        ("planning-multicol", "planning-fields.rows.json"),
        ("planning-dates", "planning-dates.rows.json"),
        ("planning-calc", "planning-dates.rows.json"),
        ("planning-statement", "planning-statement.rows.json"),
        ("planning-fpa", "planning-fpa.rows.json"),
        ("planning-fpa-bs", "planning-fpa.rows.json"),
    ],
)
def test_column_hierarchy_and_date_grouping_match_the_golden_files(
    client: NqgridExportClient, name: str, rows_name: str
) -> None:
    """Several column fields, subtotal columns, fiscal date groups and collapsed groups come from nqgrid."""
    spec = load_example(f"{name}.spec.json")
    rows = load_example(rows_name)
    assert client.export(spec, rows, format="model") == load_example(f"{name}.model.json")
    assert client.export(spec, rows, format="sheet") == load_example(f"{name}.sheet.json")
    assert client.export(PivotSpec.model_validate(spec), rows, format="model") == load_example(f"{name}.model.json")
    html = client.export(spec, rows, format="html", options=OPTIONS)
    assert html == (EXAMPLES / f"{name}.html").read_text("utf-8")


@pytest.mark.e2e
def test_date_grouping_changes_from_python(client: NqgridExportClient) -> None:
    """An agent regroups a date by editing derived field names; nqgrid parses the ISO dates in UTC."""
    spec = load_example("planning-dates.spec.json")
    rows = load_example("planning-dates.rows.json")
    by_month = {**spec, "columns": [{"field": "orderDate:yearMonth", "keepEmpty": True}], "columnsExpanded": "all"}
    model = client.export(by_month, rows, format="model")
    keys = [k["label"] for k in model["columnKeys"]]
    assert keys[0] == "Nov 2024" and keys[-1] == "Oct 2026" and len(keys) == 24
    fy26 = {**spec, "filters": [{"field": "orderDate:year", "include": ["2026"]}]}
    filtered = client.export(fy26, rows, format="model")
    assert filtered["filters"][0]["text"] == "Year (Order date) = FY26"
    assert filtered["recordCount"]["matched"] == len(rows) // 2


@pytest.mark.e2e
def test_calculated_measures_from_python(client: NqgridExportClient) -> None:
    """An agent adds a calculated measure and a running total; nqgrid evaluates them over aggregated values."""
    spec = load_example("planning-calc.spec.json")
    rows = load_example("planning-dates.rows.json")
    spec = {
        **spec,
        "measures": [
            *spec["measures"],
            {"id": "gap", "label": "Gap", "calculate": "round(actual - plan, -3)"},
            {"id": "run", "field": "actual", "showAs": "runningTotal", "showAsBase": {"field": "orderDate:year"}},
        ],
        "values": ["actual", "gap", "run"],
        "heat": None,
        "rows": [{**spec["rows"][0], "subtotal": "none"}, {"field": "line"}],
        "expanded": "none",
    }
    assert validate_pivot_spec(spec) == []
    model = client.export(spec, rows, format="model")
    plan = sum(r["plan"] for r in rows)
    actual = sum(r["actual"] for r in rows)
    gap = model["grandTotal"]["cells"][7]["value"]  # FY25, FY26, Total × (actual, gap, run)
    assert gap == round((actual - plan) / 1000) * 1000
    fy25, fy26 = model["grandTotal"]["cells"][2]["value"], model["grandTotal"]["cells"][5]["value"]
    assert fy26 == pytest.approx(actual)  # running total over both fiscal years
    assert fy25 < fy26
    bad = {**spec, "measures": [*spec["measures"], {"id": "loop", "calculate": "loop * 2"}]}
    assert validate_pivot_spec(bad) == ["measures[8].calculate: reference cycle loop → loop"]
    with pytest.raises(NqgridInvalidInput) as err:
        client.export(bad, rows, format="model")
    assert any("reference cycle" in d for d in err.value.details)


@pytest.mark.e2e
def test_financial_statement_from_python(client: NqgridExportClient) -> None:
    """An agent builds an income statement: signed amounts, % of Revenue on every row, Operating income."""
    spec = load_example("planning-statement.spec.json")
    rows = load_example("planning-statement.rows.json")
    model = client.export(spec, rows, format="model")
    labels = [(r["kind"], r["label"]) for r in model["rows"]]
    assert ("subtotal", "Gross margin") in labels and labels[-1] == ("grandTotal", "Operating income")
    total = model["grandTotal"]["cells"]
    assert total[-2]["value"] == 4110  # FY 2026 amount
    assert total[-1]["value"] == pytest.approx(4110 / 18600)  # % of Revenue
    # Amounts that are already signed: drop signField; the figures stay the same.
    signed = [{**r, "AMOUNT": r["AMOUNT"] * float(r["SIGN"])} for r in rows]
    plain = {**spec, "measures": [{k: v for k, v in m.items() if k != "signField"} for m in spec["measures"]]}
    assert client.export(plain, signed, format="model")["grandTotal"]["cells"][-2]["value"] == 4110
    with pytest.raises(NqgridInvalidInput) as err:
        client.export(
            {**spec, "measures": [*spec["measures"], {"id": "n", "aggregate": "count", "signField": "SIGN"}]},
            rows,
            format="model",
        )
    assert any("signField" in d for d in err.value.details)


@pytest.mark.e2e
def test_fpa_planning_pack_from_python(chromium: ExportService) -> None:
    """Long-format FP&A data: measure filters (Actual / Budget / prior year), closing balances and average FTE,
    printed as a statement PDF and as an analyst workbook (Node exceljs and the openpyxl writer)."""
    openpyxl = pytest.importorskip("openpyxl")
    spec = load_example("planning-fpa.spec.json")
    bs = load_example("planning-fpa-bs.spec.json")
    rows = load_example("planning-fpa.rows.json")
    options = {**OPTIONS, "profile": "statement"}
    with NqgridExportClient(chromium.url) as c:
        model = c.export(bs, rows, format="model")
        cells = {r["label"]: r["cells"] for r in model["rows"]}
        q1 = next(i for i, col in enumerate(model["columns"]) if col["headerPath"] == ["Q1 2026", "Balance"])
        assert cells["Cash"][q1]["value"] == 230_000  # March balance, not Jan + Feb + Mar
        fte = next(i for i, col in enumerate(model["columns"]) if col["headerPath"] == ["Q1 2026", "FTE"])
        assert cells["Engineering"][fte]["value"] == 32  # (31 + 32 + 33) / 3
        for s in (spec, bs):
            pdf = c.export(s, rows, format="pdf", options=options)
            assert pdf[:4] == b"%PDF" and pdf_page_count(pdf) >= 1
        data = c.export(spec, rows, format="xlsx", options={**options, "xlsx": {"subtotalFormulas": True}})
        sheet = c.export(spec, rows, format="sheet", options={**options, "xlsx": {"subtotalFormulas": True}})
    ws = openpyxl.load_workbook(io.BytesIO(data)).worksheets[0]
    assert [ws.cell(row=r, column=1).value for r in (1, 2, 3, 4)] == [
        spec["title"],
        spec["subtitle"],
        "USD thousands",
        "Filters: Kind = flow",
    ]
    top = sheet["tableRow"]
    assert ws.freeze_panes == f"B{top + sheet['frozenRows'] + 1}"
    assert ws.print_title_rows == f"${top + 1}:${top + sheet['frozenRows']}"
    assert ws.page_setup.orientation == "landscape"
    assert ws.sheet_properties.outlinePr.summaryBelow is True
    total = top + len(sheet["cells"])
    assert ws.cell(row=total, column=1).value == "Operating income"
    assert str(ws.cell(row=total, column=2).value).startswith("=SUBTOTAL(9,")
    assert ws.cell(row=total, column=2).border.bottom.style == "double"
    py = openpyxl.load_workbook(io.BytesIO(write_xlsx_from_sheet(sheet, spec=spec, generated_at=GOLDEN_GENERATED_AT)))
    pws = py.worksheets[0]
    assert pws.cell(row=total, column=2).value == ws.cell(row=total, column=2).value
    assert pws.print_title_rows == ws.print_title_rows
    assert [pws.row_dimensions[r].outlineLevel for r in range(top + 2, total + 1)] == [
        ws.row_dimensions[r].outlineLevel for r in range(top + 2, total + 1)
    ]


@pytest.mark.e2e
def test_income_statement_with_calculated_items_from_python(chromium: ExportService) -> None:
    """Calculated items (Gross margin, Gross margin %, EBITDA) and per-section subtotal labels, computed by nqgrid:
    the golden model / sheet / statement HTML, a statement PDF and an analyst workbook (Node and openpyxl)."""
    openpyxl = pytest.importorskip("openpyxl")
    spec = load_example("planning-income.spec.json")
    rows = load_example("planning-income.rows.json")
    assert validate_pivot_spec(spec) == []
    options = {**OPTIONS, "profile": "statement"}
    with NqgridExportClient(chromium.url) as c:
        out = c.export_report(spec, rows, format="model")
        model = out.data
        assert out.diagnostics == []
        assert model == load_example("planning-income.model.json")
        assert c.export(spec, rows, format="sheet") == load_example("planning-income.sheet.json")
        html = c.export(spec, rows, format="html", options=options)
        assert html == (EXAMPLES / "planning-income.html").read_text("utf-8")
        labels = [(r["kind"], r["label"]) for r in model["rows"]]
        assert labels[3] == ("subtotal", "Total revenue")
        assert [label for kind, label in labels if kind == "calculated"] == ["Gross margin", "Gross margin %", "EBITDA"]
        cells = {r["label"]: r["cells"] for r in model["rows"]}
        assert [c["value"] for c in cells["EBITDA"]] == [945, 1080, 1215, 1350, 4590]
        assert cells["Gross margin %"][-1]["value"] == pytest.approx(8190 / 13980)
        assert model["grandTotal"]["cells"][-1]["value"] == 4110  # items stay out of Operating income
        # A typo in a formula is a diagnostic (the data decides which keys exist), not a validation error.
        typo = {
            **spec,
            "rows": [
                {**spec["rows"][0], "calculatedItems": [{"key": "GM", "formula": "[Revenue] + [Cost of sale]"}]},
                spec["rows"][1],
            ],
        }
        assert validate_pivot_spec(typo) == []
        warned = c.export_report(typo, rows, format="model")
        assert [d["code"] for d in warned.diagnostics] == ["itemKeyNotFound"]
        assert warned.diagnostics[0]["items"] == ["Cost of sale"]
        # A reference cycle is rejected by both validators with the same message.
        loop = {
            **spec,
            "rows": [{**spec["rows"][0], "calculatedItems": [{"key": "X", "formula": "[X] + 1"}]}, spec["rows"][1]],
        }
        assert validate_pivot_spec(loop) == ["rows[0].calculatedItems[0].formula: reference cycle X → X"]
        with pytest.raises(NqgridInvalidInput) as err:
            c.export(loop, rows, format="model")
        assert err.value.details == ["spec: rows[0].calculatedItems[0].formula: reference cycle X → X"]
        pdf = c.export(spec, rows, format="pdf", options=options)
        assert pdf[:4] == b"%PDF" and pdf_page_count(pdf) == 1
        data = c.export(spec, rows, format="xlsx", options={**options, "xlsx": {"subtotalFormulas": True}})
        sheet = c.export(spec, rows, format="sheet", options={**options, "xlsx": {"subtotalFormulas": True}})
    ws = openpyxl.load_workbook(io.BytesIO(data)).worksheets[0]
    top = sheet["tableRow"]
    row_of = {r[0]["v"]: top + i + 1 for i, r in enumerate(sheet["cells"])}
    gm, pct = row_of["Gross margin"], row_of["Gross margin %"]
    assert ws.cell(row=gm, column=2).value == 1845
    assert ws.cell(row=gm, column=2).font.bold is True
    assert ws.cell(row=gm, column=2).border.top.style == "thin"
    assert ws.cell(row=pct, column=6).number_format == "#,##0.0%"
    assert str(ws.cell(row=row_of["Total revenue"], column=2).value).startswith("=SUBTOTAL(9,")
    assert ws.cell(row=row_of["Operating income"], column=6).value == 4110
    py = openpyxl.load_workbook(io.BytesIO(write_xlsx_from_sheet(sheet, spec=spec, generated_at=GOLDEN_GENERATED_AT)))
    pws = py.worksheets[0]
    for r in (gm, pct, row_of["EBITDA"], row_of["Operating income"]):
        assert [pws.cell(row=r, column=c).value for c in range(1, 7)] == [
            ws.cell(row=r, column=c).value for c in range(1, 7)
        ]
        assert pws.cell(row=r, column=6).number_format == ws.cell(row=r, column=6).number_format


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
    top = planning_sheet["tableRow"]
    assert ws.cell(row=1, column=1).value == planning_sheet["title"]
    assert ws.freeze_panes == f"C{top + 2}"
    assert ws.cell(row=top + 1, column=1).value == planning_sheet["cells"][0][0]["v"]
    assert ws.cell(row=top + 4, column=3).value == pytest.approx(planning_sheet["cells"][3][2]["v"])
    assert "KPIs" in wb.sheetnames


@pytest.mark.e2e
def test_diagnostics_and_strict_validation_from_the_service(client: NqgridExportClient) -> None:
    spec = {"version": 1, "rows": [{"field": "a"}], "measures": [{"id": "m", "field": "v"}]}
    out = client.export_report(spec, [{"a": "X", "v": "(500)"}, {"a": "Y", "v": 2}], format="html")
    assert isinstance(out.data, str)
    assert [d["code"] for d in out.diagnostics] == ["unparsedNumbers"]
    assert out.diagnostics[0]["samples"] == [{"row": 0, "value": '"(500)"'}]
    unknown = {**spec, "measures": [{"id": "m", "field": "v", "filter": {"field": "s", "where": "x"}}]}
    with pytest.raises(NqgridInvalidInput) as info:
        client.export(unknown, [], format="html")
    # The service now rejects what the Python validator rejects, with the same message.
    assert info.value.details == ["spec: measures[0].filter: unknown key(s) ('where' was unexpected)"]
    assert "measures[0].filter: unknown key(s) ('where' was unexpected)" in validate_pivot_spec(unknown)


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
