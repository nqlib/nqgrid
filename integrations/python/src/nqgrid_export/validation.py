"""Validate specs and export requests before they reach nqgrid-export.

Three layers, cheapest first:

1. JSON Schema (``contract/pivot/v1/*.schema.json``, shipped in this package) — structure.
2. Referential checks the schema cannot express (mirrors ``validatePivotSpec`` in nqgrid core):
   unknown measure ids in ``values`` / ``heat`` / ``headerCharts`` / ``kpis`` / ``sortBy`` / ``topN``,
   ``sortBy`` / ``topN`` on the column dimension, duplicate measure ids, facets and catalogue fields,
   and custom aggregators (not available in nqgrid-export).
3. nqgrid-export itself (authoritative): ``NqgridInvalidInput.details``.

Messages are short ``path: problem`` strings meant to be shown to an LLM agent.
"""

from __future__ import annotations

import datetime as _dt
import json
import math
import re
from collections.abc import Mapping, Sequence
from functools import cache
from importlib.resources import files
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError, best_match
from referencing import Registry, Resource

PIVOT_SPEC_SCHEMA_ID = "https://github.com/nqlib/nqgrid/contract/pivot/v1/pivot-spec.schema.json"
EXPORT_REQUEST_SCHEMA_ID = "https://github.com/nqlib/nqgrid/contract/pivot/v1/export-request.schema.json"


@cache
def _load(name: str) -> dict[str, Any]:
    data = json.loads(files("nqgrid_export").joinpath("schemas").joinpath(name).read_text("utf-8"))
    if not isinstance(data, dict):
        raise TypeError(f"{name} is not a JSON object")
    return data


def pivot_spec_schema() -> dict[str, Any]:
    """``pivot-spec.schema.json`` (JSON Schema 2020-12)."""
    return _load("pivot-spec.schema.json")


def export_request_schema() -> dict[str, Any]:
    """``export-request.schema.json``; its ``spec`` ``$ref``s the pivot spec schema by ``$id``."""
    return _load("export-request.schema.json")


def export_options_schema() -> dict[str, Any]:
    """The ``options`` sub-schema of the export request, self-contained (for prompts / tool docs)."""
    defs = export_request_schema()["$defs"]
    return {"$schema": "https://json-schema.org/draft/2020-12/schema", **defs["options"], "$defs": defs}


def example_spec() -> dict[str, Any]:
    """The golden ``planning.spec.json`` example."""
    return _load("planning.spec.json")


def filtered_example_spec() -> dict[str, Any]:
    """The golden ``planning-filtered.spec.json`` example (filters, label filter, Top N + Other, sortBy, facets)."""
    return _load("planning-filtered.spec.json")


def fields_example_spec() -> dict[str, Any]:
    """The golden ``planning-fields.spec.json`` example (field catalogue, Σ Values outermost, report filter)."""
    return _load("planning-fields.spec.json")


@cache
def _registry() -> Registry[Any]:
    resources = [(s["$id"], Resource.from_contents(s)) for s in (pivot_spec_schema(), export_request_schema())]
    return Registry().with_resources(resources)


@cache
def _validator(schema_id: str) -> Draft202012Validator:
    schema = {"$ref": schema_id} if "#" in schema_id else _registry()[schema_id].contents
    return Draft202012Validator(schema, registry=_registry())


def _path(prefix: str, error: ValidationError) -> str:
    out = prefix
    for part in error.absolute_path:
        out += f"[{part}]" if isinstance(part, int) else (f".{part}" if out else str(part))
    return out or "(root)"


def _message(error: ValidationError) -> str:
    if error.validator in ("oneOf", "anyOf") and error.context:
        # e.g. an aggregate matching none of its variants: report the closest variant's problem
        # instead of repeating the (possibly large) instance.
        best = best_match(error.context)
        rel = "".join(f"[{p}]" if isinstance(p, int) else f".{p}" for p in best.relative_path).lstrip(".")
        return f"matches none of the allowed forms; closest: {rel + ': ' if rel else ''}{best.message!s}"
    if error.validator == "additionalProperties":
        return str(error.message).replace("Additional properties are not allowed", "unknown key(s)")
    return str(error.message)


def _schema_errors(validator: Draft202012Validator, instance: Any, prefix: str) -> list[str]:
    errors = sorted(validator.iter_errors(instance), key=lambda e: [str(p) for p in e.absolute_path])
    return [f"{_path(prefix, e)}: {_message(e)}" for e in errors]


