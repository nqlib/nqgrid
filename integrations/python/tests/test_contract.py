"""Contract tests against ``contract/pivot/v1``: JSON Schema (jsonschema), Pydantic models, validators."""

from __future__ import annotations

import copy
import datetime as dt
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
from nqgrid_export.validation import (
    calc_example_spec,
    check_calculated_measure,
    date_field_source,
    dates_example_spec,
    example_spec,
    fields_example_spec,
    filtered_example_spec,
    humanize_pivot_field,
    infer_pivot_fields,
    multicol_example_spec,
)

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
    "filter without field": {**MINIMAL, "filters": [{"include": ["a"]}]},
    "non-string include": {**MINIMAL, "filters": [{"field": "a", "include": [1]}]},
    "bad match op": {**MINIMAL, "filters": [{"field": "a", "match": {"op": "like", "value": "x"}}]},
    "topN count 0": {**MINIMAL, "rows": [{"field": "a", "topN": {"measure": "m", "count": 0}}]},
    "topN without measure": {**MINIMAL, "rows": [{"field": "a", "topN": {"count": 3}}]},
    "bad sortBy direction": {**MINIMAL, "rows": [{"field": "a", "sortBy": {"measure": "m", "direction": "up"}}]},
    "bad facet": {**MINIMAL, "facets": [{"label": "x"}]},
    "bad field type": {**MINIMAL, "fields": [{"field": "a", "type": "category"}]},
    "bad field area": {**MINIMAL, "fields": [{"field": "a", "areas": ["pages"]}]},
    "field without name": {**MINIMAL, "fields": [{"label": "A"}]},
    "bad field aggregate": {**MINIMAL, "fields": [{"field": "a", "aggregate": "median"}]},
    "non-string field label": {**MINIMAL, "fieldLabels": {"a": 1}},
    "negative valuesIndex": {**MINIMAL, "valuesIndex": -1},
    "empty columns array": {**MINIMAL, "columns": []},
    "column without field": {**MINIMAL, "columns": [{"field": "b"}, {"label": "x"}]},
    "bad subtotal": {**MINIMAL, "columns": [{"field": "b", "subtotal": "middle"}, {"field": "c"}]},
    "bad columnsExpanded": {**MINIMAL, "columnsExpanded": [[1]]},
    "bad dateGroup": {**MINIMAL, "fields": [{"field": "x", "source": "d", "dateGroup": "decade"}]},
    "bad row subtotal": {**MINIMAL, "rows": [{"field": "a", "subtotal": "bottom"}]},
    "empty calculate": {**MINIMAL, "measures": [{"id": "m", "calculate": ""}]},
    "calculate too long": {**MINIMAL, "measures": [{"id": "m", "calculate": "1+" * 500 + "1"}]},
    "bad showAs base kind": {**MINIMAL, "measures": [{"id": "m", "field": "v", "showAs": "differenceFromPrevious"}]},
    "bad showAsBase position": {
        **MINIMAL,
        "measures": [
            {"id": "m", "field": "v", "showAs": "runningTotal", "showAsBase": {"field": "a", "position": "x"}}
        ],
    },
    "showAsBase without field": {**MINIMAL, "measures": [{"id": "m", "field": "v", "showAsBase": {"item": "x"}}]},
    "bad fiscal month": {**MINIMAL, "fields": [{"field": "d", "fiscalYearStartMonth": 13}]},
    "bad time zone offset": {**MINIMAL, "fields": [{"field": "d", "timeZoneOffsetMinutes": 900}]},
    "short monthNames": {**MINIMAL, "fields": [{"field": "d", "monthNames": ["J"]}]},
    "bad dateGroups": {**MINIMAL, "fields": [{"field": "d", "dateGroups": ["decade"]}]},
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
    assert filtered_example_spec() == load_example("planning-filtered.spec.json")
    assert fields_example_spec() == load_example("planning-fields.spec.json")
    assert dates_example_spec() == load_example("planning-dates.spec.json")
    assert multicol_example_spec() == load_example("planning-multicol.spec.json")
    assert calc_example_spec() == load_example("planning-calc.spec.json")


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


def test_filtered_spec_validates_everywhere(filtered_spec: dict[str, Any], planning_rows: list[dict[str, Any]]) -> None:
    assert list(spec_validator.iter_errors(filtered_spec)) == []
    assert validate_pivot_spec(filtered_spec) == []
    model = PivotSpec.model_validate(filtered_spec)
    assert model.filters is not None and model.filters[1].match is not None
    assert model.rows[1].topN is not None and model.rows[1].topN.other is True
    assert model.model_dump(mode="json", exclude_unset=True) == filtered_spec
    assert check_fields(filtered_spec, planning_rows) == []


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


