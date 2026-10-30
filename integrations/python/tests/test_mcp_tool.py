"""MCP tool: the service called directly (fake sender, fake row provider), an in-process MCP client
call when the ``mcp`` SDK is installed, and one end-to-end PDF through the real service."""

from __future__ import annotations

import datetime as dt
import json
from email.message import EmailMessage
from pathlib import Path
from typing import Any

import pytest

from nqgrid_export import NqgridExportClient, NqgridInvalidInput, NqgridUnavailable, PivotExporter, pdf_page_count
from nqgrid_export.formats import ExportFormat
from nqgrid_export.mcp_tool import (
    PIVOT_SPEC_AUTHORING_GUIDE,
    DictRowProvider,
    JsonDirectoryRowProvider,
    PivotReportService,
    UnknownDatasetError,
    create_mcp_server,
)
from nqgrid_export.validation import pivot_spec_schema

from .conftest import EXAMPLES, ExportService

NOW = dt.datetime(2026, 10, 30, 9, 0, tzinfo=dt.timezone.utc)


class FakeExporter(PivotExporter):
    def __init__(
        self, result: bytes = b"%PDF-1.7\n/Type /Page\n/Type /Page\n/Type /Pages\n", error: Exception | None = None
    ) -> None:
        self.result = result
        self.error = error
        self.calls: list[tuple[dict[str, Any], ExportFormat]] = []

    def _export_bytes(self, body: bytes, fmt: ExportFormat) -> bytes:
        self.calls.append((json.loads(body), fmt))
        if self.error:
            raise self.error
        return self.result

    def health(self) -> dict[str, Any]:
        return {"ok": True}


class FakeSender:
    sender = "reports@secolab.example"

    def __init__(self, fail: bool = False) -> None:
        self.messages: list[EmailMessage] = []
        self.fail = fail

    def send(self, message: EmailMessage) -> None:
        if self.fail:
            raise ConnectionRefusedError("smtp down")
        self.messages.append(message)


@pytest.fixture
def provider(planning_rows: list[dict[str, Any]]) -> DictRowProvider:
    return DictRowProvider(
        {"planning-fy26": planning_rows}, {"planning-fy26": "FY26 plan at department × line × month"}
    )


def make_service(
    tmp_path: Path, exporter: PivotExporter, provider: Any = None, sender: Any = None, **kw: Any
) -> PivotReportService:
    return PivotReportService(
        exporter, output_dir=tmp_path / "reports", row_provider=provider, email_sender=sender, clock=lambda: NOW, **kw
    )


def test_describe_pivot_spec(tmp_path: Path, provider: DictRowProvider, planning_spec: dict[str, Any]) -> None:
    info = make_service(tmp_path, FakeExporter(), provider).describe_pivot_spec()
    assert info["pivot_spec_schema"] == pivot_spec_schema()
    assert "css" not in info["export_options_schema"]["properties"]
    assert info["guide"] == PIVOT_SPEC_AUTHORING_GUIDE
    assert info["example_spec"] == planning_spec
    (ds,) = info["datasets"]
    assert ds["id"] == "planning-fy26"
    assert ds["rows"] == 264
    assert {"department", "line", "month", "actual", "plan", "owner"} <= set(ds["fields"])


def test_export_from_dataset_and_email(
    tmp_path: Path, provider: DictRowProvider, planning_spec: dict[str, Any]
) -> None:
    exporter, sender = FakeExporter(), FakeSender()
    result = make_service(tmp_path, exporter, provider, sender).export_pivot_report(
        planning_spec, dataset="planning-fy26", email_to=["ana@secolab.example"], subject="FY26 plan"
    )
    assert result.ok, result
    assert result.path and Path(result.path).read_bytes() == exporter.result
    assert result.filename == "planning-fy26-20261030-090000.pdf"
    assert (result.pages, result.bytes, result.rows) == (2, len(exporter.result), 264)
    assert result.recipients == ["ana@secolab.example"] and result.emailed
    (request, fmt) = exporter.calls[0]
    assert fmt == "pdf"
    assert request["options"] == {"generatedAt": "2026-10-30 09:00 UTC"}
    assert len(request["rows"]) == 264
    (msg,) = sender.messages
    assert (msg["To"], msg["Subject"], msg["From"]) == ("ana@secolab.example", "FY26 plan", "reports@secolab.example")
    (att,) = list(msg.iter_attachments())
    assert att.get_filename() == result.filename and att.get_content() == exporter.result


def test_inline_rows_xlsx_and_options(
    tmp_path: Path, planning_spec: dict[str, Any], planning_rows: list[dict[str, Any]]
) -> None:
    exporter = FakeExporter(result=b"PK\x03\x04")
    service = make_service(tmp_path, exporter, default_options={"theme": "light"})
    result = service.export_pivot_report(
        planning_spec, rows=planning_rows[:10], format="xlsx", options={"theme": "dark", "page": {"size": "Letter"}}
    )
    assert result.ok and result.pages is None and result.path and result.path.endswith(".xlsx")
    assert exporter.calls[0][0]["options"] == {
        "theme": "dark",
        "page": {"size": "Letter"},
        "generatedAt": "2026-10-30 09:00 UTC",
    }
    again = service.export_pivot_report(planning_spec, rows=planning_rows[:10], format="xlsx")
    assert again.filename == "planning-fy26-20261030-090000-2.xlsx"  # never overwrites