def _referential_errors(spec: dict[str, Any], prefix: str) -> list[str]:
    errors: list[str] = []
    ids: set[str] = set()
    for i, m in enumerate(spec.get("measures") or []):
        if not isinstance(m, dict) or not isinstance(m.get("id"), str):
            continue
        if m["id"] in ids:
            errors.append(f"{prefix}measures[{i}].id {m['id']!r} is duplicated")
        ids.add(m["id"])
        agg = m.get("aggregate")
        if isinstance(agg, dict) and agg.get("type") == "custom":
            errors.append(
                f"{prefix}measures[{i}] uses custom aggregator {agg.get('name')!r}, which nqgrid-export cannot run"
            )

    def ref(value: Any, where: str) -> None:
        if value is not None and value not in ids:
            errors.append(f"{prefix}{where} references unknown measure {value!r} (measures: {', '.join(sorted(ids))})")

    for i, v in enumerate(spec.get("values") or []):
        ref(v, f"values[{i}]")
    for key in ("heat", "headerCharts"):
        block = spec.get(key)
        if isinstance(block, dict):
            ref(block.get("measure"), f"{key}.measure")
    for i, k in enumerate(spec.get("kpis") or []):
        if isinstance(k, dict):
            ref(k.get("measure"), f"kpis[{i}].measure")
            ref(k.get("compareTo"), f"kpis[{i}].compareTo")
    for i, d in enumerate(spec.get("rows") or []):
        if not isinstance(d, dict):
            continue
        for key in ("sortBy", "topN"):
            if isinstance(d.get(key), dict):
                ref(d[key].get("measure"), f"rows[{i}].{key}.measure")
    columns = spec.get("columns")
    if isinstance(columns, dict):
        for key in ("sortBy", "topN"):
            if key in columns:
                errors.append(f"{prefix}columns.{key} is only supported on row dimensions")
    seen: set[str] = set()
    for i, f in enumerate(spec.get("facets") or []):
        field = f if isinstance(f, str) else f.get("field") if isinstance(f, dict) else None
        if isinstance(field, str):
            if field in seen:
                errors.append(f"{prefix}facets[{i}] {field!r} is duplicated")
            seen.add(field)
    catalogued: set[str] = set()
    for i, f in enumerate(spec.get("fields") or []):
        if isinstance(f, dict) and isinstance(f.get("field"), str):
            if f["field"] in catalogued:
                errors.append(f"{prefix}fields[{i}] {f['field']!r} is duplicated")
            catalogued.add(f["field"])
    return errors


def validate_pivot_spec(spec: Any, *, prefix: str = "") -> list[str]:
    """Every problem with a spec (``[]`` when valid). ``prefix`` is prepended to paths (e.g. ``"spec."``)."""
    if not isinstance(spec, dict):
        return [f"{prefix.rstrip('.') or 'spec'}: must be an object"]
    errors = _schema_errors(_validator(PIVOT_SPEC_SCHEMA_ID), spec, prefix.rstrip("."))
    return errors + _referential_errors(spec, prefix)


def validate_export_options(options: Any) -> list[str]:
    """Problems with render ``options`` (raw ``css`` / unknown keys are rejected)."""
    if options is None:
        return []
    return _schema_errors(_validator(f"{EXPORT_REQUEST_SCHEMA_ID}#/$defs/options"), options, "options")


def validate_export_request(request: Any) -> list[str]:
    """Problems with a whole ``{spec, rows | dataset, format?, options?}`` request."""
    if not isinstance(request, dict):
        return ["request: must be an object"]
    errors = _schema_errors(_validator(EXPORT_REQUEST_SCHEMA_ID), request, "")
    if isinstance(request.get("spec"), dict):
        errors += _referential_errors(request["spec"], "spec.")
    return errors


