"""Calculated-measure expressions: the shared vectors (``contract/pivot/v1/calc-expressions.json``) and safety."""

from __future__ import annotations

import json
import math
import time
from typing import Any

import pytest

from nqgrid_export.calc import FUNCTIONS, MAX_ARGS, MAX_DEPTH, MAX_LENGTH, evaluate_calc, find_cycles, parse_calc

from .conftest import CONTRACT

VECTORS = json.loads((CONTRACT / "calc-expressions.json").read_text("utf-8"))


def build(expr: Any) -> Any:
    """Expand ``{"concat": [...]}`` (long inputs) like the TypeScript test does."""
    if not isinstance(expr, dict):
        return expr
    return "".join(p if isinstance(p, str) else p["repeat"] * p["times"] for p in expr["concat"])


def close(a: float | None, b: float | None) -> bool:
    if a is None or b is None:
        return a is b
    return a == b or abs(a - b) <= 1e-12 * max(1.0, abs(a), abs(b))


def test_limits_and_functions_match_the_contract() -> None:
    assert VECTORS["limits"] == {"maxLength": MAX_LENGTH, "maxDepth": MAX_DEPTH, "maxArgs": MAX_ARGS}
    assert VECTORS["functions"] == list(FUNCTIONS)


@pytest.mark.parametrize("case", VECTORS["valid"], ids=lambda c: str(c["expr"])[:40])
def test_valid_vectors(case: dict[str, Any]) -> None:
    src = build(case["expr"])
    parsed = parse_calc(src)
    assert parsed.error is None, parsed.error
    if "references" in case:
        assert list(parsed.references) == case["references"]
    result = evaluate_calc(src, case["values"])
    assert close(result, case["result"]), (src, result, case["result"])


@pytest.mark.parametrize("case", VECTORS["invalid"], ids=lambda c: repr(c["expr"])[:40])
def test_invalid_vectors(case: dict[str, Any]) -> None:
    src = build(case["expr"])
    parsed = parse_calc(src, case.get("measures"))
    assert parsed.error is not None
    assert parsed.error.code == case["code"], (src, parsed.error)
    if "position" in case:
        assert parsed.error.position == case["position"]
    assert parsed.error.message


def test_hostile_input_is_rejected_quickly() -> None:
    hostile = [
        "(" * 100_000,
        "-" * 100_000 + "1",
        "1+" * 400_000 + "1",
        "[" * 5000,
        "a" * 2_000_000,
        "‮" * 10,
        "constructor.constructor('return process')()",
        "__import__('os')",
        "__proto__",
        "x['constructor']",
        "().__class__",
        "lambda: 1",
    ]
    start = time.perf_counter()
    for src in hostile:
        assert parse_calc(src).error is not None, src
    assert time.perf_counter() - start < 2


def test_evaluation_never_reads_attributes() -> None:
    assert evaluate_calc("__class__ + 1", {}) is None
    assert evaluate_calc("keys * 2", {"keys": 3}) == 6
    assert evaluate_calc("x", {"x": True}) is None  # booleans are not numbers
    assert evaluate_calc("x", {"x": math.inf}) is None


def test_cycles() -> None:
    assert find_cycles({"a": ["b"], "b": ["a"], "c": ["a"]}) == [["a", "b", "a"]]
    assert find_cycles({"a": ["a"]}) == [["a", "a"]]
    assert find_cycles({"a": ["b", "x"], "b": ["c"], "c": []}) == []