@pytest.mark.parametrize(
    ("kwargs", "expected"),
    [
        ({"spec": {"version": 2, "rows": [], "measures": []}}, "spec.version: 1 was expected"),
        ({"options": {"css": "body{display:none}"}}, "options: unknown key(s) ('css' was unexpected)"),
        ({"dataset": None}, "pass rows or a dataset reference"),
        ({"rows": [{"department": "x"}]}, "pass rows or dataset, not both"),
        ({"format": "html"}, "format must be 'pdf' or 'xlsx' (got 'html')"),
        ({"subject": "x\nBcc: a@b.example"}, "subject must be a single line of at most 200 characters"),
        (
            {"email_to": ["Ana <ana@secolab.example>"]},
            "email_to[0]: 'Ana <ana@secolab.example>' is not a plain email address",
        ),
        ({"email_to": ["x@gmail.com"]}, "email_to[0]: 'x@gmail.com' is outside the allowed domains (secolab.example)"),
    ],
)
def test_validation_errors_are_returned_not_raised(
    tmp_path: Path, provider: DictRowProvider, planning_spec: dict[str, Any], kwargs: dict[str, Any], expected: str
) -> None:
    exporter = FakeExporter()
    service = make_service(tmp_path, exporter, provider, FakeSender(), allowed_recipient_domains=["secolab.example"])
    args: dict[str, Any] = {"spec": planning_spec, "dataset": "planning-fy26", **kwargs}
    result = service.export_pivot_report(**args)
    assert not result.ok
    assert expected in result.validation_errors
    assert exporter.calls == []
    assert result.path is None


def test_unknown_dataset_and_field_typos(
    tmp_path: Path, provider: DictRowProvider, planning_spec: dict[str, Any]
) -> None:
    service = make_service(tmp_path, FakeExporter(), provider)
    result = service.export_pivot_report(planning_spec, dataset="sales")
    assert result.validation_errors == ["unknown dataset 'sales' (available: planning-fy26)"]
    typo = {**planning_spec, "rows": [{"field": "dept"}, *planning_spec["rows"][1:]]}
    result = service.export_pivot_report(typo, dataset="planning-fy26")
    assert len(result.validation_errors) == 1
    assert result.validation_errors[0].startswith(
        "spec.rows[0].field: rows have no field 'dept' (fields: actual, department,"
    )


def test_exporter_errors(tmp_path: Path, provider: DictRowProvider, planning_spec: dict[str, Any]) -> None:
    invalid = NqgridInvalidInput("invalid export request", ["spec: measures[0] uses custom aggregator"])
    result = make_service(tmp_path, FakeExporter(error=invalid), provider).export_pivot_report(
        planning_spec, dataset="planning-fy26"
    )
    assert result.validation_errors == ["spec: measures[0] uses custom aggregator"]
    down = NqgridUnavailable("cannot reach nqgrid-export at http://127.0.0.1:8787")
    result = make_service(tmp_path, FakeExporter(error=down), provider).export_pivot_report(
        planning_spec, dataset="planning-fy26"
    )
    assert result.error == "export failed (unavailable): cannot reach nqgrid-export at http://127.0.0.1:8787"


def test_email_failures(tmp_path: Path, provider: DictRowProvider, planning_spec: dict[str, Any]) -> None:
    result = make_service(tmp_path, FakeExporter(), provider).export_pivot_report(
        planning_spec, dataset="planning-fy26", email_to=["a@x.example"]
    )
    assert not result.ok and result.error == "email is not configured on this server"
    result = make_service(tmp_path, FakeExporter(), provider, FakeSender(fail=True)).export_pivot_report(
        planning_spec, dataset="planning-fy26", email_to=["a@x.example"]
    )
    assert not result.ok and not result.emailed
    assert result.path and Path(result.path).is_file()
    assert result.error and "email failed: smtp down" in result.error


def test_row_and_size_limits(tmp_path: Path, provider: DictRowProvider, planning_spec: dict[str, Any]) -> None:
    result = make_service(tmp_path, FakeExporter(), provider, max_rows=100).export_pivot_report(
        planning_spec, dataset="planning-fy26"
    )
    assert result.validation_errors == ["264 rows exceed the limit of 100; aggregate to the pivot's leaf grain first"]
    result = make_service(tmp_path, FakeExporter(), provider, max_request_mb=0.01).export_pivot_report(
        planning_spec, dataset="planning-fy26"
    )
    assert result.validation_errors[0].startswith("request is 0.0 MiB") or "MiB" in result.validation_errors[0]


