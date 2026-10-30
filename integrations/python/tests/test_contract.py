"""Contract tests against ``contract/pivot/v1``: JSON Schema (jsonschema), Pydantic models, validators."""

from __future__ import annotations

import copy
import json
from typing import Any

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError
from referencing import Registry, Resource

from nqgrid_export import (
    PivotExportRequest,
    PivotSpec,
    build_export_request,
    check_fields,
    validate_export_options,
    validate_export_request,
    validate_pivot_spec,
)
from nqgrid_export.models import Options, RatioAggregate
from nqgrid_export.request import dumps_request
from nqgrid_export.validation import example_spec

from .conftest import CONTRACT, EXAMPLES, load_example

SPEC_SCHEMA = json.loads((CONTRACT / "pivot-spec.schema.json").read_text())
REQUEST_SCHEMA = json.loads((CONTRACT / "export-request.schema.json").read_text())
REGISTRY: Registry[Any] = Registry().with_resource(SPEC_SCHEMA["$id"], Resource.from_contents(SPEC_SCHEMA))
spec_validator = Draft202012Validator(SPEC_SCHEMA)
request_validator = Draft202012Validator(REQUEST_SCHEMA, registry=REGISTRY)

MINIMAL = {"version": 1, "rows": [{"field": "a"}], "measures": [{"id": "m", "field": "v"}]}

# Rejected by the JSON Schema, the Pydantic models and validate_pivot_spec.
INVALID_SPECS: dict[str, dict[str, Any]] = {
    "wrong version": {**MINIMAL, "version": 2},
    "no rows": {**MINIMAL, "rows": []},
    "row without field": {**MINIMAL, "rows": [{"label": "x"}]},
    "no measures": {**MINIMAL, "measures": []},
    "bad aggregate": {**MINIMAL, "measures": [{"id": "m", "field": "v", "aggregate": "median"}]},
    "ratio missing denominator": {
        **MINIMAL,
        "measures": [{"id": "m", "aggregate": {"type": "ratio", "numeratorField": "a"}}],
    },
    "bad showAs": {**MINIMAL, "measures": [{"id": "m", "field": "v", "showAs": "percentOfEverything"}]},
    "bad expanded": {**MINIMAL, "expanded": [[1]]},
    "bad heat scope": {**MINIMAL, "heat": {"scope": "diagonal"}},
    "bad heat levels": {**MINIMAL, "heat": {"levels": 1}},
    "unknown key": {**MINIMAL, "css": "body{}"},
    "bad currency": {
        **MINIMAL,
        "measures": [{"id": "m", "field": "v", "format": {"style": "currency", "currency": "US"}}],
    },
}


def test_schema_copies_in_the_package_match_the_contract() -> None:
    from importlib.resources import files

    pkg = files("nqgrid_export").joinpath("schemas")
    for name in ("pivot-spec.schema.json", "export-request.schema.json"):
        assert json.loads(pkg.joinpath(name).read_text("utf-8")) == json.loads((CONTRACT / name).read_text()), name
    assert example_spec() == load_example("planning.spec.json")


def test_schemas_are_valid_2020_12() -> None:
    Draft202012Validator.check_schema(SPEC_SCHEMA)
    Draft202012Validator.check_schema(REQUEST_SCHEMA)


def test_golden_spec_validates_everywhere(planning_spec: dict[str, Any]) -> None:
    assert list(spec_validator.iter_errors(planning_spec)) == []
    assert validate_pivot_spec(planning_spec) == []
    model = PivotSpec.model_validate(planning_spec)
    assert isinstance(model.measures[4].aggregate, RatioAggregate)
    # Lossless round trip: what Python sends is what the golden file says.
    assert model.model_dump(mode="json", exclude_unset=True) == planning_spec
    assert validate_pivot_spec(MINIMAL) == []
    PivotSpec.model_validate(MINIMAL)


@pytest.mark.parametrize("name", sorted(INVALID_SPECS))
def test_invalid_specs_are_rejected(name: str) -> None:
    spec = INVALID_SPECS[name]
    assert not spec_validator.is_valid(spec)
    assert validate_pivot_spec(spec)
    with pytest.raises(ValidationError):
        PivotSpec.model_validate(spec)


def test_referential_checks_the_schema_cannot_express(planning_spec: dict[str, Any]) -> None:
    spec = copy.deepcopy(planning_spec)
    spec["values"] = ["actual", "nope"]
    spec["heat"]["measure"] = "missing"
    spec["kpis"][2]["compareTo"] = "budget"
    spec["measures"].append({"id": "actual", "field": "x"})
    spec["measures"].append({"id": "c", "aggregate": {"type": "custom", "name": "median"}})
    assert spec_validator.is_valid(spec)  # structurally fine…
    errors = validate_pivot_spec(spec, prefix="spec.")
    assert "spec.measures[5].id 'actual' is duplicated" in errors
    assert any(e.startswith("spec.values[1] references unknown measure 'nope'") for e in errors)
    assert any(e.startswith("spec.heat.measure references unknown measure 'missing'") for e in errors)
    assert any(e.startswith("spec.kpis[2].compareTo references unknown measure 'budget'") for e in errors)
    assert any("custom aggregator 'median'" in e for e in errors)


