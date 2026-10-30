"""Build ``PivotExportRequest`` JSON (``contract/pivot/v1/export-request.schema.json``) from Python.

Mirrors ``buildPivotExportRequest`` in ``@nqlib/nqgrid/core``. Specs and options may be plain dicts or
the generated Pydantic models; rows may contain ``Decimal`` / ``date`` / ``datetime`` / ``UUID`` /
``Enum`` values (typical database output), which are encoded as JSON numbers / ISO strings.
"""

from __future__ import annotations

import datetime as _dt
import decimal
import enum
import json
import uuid
from collections.abc import Mapping, Sequence
from typing import Any

from pydantic import BaseModel

from .formats import ExportFormat, check_format

SpecInput = Mapping[str, Any] | BaseModel
OptionsInput = Mapping[str, Any] | BaseModel
Rows = Sequence[Mapping[str, Any]]


def to_json_object(value: Mapping[str, Any] | BaseModel) -> dict[str, Any]:
    """A Pydantic model (only the fields that were set, so explicit ``None`` survives) or a mapping → dict."""
    if isinstance(value, BaseModel):
        dumped = value.model_dump(mode="json", exclude_unset=True, by_alias=True)
    else:
        dumped = dict(value)
    if not isinstance(dumped, dict):
        raise TypeError("expected a JSON object")
    return dumped


def build_export_request(
    spec: SpecInput,
    rows: Rows | None = None,
    *,
    format: ExportFormat | None = None,
    options: OptionsInput | None = None,
    dataset: str | None = None,
) -> dict[str, Any]:
    """``{spec, rows?, dataset?, format?, options?}``. Pass ``rows`` for nqgrid-export, or ``dataset`` for a backend."""
    if rows is None and not dataset:
        raise ValueError("pass rows or a dataset reference")
    request: dict[str, Any] = {"spec": to_json_object(spec)}
    if rows is not None:
        request["rows"] = [dict(r) for r in rows]
    if dataset:
        request["dataset"] = dataset
    if format is not None:
        request["format"] = check_format(format)
    if options is not None:
        opts = to_json_object(options)
        if opts:
            request["options"] = opts
    return request


def _json_default(value: object) -> object:
    if isinstance(value, decimal.Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, _dt.datetime | _dt.date | _dt.time):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json", exclude_unset=True, by_alias=True)
    if isinstance(value, set | frozenset | tuple):
        return list(value)
    raise TypeError(f"{type(value).__name__} is not JSON serializable")


def dumps_request(request: Mapping[str, Any]) -> bytes:
    """Compact UTF-8 JSON; ``NaN`` / ``Infinity`` are rejected (they are not JSON)."""
    return json.dumps(
        request, default=_json_default, ensure_ascii=False, allow_nan=False, separators=(",", ":")
    ).encode()
