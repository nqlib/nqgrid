"""One-shot CLI runner: the real ``nqgrid-export`` and stub commands for every exit-code path."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import pytest

from nqgrid_export import NqgridInternalError, NqgridInvalidInput, NqgridUnavailable, SubprocessExporter, pdf_page_count
from nqgrid_export.subprocess_exporter import resolve_command

from .conftest import GOLDEN_GENERATED_AT


def _stub(tmp_path: Path, code: int, stderr: str = "", stdout: str = "", sleep: float = 0) -> list[str]:
    script = tmp_path / f"stub_{code}.py"
    script.write_text(
        "import sys, time\n"
        "sys.stdin.read()\n"
        f"time.sleep({sleep})\n"
        f"sys.stdout.write({stdout!r})\n"
        f"sys.stderr.write({stderr!r})\n"
        f"sys.exit({code})\n"
    )
    return [sys.executable, str(script)]


def test_exit_2_is_invalid_input_with_details(tmp_path: Path) -> None:
    error = {
        "code": "invalid_input",
        "message": "invalid export request",
        "details": ["spec: version must be 1 (got 2)"],
    }
    err = "progress…\n" + json.dumps({"error": error}) + "\n"
    with pytest.raises(NqgridInvalidInput) as info:
        SubprocessExporter(_stub(tmp_path, 2, err)).export({"version": 2}, [], format="pdf")
    assert info.value.details == ["spec: version must be 1 (got 2)"]


def test_exit_1_is_internal(tmp_path: Path) -> None:
    err = '{"error":{"code":"internal","message":"PDF export needs Playwright"}}\n'
    with pytest.raises(NqgridInternalError, match="needs Playwright"):
        SubprocessExporter(_stub(tmp_path, 1, err)).export({"version": 1}, [])


def test_other_exit_codes_and_non_json_stderr(tmp_path: Path) -> None:
    with pytest.raises(NqgridInternalError) as info:
        SubprocessExporter(_stub(tmp_path, 137, "Killed")).export({"version": 1}, [])
    assert info.value.code == "exit_137"
    assert "Killed" in str(info.value)
    with pytest.raises(NqgridInvalidInput, match="usage: bad flag"):
        SubprocessExporter(_stub(tmp_path, 2, "usage: bad flag")).export({"version": 1}, [])


def test_success_returns_stdout(tmp_path: Path) -> None:
    exporter = SubprocessExporter(_stub(tmp_path, 0, stdout='{"cells": []}'))
    assert exporter.export({"version": 1}, [], format="sheet") == {"cells": []}


def test_timeout_and_missing_binary(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(NqgridUnavailable) as info:
        SubprocessExporter(_stub(tmp_path, 0, sleep=5), timeout=0.5).export({"version": 1}, [])
    assert info.value.code == "timeout"
    with pytest.raises(NqgridUnavailable) as missing:
        SubprocessExporter([str(tmp_path / "nope")]).export({"version": 1}, [])
    assert missing.value.code == "not_installed"
    monkeypatch.delenv("NQGRID_EXPORT_BIN", raising=False)
    monkeypatch.setenv("PATH", str(tmp_path))
    with pytest.raises(NqgridUnavailable, match="NQGRID_EXPORT_BIN"):
        resolve_command()
    monkeypatch.setenv("NQGRID_EXPORT_BIN", "node '/opt/nqgrid export/cli.js'")
    assert resolve_command() == ["node", "/opt/nqgrid export/cli.js"]


# --- end to end: the real CLI ---------------------------------------------------------------------


@pytest.mark.e2e
def test_real_cli(
    cli_command: list[str],
    planning_spec: dict[str, Any],
    planning_rows: list[dict[str, Any]],
    planning_model: dict[str, Any],
    planning_sheet: dict[str, Any],
) -> None:
    exporter = SubprocessExporter(cli_command, timeout=120)
    assert exporter.health()["version"]
    assert exporter.export(planning_spec, planning_rows, format="model") == planning_model
    assert exporter.export(planning_spec, planning_rows, format="sheet") == planning_sheet
    assert exporter.export(planning_spec, planning_rows, format="xlsx")[:2] == b"PK"


@pytest.mark.e2e
def test_real_cli_invalid_input(cli_command: list[str], planning_spec: dict[str, Any]) -> None:
    with pytest.raises(NqgridInvalidInput) as info:
        SubprocessExporter(cli_command).export(
            {**planning_spec, "values": ["nope"]}, [{}], format="xlsx", options={"css": "x"}
        )
    assert any('unknown measure "nope"' in d for d in info.value.details)
    assert any("options.css is not accepted" in d for d in info.value.details)


@pytest.mark.e2e
def test_real_cli_pdf(
    cli_command: list[str], chromium: Any, planning_spec: dict[str, Any], planning_rows: list[dict[str, Any]]
) -> None:
    pdf = SubprocessExporter(cli_command, timeout=120).export(
        planning_spec, planning_rows, options={"generatedAt": GOLDEN_GENERATED_AT}
    )
    assert pdf[:4] == b"%PDF"
    assert pdf_page_count(pdf) >= 1