def spec_fields(spec: dict[str, Any]) -> list[tuple[str, str]]:
    """``(path, field)`` for every row field a spec reads (dimensions, measures, filters, facets)."""
    out: list[tuple[str, str]] = []
    dims = [(f"rows[{i}]", d) for i, d in enumerate(spec.get("rows") or [])]
    if isinstance(spec.get("columns"), dict):
        dims.append(("columns", spec["columns"]))
    for where, d in dims:
        if isinstance(d, dict):
            if isinstance(d.get("field"), str):
                out.append((f"{where}.field", d["field"]))
            for j, a in enumerate(d.get("attributes") or []):
                if isinstance(a, str):
                    out.append((f"{where}.attributes[{j}]", a))
    for i, m in enumerate(spec.get("measures") or []):
        if not isinstance(m, dict):
            continue
        if isinstance(m.get("field"), str):
            out.append((f"measures[{i}].field", m["field"]))
        agg = m.get("aggregate")
        if isinstance(agg, dict):
            for key in ("weightField", "numeratorField", "denominatorField"):
                if isinstance(agg.get(key), str):
                    out.append((f"measures[{i}].aggregate.{key}", agg[key]))
    for i, f in enumerate(spec.get("filters") or []):
        if isinstance(f, dict) and isinstance(f.get("field"), str):
            out.append((f"filters[{i}].field", f["field"]))
    for i, f in enumerate(spec.get("facets") or []):
        field = f if isinstance(f, str) else f.get("field") if isinstance(f, dict) else None
        if isinstance(field, str):
            out.append((f"facets[{i}]", field))
    return out


def check_fields(spec: dict[str, Any], rows: list[dict[str, Any]], *, sample: int = 1000) -> list[str]:
    """Spec fields that no row has (``[]`` for empty rows). Catches typos an agent would otherwise
    only notice as an all-blank report."""
    if not rows:
        return []
    present: set[str] = set()
    for row in rows[:sample]:
        present.update(row.keys())
    return [
        f"spec.{where}: rows have no field {field!r} (fields: {', '.join(sorted(present))})"
        for where, field in spec_fields(spec)
        if field not in present
    ]


# ---------------------------------------------------------------------------------------------
# Field catalogue (mirrors inferPivotFields / humanizePivotField in nqgrid core)
# ---------------------------------------------------------------------------------------------

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$")


def humanize_pivot_field(field: str) -> str:
    """``priorYear`` → ``Prior Year``, ``unit_price`` → ``Unit Price`` (same as ``humanizePivotField``)."""
    text = re.sub(r"[_\-.]+", " ", field)
    text = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", text).strip()
    words = [w[0].upper() + w[1:] for w in text.split() if w]
    return " ".join(words) or field


def _key(value: Any) -> str:
    """JS ``String(value)`` for the values JSON can carry (``2.0`` → ``"2"``, ``True`` → ``"true"``)."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, (_dt.date, _dt.datetime)):
        return value.isoformat()
    return str(value)


def infer_pivot_fields(rows: Sequence[Mapping[str, Any]], *, sample: int = 500) -> list[dict[str, Any]]:
    """Sample-based field catalogue ``[{"field", "label", "type"}]``, identical to nqgrid's ``inferPivotFields``.

    Types: ``measure`` (numbers), ``number`` (integers with ≤ 12 distinct values, e.g. a year), ``date``
    (dates or ISO-8601 strings), ``text`` (> 50 distinct, mostly unique strings), else ``dimension``.
    ``sample`` records are read, spread evenly over ``rows``.
    """
    sample = max(1, int(sample))
    n = len(rows)
    step = 1.0 if n <= sample else n / sample
    stats: dict[str, dict[str, Any]] = {}
    s = 0
    i = 0
    while i < n and s < sample:
        for field, v in rows[i].items():
            st = stats.setdefault(field, {"values": 0, "numbers": 0, "integers": 0, "dates": 0, "distinct": set()})
            if v is None or v == "":
                continue
            st["values"] += 1
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                if math.isfinite(v):
                    st["numbers"] += 1
                    if float(v).is_integer():
                        st["integers"] += 1
            elif isinstance(v, (_dt.date, _dt.datetime)) or (isinstance(v, str) and _ISO_DATE.match(v)):
                st["dates"] += 1
            if len(st["distinct"]) <= 1000:
                st["distinct"].add(_key(v))
        s += 1
        i = math.floor(s * step)
    out: list[dict[str, Any]] = []
    for field, st in stats.items():
        values, distinct = st["values"], len(st["distinct"])
        kind = "dimension"
        if values > 0 and st["numbers"] == values:
            kind = "number" if st["integers"] == values and distinct <= 12 and values >= 2 * distinct else "measure"
        elif values > 0 and st["dates"] == values:
            kind = "date"
        elif distinct > 50 and distinct > values / 2:
            kind = "text"
        out.append({"field": field, "label": humanize_pivot_field(field), "type": kind})
    return out