def test_filter_sort_topn_referential_checks(
    filtered_spec: dict[str, Any], planning_rows: list[dict[str, Any]]
) -> None:
    spec = copy.deepcopy(filtered_spec)
    spec["rows"][1]["sortBy"]["measure"] = "margin"
    spec["rows"][1]["topN"]["measure"] = "units"
    spec["columns"]["topN"] = {"measure": "actual", "count": 3}
    spec["facets"].append({"field": "line", "label": "Line again"})
    spec["filters"].append({"field": "regoin", "exclude": ["North"]})
    assert spec_validator.is_valid(spec)  # structurally fine…
    errors = validate_pivot_spec(spec)
    assert any(e.startswith("rows[1].sortBy.measure references unknown measure 'margin'") for e in errors)
    assert any(e.startswith("rows[1].topN.measure references unknown measure 'units'") for e in errors)
    assert "columns.topN is only supported on row dimensions" in errors
    assert "facets[2] 'line' is duplicated" in errors
    # Filter fields are checked against the rows like any other field (a typo would drop every row).
    assert [e.split(":")[0] for e in check_fields(spec, planning_rows)] == ["spec.filters[2].field"]


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
        "planning-filtered.spec.json",
        "planning-filtered.model.json",
        "planning-filtered.sheet.json",
        "planning-filtered.html",
        "planning-fields.spec.json",
        "planning-fields.rows.json",
        "planning-fields.model.json",
        "planning-fields.sheet.json",
        "planning-fields.catalog.json",
        "planning-fields.html",
        "planning-multicol.spec.json",
        "planning-multicol.model.json",
        "planning-multicol.sheet.json",
        "planning-multicol.html",
        "planning-dates.spec.json",
        "planning-dates.rows.json",
        "planning-dates.model.json",
        "planning-dates.sheet.json",
        "planning-dates.html",
        "planning-calc.spec.json",
        "planning-calc.model.json",
        "planning-calc.sheet.json",
        "planning-calc.html",
    } <= names
    assert (CONTRACT / "calc-expressions.json").is_file()


def test_fields_spec_validates_everywhere() -> None:
    spec = load_example("planning-fields.spec.json")
    rows = load_example("planning-fields.rows.json")
    assert list(spec_validator.iter_errors(spec)) == []
    assert validate_pivot_spec(spec) == []
    model = PivotSpec.model_validate(spec)
    assert model.valuesIndex == 0
    assert model.fields is not None and model.fields[2].areas == ["rows", "columns", "filters"]
    assert model.model_dump(mode="json", exclude_unset=True) == spec
    assert check_fields(spec, rows) == []
    dup = {**spec, "fields": [*spec["fields"], {"field": "units"}]}
    assert validate_pivot_spec(dup) == ["fields[12] 'units' is duplicated"]


def test_field_inference_matches_nqgrid() -> None:
    """``infer_pivot_fields`` mirrors ``inferPivotFields`` (golden ``planning-fields.catalog.json``)."""
    rows = load_example("planning-fields.rows.json")
    catalog = load_example("planning-fields.catalog.json")
    assert infer_pivot_fields(rows) == catalog["inferred"]
    # Same mixed sample as src/core/pivot/fields.test.ts.
    mixed = [
        {"year": 2020 + i % 3, "day": f"2024-01-{i % 28 + 1:02d}", "id": f"ID-{i}", "v": None if i % 2 else i * 1.5}
        for i in range(200)
    ]
    assert [f["type"] for f in infer_pivot_fields(mixed)] == ["number", "date", "text", "measure"]
    assert [f["type"] for f in infer_pivot_fields([{"d": dt.date(2024, 1, 1), "b": True, "x": 2.0}] * 4)] == [
        "date",
        "dimension",
        "number",
    ]
    assert humanize_pivot_field("unit_price") == "Unit Price"
    assert humanize_pivot_field("priorYear") == "Prior Year"
    # Sampling reads `sample` rows spread over the data.
    seen: list[int] = []

    class Row(dict[str, Any]):
        def items(self) -> Any:
            seen.append(self["i"])
            return super().items()

    infer_pivot_fields([Row(i=i) for i in range(1000)], sample=10)
    assert seen == list(range(0, 1000, 100))


@pytest.mark.parametrize(
    ("spec_name", "rows_name"),
    [
        ("planning-multicol.spec.json", "planning-fields.rows.json"),
        ("planning-dates.spec.json", "planning-dates.rows.json"),
        ("planning-calc.spec.json", "planning-dates.rows.json"),
    ],
)
def test_column_hierarchy_and_date_specs_validate_everywhere(spec_name: str, rows_name: str) -> None:
    spec = load_example(spec_name)
    rows = load_example(rows_name)
    assert list(spec_validator.iter_errors(spec)) == []
    assert validate_pivot_spec(spec) == []
    model = PivotSpec.model_validate(spec)
    assert model.model_dump(mode="json", exclude_unset=True) == spec
    assert check_fields(spec, rows) == []  # orderDate:year / orderDate:quarter read orderDate