def test_json_directory_provider(tmp_path: Path) -> None:
    (tmp_path / "sales.rows.json").write_text('[{"a": 1}]')
    (tmp_path / "plan.json").write_text('[{"b": 2}]')
    (tmp_path / "plan.spec.json").write_text("{}")
    (tmp_path.parent / "secret.json").write_text('[{"s": 1}]')
    p = JsonDirectoryRowProvider(tmp_path)
    assert p.get_rows("sales") == [{"a": 1}]
    assert p.get_rows("plan") == [{"b": 2}]
    assert [d["id"] for d in p.list_datasets()] == ["plan", "sales"]
    for bad in ("../secret", "..", "/etc/passwd", "a/b", "", "secret"):
        with pytest.raises(UnknownDatasetError):
            p.get_rows(bad)
    golden = JsonDirectoryRowProvider(EXAMPLES)
    assert len(golden.get_rows("planning")) == 264


def test_from_env(tmp_path: Path) -> None:
    service = PivotReportService.from_env(
        {
            "NQGRID_EXPORT_URL": "http://127.0.0.1:9999",
            "NQGRID_REPORT_DIR": str(tmp_path),
            "NQGRID_DATASET_DIR": str(EXAMPLES),
            "NQGRID_EMAIL_OUTBOX": str(tmp_path / "outbox"),
            "NQGRID_EMAIL_ALLOWED_DOMAINS": "secolab.example, example.org",
        }
    )
    assert isinstance(service.exporter, NqgridExportClient) and service.exporter.base_url == "http://127.0.0.1:9999"
    assert service.allowed_recipient_domains == ["secolab.example", "example.org"]
    assert service.email_from == "reports@localhost.localdomain"
    assert isinstance(service.row_provider, JsonDirectoryRowProvider)


# --- in-process MCP client (needs the mcp SDK) ------------------------------------------------------


def _structured(result: Any) -> Any:
    value = getattr(result, "structured_content", None)
    return value if value is not None else getattr(result, "structuredContent", None)


async def _call_in_process(
    server: Any, calls: list[tuple[str, dict[str, Any]]], resource: str
) -> tuple[list[str], list[Any], str]:
    try:
        from mcp import Client  # mcp >= 2

        async with Client(server) as client:
            tools = [t.name for t in (await client.list_tools()).tools]
            results = [await client.call_tool(name, args) for name, args in calls]
            contents = (await client.read_resource(resource)).contents
    except ImportError:
        from mcp.shared.memory import create_connected_server_and_client_session  # mcp 1.x

        async with create_connected_server_and_client_session(server._mcp_server) as session:
            tools = [t.name for t in (await session.list_tools()).tools]
            results = [await session.call_tool(name, args) for name, args in calls]
            contents = (await session.read_resource(resource)).contents
    return tools, results, str(getattr(contents[0], "text", ""))


async def test_in_process_mcp_client(tmp_path: Path, provider: DictRowProvider, planning_spec: dict[str, Any]) -> None:
    pytest.importorskip("mcp", reason="the mcp SDK is not installed")
    sender = FakeSender()
    server = create_mcp_server(make_service(tmp_path, FakeExporter(), provider, sender))
    tools, (described, exported, invalid), schema_text = await _call_in_process(
        server,
        [
            ("describe_pivot_spec", {}),
            (
                "export_pivot_report",
                {"spec": planning_spec, "dataset": "planning-fy26", "email_to": ["ana@secolab.example"]},
            ),
            ("export_pivot_report", {"spec": {"version": 1}, "dataset": "planning-fy26"}),
        ],
        "nqgrid://pivot-spec/v1/schema",
    )
    assert {"export_pivot_report", "describe_pivot_spec"} <= set(tools)
    assert _structured(described)["datasets"][0]["id"] == "planning-fy26"
    ok = _structured(exported)
    assert ok["ok"] is True and ok["pages"] == 2 and ok["emailed"] is True and Path(ok["path"]).is_file()
    assert len(sender.messages) == 1
    bad = _structured(invalid)
    assert bad["ok"] is False and "spec: 'rows' is a required property" in bad["validation_errors"]
    assert json.loads(schema_text)["title"] == "PivotSpec"


# --- end to end ---------------------------------------------------------------------------------------


@pytest.mark.e2e
def test_end_to_end_pdf_report(
    tmp_path: Path, chromium: ExportService, provider: DictRowProvider, planning_spec: dict[str, Any]
) -> None:
    sender = FakeSender()
    with NqgridExportClient(chromium.url) as client:
        result = make_service(tmp_path, client, provider, sender).export_pivot_report(
            planning_spec, dataset="planning-fy26", email_to=["ana@secolab.example"], options={"theme": "light"}
        )
    assert result.ok, result
    assert result.path
    data = Path(result.path).read_bytes()
    assert data[:4] == b"%PDF"
    assert result.pages == pdf_page_count(data) >= 1
    (att,) = list(sender.messages[0].iter_attachments())
    assert att.get_content() == data
