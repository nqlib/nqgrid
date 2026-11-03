"""Typed errors mapped from nqgrid-export's ``{"error": {"code", "message", "details?"}}`` JSON.

=====================  ===========================  ==========================
Exception              HTTP (serve mode)            CLI exit code
=====================  ===========================  ==========================
NqgridInvalidInput     400 ``invalid_input``         2
NqgridPayloadTooLarge  413 ``payload_too_large``     (n/a)
NqgridInternalError    500 ``internal`` / other      1 / other
NqgridUnavailable      connection error / timeout   binary missing / timeout
=====================  ===========================  ==========================

All of them derive from :class:`NqgridExportError`, so ``except NqgridExportError`` catches every
export failure. ``NqgridInvalidInput.details`` lists every spec / option problem at once; hand
them back to an LLM agent so it can fix its spec.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any


class NqgridExportError(Exception):
    """Base class for every nqgrid export failure."""

    code: str
    message: str
    details: list[str]
    status: int | None

    def __init__(
        self,
        message: str,
        details: Sequence[str] = (),
        *,
        code: str = "internal",
        status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.details = list(details)
        self.code = code
        self.status = status

    def __str__(self) -> str:
        if not self.details:
            return self.message
        return self.message + "".join(f"\n- {d}" for d in self.details)

    def to_dict(self) -> dict[str, Any]:
        """The wire shape: ``{"error": {"code", "message", "details?"}}``."""
        error: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details:
            error["details"] = list(self.details)
        return {"error": error}


class NqgridInvalidInput(NqgridExportError):
    """The spec, rows, options or format were rejected (HTTP 400 / exit 2). Fix the input; don't retry."""

    def __init__(
        self,
        message: str = "invalid export request",
        details: Sequence[str] = (),
        *,
        code: str = "invalid_input",
        status: int | None = None,
    ) -> None:
        super().__init__(message, details, code=code, status=status)


class NqgridPayloadTooLarge(NqgridInvalidInput):
    """The request body exceeded the service's ``--max-body-mb`` cap (HTTP 413). Send fewer rows."""

    def __init__(
        self, message: str = "request body too large", details: Sequence[str] = (), *, status: int | None = 413
    ) -> None:
        super().__init__(message, details, code="payload_too_large", status=status)


class NqgridInternalError(NqgridExportError):
    """The exporter failed (HTTP 500 / exit 1), e.g. Chromium could not start. Retrying may help."""


class NqgridUnavailable(NqgridExportError):
    """The exporter could not be reached: service down, timeout, or the CLI binary is missing."""

    def __init__(
        self, message: str, details: Sequence[str] = (), *, code: str = "unavailable", status: int | None = None
    ) -> None:
        super().__init__(message, details, code=code, status=status)


def error_from_payload(
    payload: Any, *, status: int | None = None, fallback: str = "export failed"
) -> NqgridExportError:
    """Map an ``{"error": {...}}`` object (HTTP body or the CLI's last stderr line) to an exception."""
    error = payload.get("error") if isinstance(payload, dict) else None
    if not isinstance(error, dict):
        return NqgridInternalError(fallback, code="internal", status=status)
    code = str(error.get("code") or "internal")
    message = str(error.get("message") or fallback)
    raw_details = error.get("details")
    details = [str(d) for d in raw_details] if isinstance(raw_details, list) else []
    if code == "payload_too_large" or status == 413:
        return NqgridPayloadTooLarge(message, details, status=status)
    if code == "invalid_input" or status == 400:
        return NqgridInvalidInput(message, details, code=code, status=status)
    return NqgridInternalError(message, details, code=code, status=status)


def error_from_response(status: int, body: bytes) -> NqgridExportError:
    """Map a non-200 HTTP response from ``nqgrid-export serve``."""
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        payload = None
    text = body[:200].decode("utf-8", "replace").strip()
    return error_from_payload(payload, status=status, fallback=f"HTTP {status}" + (f": {text}" if text else ""))