def test_measure_field_rule_is_schema_only() -> None:
    """`field` is required unless count / ratio / custom: an if/then the Pydantic models cannot express."""
    spec = {**MINIMAL, "measures": [{"id": "m"}]}
    assert not spec_validator.is_valid(spec)
    assert validate_pivot_spec(spec) == ["measures[0]: 'field' is a required property"]
    PivotSpec.model_validate(spec)  # documented gap: use validate_pivot_spec for the full check
    assert validate_pivot_spec({**MINIMAL, "measures": [{"id": "n", "aggregate": "count"}]}) == []


def test_golden_request(planning_request: dict[str, Any], planning_rows: list[dict[str, Any]]) -> None:
    assert list(request_validator.iter_errors(planning_request)) == []
    assert validate_export_request(planning_request) == []
    parsed = PivotExportRequest.model_validate(planning_request)
    assert parsed.root.dataset == "planning-fy26"
    with_rows = {**planning_request, "rows": planning_rows}
    assert validate_export_request(with_rows) == []
    # The Python builder produces the same JSON as the TypeScript one (golden file).
    built = build_export_request(
        PivotSpec.model_validate(planning_request["spec"]),
        dataset="planning-fy26",
        format="pdf",
        options=Options.model_validate(planning_request["options"]),
    )
    assert built == planning_request


INVALID_REQUESTS: dict[str, dict[str, Any]] = {
    "no rows or dataset": {"spec": MINIMAL},
    "raw css": {"spec": MINIMAL, "rows": [], "options": {"css": "body{}"}},
    "html option": {"spec": MINIMAL, "rows": [], "options": {"html": "<b>"}},
    "bad theme": {"spec": MINIMAL, "rows": [], "options": {"theme": "sepia"}},
    "bad format": {"spec": MINIMAL, "rows": [], "format": "docx"},
    "bad page": {"spec": MINIMAL, "rows": [], "options": {"page": {"size": "A5"}}},
    "bad margins": {"spec": MINIMAL, "rows": [], "options": {"page": {"margins": {"top": 100}}}},
    "non-object row": {"spec": MINIMAL, "rows": [1]},
    "invalid spec": {"spec": {**MINIMAL, "version": 2}, "rows": []},
}


@pytest.mark.parametrize("name", sorted(INVALID_REQUESTS))
def test_invalid_requests_are_rejected(name: str) -> None:
    request = INVALID_REQUESTS[name]
    assert not request_validator.is_valid(request)
    assert validate_export_request(request)
    with pytest.raises(ValidationError):
        PivotExportRequest.model_validate(request)


def test_options_validation_messages() -> None:
    assert validate_export_options(None) == []
    assert validate_export_options({"theme": "dark", "title": None, "page": {"size": "Letter"}}) == []
    errors = validate_export_options({"css": "x", "theme": "sepia", "maxColumnsPerPage": 0})
    assert errors == [
        "options: unknown key(s) ('css' was unexpected)",
        "options.maxColumnsPerPage: 0 is less than the minimum of 1",
        "options.theme: 'sepia' is not one of ['light', 'dark']",
    ]


def test_check_fields_catches_typos(planning_spec: dict[str, Any], planning_rows: list[dict[str, Any]]) -> None:
    assert check_fields(planning_spec, planning_rows) == []
    spec = copy.deepcopy(planning_spec)
    spec["rows"][1]["field"] = "product_line"
    spec["measures"][4]["aggregate"]["denominatorField"] = "py"
    errors = check_fields(spec, planning_rows)
    assert [e.split(":")[0] for e in errors] == ["spec.rows[1].field", "spec.measures[4].aggregate.denominatorField"]
    assert check_fields(spec, []) == []


def test_request_json_encodes_database_types() -> None:
    import datetime as dt
    import decimal
    import uuid

    rows = [{"d": dt.date(2026, 1, 2), "n": decimal.Decimal("12.50"), "i": decimal.Decimal(3), "u": uuid.UUID(int=1)}]
    body = json.loads(dumps_request(build_export_request(MINIMAL, rows)))
    assert body["rows"] == [{"d": "2026-01-02", "n": 12.5, "i": 3, "u": "00000000-0000-0000-0000-000000000001"}]
    with pytest.raises(ValueError):
        dumps_request({"rows": [{"x": float("nan")}]})
    with pytest.raises(ValueError, match="rows or a dataset"):
        build_export_request(MINIMAL)


def test_examples_directory_is_complete() -> None:
    names = {p.name for p in EXAMPLES.iterdir()}
    assert {
        "planning.spec.json",
        "planning.rows.json",
        "planning.model.json",
        "planning.sheet.json",
        "planning.request.json",
    } <= names
