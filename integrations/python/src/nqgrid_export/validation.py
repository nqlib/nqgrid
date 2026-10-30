"""Validate specs and export requests before they reach nqgrid-export.

Three layers, cheapest first:

1. JSON Schema (``contract/pivot/v1/*.schema.json``, shipped in this package) — structure.
2. Referential checks the schema cannot express (mirrors ``validatePivotSpec`` in nqgrid core):
   unknown measure ids in ``values`` / ``heat`` / ``headerCharts`` / ``kpis``, duplicate ids, and
   custom aggregators (not available in nqgrid-export).
3. nqgrid-export itself (authoritative): ``NqgridInvalidInput.details``.

Messages are short ``path: problem`` strings meant to be shown to an LLM agent.
"""

from __future__ import annotations

import json
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
    """``(path, field)`` for every row field a spec reads."""
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
