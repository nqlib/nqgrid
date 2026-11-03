"""Validate specs and export requests before they reach nqgrid-export.

Three layers, cheapest first:

1. JSON Schema (``contract/pivot/v1/*.schema.json``, shipped in this package) — structure.
2. Referential checks the schema cannot express (mirrors ``validatePivotSpec`` in nqgrid core):
   unknown measure ids in ``values`` / ``heat`` / ``headerCharts`` / ``kpis`` / ``sortBy`` / ``topN``,
   ``sortBy`` / ``topN`` on column dimensions, a field used twice across ``rows`` and ``columns`` (a
   dimension or a list of dimensions), duplicate measure ids, facets and catalogue fields, date-grouping
   entries (``source`` + ``dateGroup``), calculated measures (expression grammar via
   :mod:`nqgrid_export.calc`, unknown references, reference cycles), ``showAsBase`` (required by the
   difference / running-total / rank kinds of ``showAs``, must name a row or column field), and custom
   aggregators (not available in nqgrid-export).
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

from .calc import find_cycles, parse_calc

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


def dates_example_spec() -> dict[str, Any]:
    """The golden ``planning-dates.spec.json`` example (``orderDate`` by fiscal year → quarter, FY25 collapsed)."""
    return _load("planning-dates.spec.json")


def multicol_example_spec() -> dict[str, Any]:
    """The golden ``planning-multicol.spec.json`` example (Region → Channel columns, subtotals, % of parent column)."""
    return _load("planning-multicol.spec.json")


def calc_example_spec() -> dict[str, Any]:
    """The golden ``planning-calc.spec.json`` example (calculated measure, % difference from previous year,
    % running total, distinct count, department subtotals at the bottom)."""
    return _load("planning-calc.spec.json")


SHOW_AS_WITH_BASE = (
    "differenceFrom",
    "percentDifferenceFrom",
    "runningTotal",
    "percentRunningTotal",
    "rankAscending",
    "rankDescending",
)


DATE_GROUPS = ("year", "quarter", "month", "week", "day", "yearMonth", "yearQuarter")


def column_dimensions(spec: Mapping[str, Any]) -> list[tuple[str, Any]]:
    """``(path, dimension)`` for ``columns``: a single dimension (``"columns"``) or a list (``"columns[i]"``)."""
    columns = spec.get("columns")
    if isinstance(columns, list):
        return [(f"columns[{i}]", d) for i, d in enumerate(columns)]
    return [("columns", columns)] if columns is not None else []


def date_field_source(spec: Mapping[str, Any], field: str) -> str | None:
    """The record field a derived date field reads (``orderDate:year`` → ``orderDate``), else ``None``.

    Mirrors ``resolvePivotDateField``: a ``fields`` entry with ``source`` + ``dateGroup``, or a name
    ``<source>:<group>`` without a non-date catalogue entry of its own.
    """
    entries = [f for f in spec.get("fields") or [] if isinstance(f, dict)]
    own = next((f for f in entries if f.get("field") == field), None)
    if own is not None and isinstance(own.get("source"), str) and own.get("dateGroup") in DATE_GROUPS:
        return str(own["source"])
    if own is not None and own.get("dateGroup") is None and own.get("type") not in (None, "date"):
        return None
    source, sep, group = field.rpartition(":")
    return source if sep and source and group in DATE_GROUPS else None


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
    # A calculated measure with field / aggregate (dependentSchemas) gets a clearer referential message.
    errors = sorted(
        (e for e in validator.iter_errors(instance) if "dependentSchemas" not in e.absolute_schema_path),
        key=lambda e: [str(p) for p in e.absolute_path],
    )
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
    used: dict[str, str] = {}
    for i, d in enumerate(spec.get("rows") or []):
        if not isinstance(d, dict):
            continue
        for key in ("sortBy", "topN"):
            if isinstance(d.get(key), dict):
                ref(d[key].get("measure"), f"rows[{i}].{key}.measure")
        if isinstance(d.get("field"), str):
            used.setdefault(d["field"], f"rows[{i}]")
    for where, d in column_dimensions(spec):
        if not isinstance(d, dict):
            continue
        for key in ("sortBy", "topN"):
            if key in d:
                errors.append(f"{prefix}{where}.{key} is only supported on row dimensions")
        field = d.get("field")
        if isinstance(field, str):
            if field in used:
                errors.append(f"{prefix}{where}.field {field!r} is already used by {used[field]}")
            else:
                used[field] = where
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
            if ("source" in f) != ("dateGroup" in f):
                errors.append(f"{prefix}fields[{i}]: source and dateGroup go together")
            if f.get("source") is not None and f.get("source") == f["field"]:
                errors.append(f"{prefix}fields[{i}].source must differ from field")
    errors += _measure_errors(spec, prefix, ids, set(used))
    return errors


def _measure_errors(spec: dict[str, Any], prefix: str, ids: set[str], layout_fields: set[str]) -> list[str]:
    """Calculated measures (grammar, references, cycles) and ``showAsBase``; same messages as nqgrid."""
    errors: list[str] = []
    refs: dict[str, list[str]] = {}
    where_of: dict[str, str] = {}
    for i, m in enumerate(spec.get("measures") or []):
        if not isinstance(m, dict) or not isinstance(m.get("id"), str):
            continue
        where = f"{prefix}measures[{i}]"
        needs_base = m.get("showAs") in SHOW_AS_WITH_BASE or m.get("groupShowAs") in SHOW_AS_WITH_BASE
        base = m.get("showAsBase")
        if base is None and needs_base:
            errors.append(f"{where}.showAsBase is required by its showAs / groupShowAs")
        elif isinstance(base, dict) and isinstance(base.get("field"), str) and base["field"] not in layout_fields:
            errors.append(f'{where}.showAsBase.field "{base["field"]}" is not a row or column field')
        if "calculate" not in m:
            continue
        if "field" in m or "aggregate" in m:
            errors.append(f"{where}: calculate cannot be combined with field or aggregate")
        parsed = parse_calc(m["calculate"], ids)
        if parsed.error is not None:
            errors.append(f"{where}.calculate: {parsed.error.message} (at {parsed.error.position})")
            continue
        refs[m["id"]] = list(parsed.references)
        where_of.setdefault(m["id"], where)
    for cycle in find_cycles(refs):
        errors.append(f"{where_of.get(cycle[0], prefix + 'measures')}.calculate: reference cycle {' → '.join(cycle)}")
    return errors


def check_calculated_measure(spec: Mapping[str, Any], calculate: Any, measure_id: str | None = None) -> str | None:
    """Problem with an expression for the calculated measure ``measure_id`` (new or existing) in ``spec``,
    or ``None`` when valid. Mirrors ``checkPivotCalculatedMeasure`` (grammar, known measures, cycles incl. itself)."""
    measures = [m for m in spec.get("measures") or [] if isinstance(m, dict) and isinstance(m.get("id"), str)]
    ids = {m["id"] for m in measures} | ({measure_id} if measure_id is not None else set())
    parsed = parse_calc(calculate, ids)
    if parsed.error is not None:
        return str(parsed.error)
    if measure_id is None:
        return None
    refs = {
        m["id"]: list(p.references)
        for m in measures
        if m["id"] != measure_id and "calculate" in m
        for p in [parse_calc(m["calculate"])]
        if p.error is None
    }
    refs[measure_id] = list(parsed.references)
    cycle = next((c for c in find_cycles(refs) if measure_id in c), None)
    return f"reference cycle {' → '.join(cycle)}" if cycle else None


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
    """``(path, field)`` for every row field a spec reads (dimensions, measures, filters, facets).

    Derived date fields (``orderDate:year``) report the record field they read (``orderDate``).
    """
    out: list[tuple[str, str]] = []
    dims = [(f"rows[{i}]", d) for i, d in enumerate(spec.get("rows") or [])] + column_dimensions(spec)

    def key_field(field: str) -> str:
        return date_field_source(spec, field) or field

    for where, d in dims:
        if isinstance(d, dict):
            if isinstance(d.get("field"), str):
                out.append((f"{where}.field", key_field(d["field"])))
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
            out.append((f"filters[{i}].field", key_field(f["field"])))
    for i, f in enumerate(spec.get("facets") or []):
        field = f if isinstance(f, str) else f.get("field") if isinstance(f, dict) else None
        if isinstance(field, str):
            out.append((f"facets[{i}]", key_field(field)))
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
