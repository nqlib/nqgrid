"""Shared fixtures: golden contract files and a real ``nqgrid-export serve`` on a free port.

End-to-end tests need ``node`` and the built CLI (``pnpm build && pnpm --filter @nqlib/nqgrid-export build``);
PDF tests additionally need Playwright Chromium (the service reports ``browser: "unavailable"`` otherwise).
Both skip cleanly when missing. Set ``NQGRID_EXPORT_CLI`` to use another ``cli.js``.
"""

from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import time
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import pytest

REPO = Path(__file__).resolve().parents[3]
CONTRACT = REPO / "contract" / "pivot" / "v1"
EXAMPLES = CONTRACT / "examples"
CLI_JS = Path(os.environ.get("NQGRID_EXPORT_CLI", REPO / "packages" / "nqgrid-export" / "dist" / "cli.js"))
GOLDEN_GENERATED_AT = "2026-01-15 09:30 UTC"


def load_example(name: str) -> Any:
    return json.loads((EXAMPLES / name).read_text("utf-8"))


@pytest.fixture(scope="session")
def planning_spec() -> dict[str, Any]:
    return load_example("planning.spec.json")


@pytest.fixture(scope="session")
def planning_rows() -> list[dict[str, Any]]:
    return load_example("planning.rows.json")


@pytest.fixture(scope="session")
def planning_model() -> dict[str, Any]:
    return load_example("planning.model.json")


@pytest.fixture(scope="session")
def planning_sheet() -> dict[str, Any]:
    return load_example("planning.sheet.json")


@pytest.fixture(scope="session")
def planning_request() -> dict[str, Any]:
    return load_example("planning.request.json")


def _cli_skip_reason() -> str | None:
    if shutil.which("node") is None:
        return "node is not installed"
    if not CLI_JS.is_file():
        return f"nqgrid-export is not built ({CLI_JS}); run pnpm build && pnpm --filter @nqlib/nqgrid-export build"
    return None


@pytest.fixture(scope="session")
def cli_command() -> list[str]:
    """``["node", ".../dist/cli.js"]`` or skip."""
    reason = _cli_skip_reason()
    if reason:
        pytest.skip(reason)
    return [shutil.which("node") or "node", str(CLI_JS)]


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        port: int = s.getsockname()[1]
        return port


@dataclass(frozen=True)
class ExportService:
    url: str
    health: dict[str, Any]

    @property
    def chromium(self) -> bool:
        return self.health.get("browser") == "ready"


@pytest.fixture(scope="session")
def export_service(cli_command: list[str], tmp_path_factory: pytest.TempPathFactory) -> Iterator[ExportService]:
    """``nqgrid-export serve`` on 127.0.0.1:<free port>, waited on via ``/healthz`` (and the warm browser)."""
    port = _free_port()
    log = (tmp_path_factory.mktemp("serve") / "serve.log").open("wb")
    proc = subprocess.Popen(
        [*cli_command, "serve", "--port", str(port), "--host", "127.0.0.1", "--max-body-mb", "2"],
        stdout=log,
        stderr=subprocess.STDOUT,
    )
    url = f"http://127.0.0.1:{port}"
    health: dict[str, Any] = {}
    try:
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                pytest.fail(f"nqgrid-export serve exited with {proc.returncode}; see {log.name}")
            try:
                health = httpx.get(f"{url}/healthz", timeout=2).json()
                if health.get("browser") not in ("cold", "starting"):
                    break
            except httpx.TransportError:
                pass
            time.sleep(0.2)
        else:
            pytest.fail(f"nqgrid-export serve did not become healthy: {health}")
        yield ExportService(url=url, health=health)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        log.close()


@pytest.fixture
def chromium(export_service: ExportService) -> ExportService:
    """The service, or skip when it has no working Chromium (PDF tests)."""
    if not export_service.chromium:
        pytest.skip(f"Chromium unavailable in nqgrid-export (browser={export_service.health.get('browser')!r})")
    return export_service