def test_column_and_date_referential_checks() -> None:
    spec = {**MINIMAL, "columns": [{"field": "b", "sortBy": {"measure": "m"}}, {"field": "a"}]}
    assert validate_pivot_spec(spec) == [
        "columns[0].sortBy is only supported on row dimensions",
        "columns[1].field 'a' is already used by rows[0]",
    ]
    # Row subtotal positions are valid since step 4 (start / end / none).
    assert validate_pivot_spec({**MINIMAL, "rows": [{"field": "a", "subtotal": "end"}]}) == []
    # The single-object shape keeps its old paths.
    assert validate_pivot_spec({**MINIMAL, "columns": {"field": "b", "topN": {"measure": "m", "count": 1}}}) == [
        "columns.topN is only supported on row dimensions"
    ]
    lonely = {**MINIMAL, "fields": [{"field": "x", "source": "d"}]}
    assert "fields[0]: source and dateGroup go together" in validate_pivot_spec(lonely)
    assert validate_pivot_spec({**MINIMAL, "fields": [{"field": "d", "source": "d", "dateGroup": "year"}]}) == [
        "fields[0].source must differ from field"
    ]


def test_date_field_sources() -> None:
    spec = {
        **MINIMAL,
        "fields": [
            {"field": "fy", "source": "orderDate", "dateGroup": "year"},
            {"field": "a:year", "type": "dimension"},
        ],
    }
    assert date_field_source(spec, "orderDate:quarter") == "orderDate"
    assert date_field_source(spec, "fy") == "orderDate"
    assert date_field_source(spec, "a:year") is None  # declared as a plain dimension
    assert date_field_source(spec, "orderDate") is None
    assert date_field_source(spec, "x:decade") is None
    rows = [{"orderDate": "2026-01-15", "v": 1}]
    dated = {
        **MINIMAL,
        "rows": [{"field": "orderDate:month"}],
        "filters": [{"field": "orderDate:year", "include": ["2026"]}],
    }
    assert check_fields(dated, rows) == []
    assert [e.split(":")[0] for e in check_fields({**dated, "rows": [{"field": "shipDate:month"}]}, rows)] == [
        "spec.rows[0].field"
    ]


def test_calc_spec_round_trips_and_mirrors_ts_validation() -> None:
    """Calculated measures, show-as bases and distinct count: same checks and messages as validatePivotSpec."""
    spec = load_example("planning-calc.spec.json")
    model = PivotSpec.model_validate(spec)
    assert model.measures[2].calculate == "actual / plan - 1"
    assert model.measures[3].showAsBase is not None and model.measures[3].showAsBase.position == "previous"
    assert model.measures[5].aggregate == "distinctCount"
    assert model.rows[0].subtotal == "end"

    base = {**MINIMAL, "measures": [{"id": "m", "field": "v"}, {"id": "p", "field": "w"}]}

    def errors(*measures: dict[str, Any]) -> list[str]:
        return validate_pivot_spec({**base, "measures": [*measures, *base["measures"]]})

    assert errors({"id": "x", "calculate": "m +"}) == ["measures[0].calculate: unexpected end of expression (at 3)"]
    assert errors({"id": "x", "calculate": "mm * 2"}) == ['measures[0].calculate: unknown measure "mm" (at 0)']
    assert errors({"id": "x", "calculate": "y + 1"}, {"id": "y", "calculate": "x * 2"}) == [
        "measures[0].calculate: reference cycle x → y → x"
    ]
    assert errors({"id": "x", "calculate": "m", "field": "v"}) == [
        "measures[0]: calculate cannot be combined with field or aggregate"
    ]
    assert "reserved" in errors({"id": "x", "calculate": "__proto__"})[0]
    assert 'unknown function "eval"' in errors({"id": "x", "calculate": "eval(m)"})[0]
    assert errors({"id": "x", "field": "v", "showAs": "runningTotal"}) == [
        "measures[0].showAsBase is required by its showAs / groupShowAs"
    ]
    assert errors({"id": "x", "field": "v", "showAs": "runningTotal", "showAsBase": {"field": "zz"}}) == [
        'measures[0].showAsBase.field "zz" is not a row or column field'
    ]
    assert errors({"id": "x", "field": "v", "showAs": "rankDescending", "showAsBase": {"field": "a"}}) == []
    assert errors({"id": "x", "field": "v", "aggregate": "distinctCount"}) == []
    # Inline check for a formula editor (mirrors checkPivotCalculatedMeasure).
    assert check_calculated_measure(base, "m / p - 1") is None
    assert check_calculated_measure(base, "m / pp") == 'unknown measure "pp" at 4'
    loop = {**base, "measures": [*base["measures"], {"id": "c", "calculate": "m * 2"}]}
    assert check_calculated_measure(loop, "c + 1", "m") == "reference cycle c → m → c"
