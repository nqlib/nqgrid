"""One-shot exporter: runs ``nqgrid-export --input - --format <f> --out -`` per call.

No service to run, but every PDF launches Chromium (~1 s). Use it for batch jobs, cron reports and
low volume; prefer :class:`~nqgrid_export.client.NqgridExportClient` + ``serve`` for interactive use.

The command defaults to ``$NQGRID_EXPORT_BIN`` (shell-split, e.g. ``node /opt/nqgrid-export/dist/cli.js``)
or ``nqgrid-export`` on ``PATH``. Exit codes map to the same exceptions as HTTP statuses:
``2`` → :class:`NqgridInvalidInput`, ``1`` → :class:`NqgridInternalError`.
"""

from __future__ import annotations

import json
import os
import shlex
import shutil
import subprocess
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from .errors import NqgridExportError, NqgridInternalError, NqgridInvalidInput, NqgridUnavailable, error_from_payload
from .exporter import PivotExporter
from .formats import EXPORT_FORMATS, ExportFormat

DEFAULT_SUBPROCESS_TIMEOUT = 120.0


def resolve_command(command: Sequence[str] | str | None = None) -> list[str]:
    """Explicit command → ``$NQGRID_EXPORT_BIN`` → ``nqgrid-export`` on ``PATH``."""
    if isinstance(command, str):
        return shlex.split(command)
    if command:
        return list(command)
    env = os.environ.get("NQGRID_EXPORT_BIN")
    if env:
        return shlex.split(env)
    found = shutil.which("nqgrid-export")
    if not found:
        raise NqgridUnavailable(
            "nqgrid-export not found: set NQGRID_EXPORT_BIN or put nqgrid-export on PATH", code="not_installed"
        )
    return [found]


def _stderr_error(code: int, stderr: bytes) -> NqgridExportError:
    lines = [ln for ln in stderr.decode("utf-8", "replace").splitlines() if ln.strip()]
    payload: Any = None
    if lines:
        try:
            payload = json.loads(lines[-1])
        except json.JSONDecodeError:
            payload = None
    tail = lines[-1] if lines else ""
    if code == 2:
        mapped = error_from_payload(payload, fallback=tail or "invalid export request")
        if isinstance(mapped, NqgridInvalidInput):
            return mapped
        return NqgridInvalidInput(mapped.message, mapped.details)
    if code == 1:
        mapped = error_from_payload(payload, fallback=tail or "nqgrid-export failed")
        return NqgridInternalError(mapped.message, mapped.details, code=mapped.code)
    return NqgridInternalError(f"nqgrid-export exited with {code}" + (f": {tail}" if tail else ""), code=f"exit_{code}")


class SubprocessExporter(PivotExporter):
    """Same interface as :class:`~nqgrid_export.client.NqgridExportClient`, one process per export."""

    def __init__(
        self,
        command: Sequence[str] | str | None = None,
        *,
        timeout: float = DEFAULT_SUBPROCESS_TIMEOUT,
        env: Mapping[str, str] | None = None,
        cwd: str | Path | None = None,
    ) -> None:
        self._command = command
        self.timeout = timeout
        self.env = dict(env) if env is not None else None
        self.cwd = cwd

    @property
    def command(self) -> list[str]:
        return resolve_command(self._command)

    def _run(self, args: Sequence[str], stdin: bytes | None) -> subprocess.CompletedProcess[bytes]:
        argv = [*self.command, *args]
        try:
            return subprocess.run(
                argv,
                input=stdin,
                capture_output=True,
                timeout=self.timeout,
                env={**os.environ, **self.env} if self.env is not None else None,
                cwd=self.cwd,
                check=False,
            )
        except FileNotFoundError as e:
            raise NqgridUnavailable(f"cannot run {argv[0]!r}: {e}", code="not_installed") from e
        except subprocess.TimeoutExpired as e:
            raise NqgridUnavailable(f"nqgrid-export timed out after {self.timeout:g} s", code="timeout") from e

    def _export_bytes(self, body: bytes, fmt: ExportFormat) -> bytes:
        proc = self._run(["--input", "-", "--format", fmt, "--out", "-"], body)
        if proc.returncode != 0:
            raise _stderr_error(proc.returncode, proc.stderr)
        return proc.stdout

    def health(self) -> dict[str, Any]:
        """``nqgrid-export --version``; the browser is only checked by an actual PDF export."""
        proc = self._run(["--version"], None)
        if proc.returncode != 0:
            raise _stderr_error(proc.returncode, proc.stderr)
        return {
            "ok": True,
            "version": proc.stdout.decode().strip(),
            "browser": "unknown",
            "formats": list(EXPORT_FORMATS),
        }
