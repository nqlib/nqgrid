"""Calculated-measure expressions (``PivotMeasure.calculate``), mirrored from nqgrid core.

A line-by-line port of ``src/core/pivot/calc.ts``: same tokenizer, recursive-descent parser,
limits, error codes and positions (UTF-16 code units, like JavaScript string offsets), and the same
evaluation rules. No ``eval``; whitelisted functions only. Both implementations are checked against
the shared vectors in ``contract/pivot/v1/calc-expressions.json``.

nqgrid-export evaluates calculated measures itself; this module lets a Python producer (e.g. an MCP
agent) validate an expression before sending a spec, with the same messages.

Grammar (lowest precedence first; keywords and function names are case-insensitive)::

    expr    := or
    or      := and (("or" | "||") and)*
    and     := not (("and" | "&&") not)*
    not     := ("not" | "!") not | cmp
    cmp     := add (("=" | "==" | "!=" | "<>" | "<" | "<=" | ">" | ">=") add)?     (non-associative)
    add     := mul (("+" | "-") mul)*
    mul     := unary (("*" | "/" | "%") unary)*
    unary   := ("-" | "+") unary | power
    power   := primary ("^" unary)?                                              (right-associative)
    primary := number | "null" | name | "[" any id "]" | function "(" args? ")" | "(" expr ")"
"""

from __future__ import annotations

import math
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any, Union

MAX_LENGTH = 1000
"""Longest accepted expression, in UTF-16 code units."""
MAX_DEPTH = 64
"""Deepest accepted nesting (parentheses, calls, unary operators, operator chains)."""
MAX_ARGS = 32
"""Most arguments of one function call."""

FUNCTIONS: dict[str, tuple[int, int]] = {
    "abs": (1, 1),
    "sqrt": (1, 1),
    "floor": (1, 1),
    "ceil": (1, 1),
    "round": (1, 2),
    "min": (1, MAX_ARGS),
    "max": (1, MAX_ARGS),
    "if": (2, 3),
    "coalesce": (1, MAX_ARGS),
    "ifnull": (2, 2),
}
"""Whitelisted functions with their ``(min, max)`` argument counts (same order as nqgrid)."""

RESERVED_NAMES = ("__proto__", "constructor", "prototype")
_KEYWORDS = frozenset(("and", "or", "not", "null"))
_TWO_CHAR_OPS = frozenset(("==", "!=", "<>", "<=", ">=", "&&", "||"))
_ONE_CHAR_OPS = frozenset("+-*/%^=<>!")
_COMPARISONS = ("=", "==", "!=", "<>", "<", "<=", ">", ">=")


@dataclass(frozen=True)
class CalcError:
    """A parse failure: stable ``code`` (shared with nqgrid), message and UTF-16 offset."""

    code: str
    message: str
    position: int

    def __str__(self) -> str:
        return f"{self.message} at {self.position}"


@dataclass(frozen=True)
class Num:
    value: float


@dataclass(frozen=True)
class Null:
    pass


@dataclass(frozen=True)
class Ref:
    name: str


@dataclass(frozen=True)
class Unary:
    op: str
    arg: Node


@dataclass(frozen=True)
class Binary:
    op: str
    left: Node
    right: Node


@dataclass(frozen=True)
class Call:
    name: str
    args: tuple[Node, ...]


Node = Union[Num, Null, Ref, Unary, Binary, Call]  # noqa: UP007 (dataclass forward refs on 3.10)


@dataclass(frozen=True)
class ParseResult:
    """``ok`` with ``ast`` and ``references`` (in first-use order), or ``error``."""

    ast: Node | None = None
    references: tuple[str, ...] = ()
    error: CalcError | None = None

    @property
    def ok(self) -> bool:
        return self.error is None


class _Fail(Exception):
    def __init__(self, code: str, message: str, position: int) -> None:
        super().__init__(message)
        self.error = CalcError(code, message, position)


@dataclass(frozen=True)
class _Token:
    kind: str  # num | name | ref | op | ( | ) | , | end
    text: str
    pos: int
    value: float = 0.0


def _is_digit(u: int) -> bool:
    return 0x30 <= u <= 0x39


def _is_name_start(u: int) -> bool:
    return 0x61 <= u <= 0x7A or 0x41 <= u <= 0x5A or u == 0x5F


def _is_name_part(u: int) -> bool:
    return _is_name_start(u) or _is_digit(u)


def _is_forbidden(u: int) -> bool:
    """Controls, zero-width characters, bidi overrides / isolates and the BOM (same set as nqgrid)."""
    return (
        u < 0x20
        or 0x7F <= u <= 0x9F
        or 0x200B <= u <= 0x200F
        or 0x202A <= u <= 0x202E
        or 0x2060 <= u <= 0x2069
        or u == 0xFEFF
    )


def _units(source: str) -> list[int]:
    data = source.encode("utf-16-le", "surrogatepass")
    return [data[i] | (data[i + 1] << 8) for i in range(0, len(data), 2)]


def _text(units: list[int], start: int, end: int) -> str:
    data = b"".join(u.to_bytes(2, "little") for u in units[start:end])
    return data.decode("utf-16-le", "surrogatepass")


def _describe(units: list[int], i: int) -> str:
    u = units[i]
    if 0xD800 <= u <= 0xDBFF and i + 1 < len(units) and 0xDC00 <= units[i + 1] <= 0xDFFF:
        u = 0x10000 + ((u - 0xD800) << 10) + (units[i + 1] - 0xDC00)
    return f"U+{u:04X}"


def _tokenize(units: list[int]) -> list[_Token]:
    tokens: list[_Token] = []
    i = 0
    n = len(units)
    while i < n:
        u = units[i]
        if u in (0x20, 0x09, 0x0A, 0x0D):
            i += 1
            continue
        if _is_forbidden(u):
            raise _Fail("invalidCharacter", f"invalid character {_describe(units, i)}", i)
        if _is_digit(u) or (u == 0x2E and i + 1 < n and _is_digit(units[i + 1])):
            start = i
            while i < n and _is_digit(units[i]):
                i += 1
            if i < n and units[i] == 0x2E:
                i += 1
                while i < n and _is_digit(units[i]):
                    i += 1
            if i < n and units[i] in (0x65, 0x45):
                j = i + 1
                if j < n and units[j] in (0x2B, 0x2D):
                    j += 1
                if j < n and _is_digit(units[j]):
                    while j < n and _is_digit(units[j]):
                        j += 1
                    i = j
                else:
                    raise _Fail("invalidNumber", f'invalid number "{_text(units, start, j)}"', start)
            if i < n and (_is_name_part(units[i]) or units[i] == 0x2E):
                raise _Fail("invalidNumber", f'invalid number "{_text(units, start, i + 1)}"', start)
            text = _text(units, start, i)
            value = float(text)
            if not math.isfinite(value):
                raise _Fail("invalidNumber", f'number "{text}" is out of range', start)
            tokens.append(_Token("num", text, start, value))
            continue
        if _is_name_start(u):
            start = i
            while i < n and _is_name_part(units[i]):
                i += 1
            tokens.append(_Token("name", _text(units, start, i), start))
            continue
        if u == 0x5B:  # [
            start = i
            i += 1
            while i < n and units[i] != 0x5D:
                if units[i] == 0x5B:
                    raise _Fail("invalidCharacter", 'invalid character "[" inside a [reference]', i)
                if _is_forbidden(units[i]):
                    raise _Fail("invalidCharacter", f"invalid character {_describe(units, i)}", i)
                i += 1
            if i >= n:
                raise _Fail("unterminatedReference", 'missing "]"', start)
            text = _text(units, start + 1, i)
            i += 1
            if not text:
                raise _Fail("emptyReference", "empty reference []", start)
            tokens.append(_Token("ref", text, start))
            continue
        two = _text(units, i, min(n, i + 2)) if i + 1 < n else ""
        if two in _TWO_CHAR_OPS:
            tokens.append(_Token("op", two, i))
            i += 2
            continue
        c = chr(u) if u < 0x80 else ""
        if c and c in _ONE_CHAR_OPS:
            tokens.append(_Token("op", c, i))
            i += 1
            continue
        if c in ("(", ")", ","):
            tokens.append(_Token(c, c, i))
            i += 1
            continue
        raise _Fail(
            "invalidCharacter", f'invalid character "{c}"' if c else f"invalid character {_describe(units, i)}", i
        )
    tokens.append(_Token("end", "", n))
    return tokens


def _too_deep(pos: int) -> _Fail:
    return _Fail("tooDeep", f"expression is nested deeper than {MAX_DEPTH} levels", pos)


@dataclass
class _Parser:
    tokens: list[_Token]
    known: frozenset[str] | None
    i: int = 0
    nesting: int = 0
    references: list[str] = field(default_factory=list)
    depths: dict[int, int] = field(default_factory=dict)

    def parse(self) -> Node:
        node = self.expr()
        t = self.peek()
        if t.kind != "end":
            raise self.unexpected(t)
        return node

    def peek(self) -> _Token:
        return self.tokens[self.i]

    def next(self) -> _Token:
        t = self.tokens[self.i]
        self.i += 1
        return t

    @staticmethod
    def is_keyword(t: _Token, word: str) -> bool:
        return t.kind == "name" and t.text.lower() == word

    @staticmethod
    def unexpected(t: _Token) -> _Fail:
        if t.kind == "end":
            return _Fail("unexpectedEnd", "unexpected end of expression", t.pos)
        return _Fail("unexpectedToken", f'unexpected "{t.text}"', t.pos)

    def enter(self, pos: int) -> None:
        self.nesting += 1
        if self.nesting > MAX_DEPTH:
            raise _too_deep(pos)

    def leave(self) -> None:
        self.nesting -= 1

    def depth_of(self, node: Node) -> int:
        return self.depths.get(id(node), 1)

    def node(self, node: Node, children: tuple[Node, ...], pos: int) -> Node:
        depth = 1
        for c in children:
            depth = max(depth, self.depth_of(c) + 1)
        if depth > MAX_DEPTH:
            raise _too_deep(pos)
        if depth > 1:
            self.depths[id(node)] = depth
        return node

    def binary(self, op: str, left: Node, right: Node, pos: int) -> Node:
        return self.node(Binary(op, left, right), (left, right), pos)

    def expr(self) -> Node:
        return self.or_()

    def or_(self) -> Node:
        left = self.and_()
        while True:
            t = self.peek()
            if not (self.is_keyword(t, "or") or (t.kind == "op" and t.text == "||")):
                return left
            self.next()
            left = self.binary("or", left, self.and_(), t.pos)

    def and_(self) -> Node:
        left = self.not_()
        while True:
            t = self.peek()
            if not (self.is_keyword(t, "and") or (t.kind == "op" and t.text == "&&")):
                return left
            self.next()
            left = self.binary("and", left, self.not_(), t.pos)

    def not_(self) -> Node:
        t = self.peek()
        if self.is_keyword(t, "not") or (t.kind == "op" and t.text == "!"):
            self.next()
            self.enter(t.pos)
            arg = self.not_()
            self.leave()
            return self.node(Unary("not", arg), (arg,), t.pos)
        return self.cmp()

    def cmp(self) -> Node:
        left = self.add()
        t = self.peek()
        if t.kind != "op":
            return left
        op = "=" if t.text == "==" else "!=" if t.text == "<>" else t.text
        if op not in ("=", "!=", "<", "<=", ">", ">="):
            return left
        self.next()
        node = self.binary(op, left, self.add(), t.pos)
        after = self.peek()
        if after.kind == "op" and after.text in _COMPARISONS:
            raise _Fail(
                "unexpectedToken", f'unexpected "{after.text}" (comparisons do not chain; use "and")', after.pos
            )
        return node

    def add(self) -> Node:
        left = self.mul()
        while True:
            t = self.peek()
            if t.kind != "op" or t.text not in ("+", "-"):
                return left
            self.next()
            left = self.binary(t.text, left, self.mul(), t.pos)

    def mul(self) -> Node:
        left = self.unary()
        while True:
            t = self.peek()
            if t.kind != "op" or t.text not in ("*", "/", "%"):
                return left
            self.next()
            left = self.binary(t.text, left, self.unary(), t.pos)

    def unary(self) -> Node:
        t = self.peek()
        if t.kind == "op" and t.text in ("-", "+"):
            self.next()
            self.enter(t.pos)
            arg = self.unary()
            self.leave()
            return self.node(Unary(t.text, arg), (arg,), t.pos)
        return self.power()

    def power(self) -> Node:
        base = self.primary()
        t = self.peek()
        if t.kind != "op" or t.text != "^":
            return base
        self.next()
        self.enter(t.pos)
        exponent = self.unary()
        self.leave()
        return self.binary("^", base, exponent, t.pos)

    def reference(self, name: str, pos: int) -> Node:
        if name in RESERVED_NAMES:
            raise _Fail("reservedName", f'"{name}" is a reserved name', pos)
        if self.known is not None and name not in self.known:
            raise _Fail("unknownReference", f'unknown measure "{name}"', pos)
        if name not in self.references:
            self.references.append(name)
        return Ref(name)

    def primary(self) -> Node:
        t = self.next()
        if t.kind == "num":
            return Num(t.value)
        if t.kind == "ref":
            if self.peek().kind == "(":
                raise self.unexpected(self.peek())
            return self.reference(t.text, t.pos)
        if t.kind == "name":
            lower = t.text.lower()
            if self.peek().kind == "(":
                return self.call(t, lower)
            if lower == "null":
                return Null()
            if lower in _KEYWORDS:
                raise self.unexpected(t)
            return self.reference(t.text, t.pos)
        if t.kind == "(":
            self.enter(t.pos)
            inner = self.expr()
            close = self.next()
            if close.kind != ")":
                raise (
                    _Fail("unexpectedEnd", 'missing ")"', close.pos) if close.kind == "end" else self.unexpected(close)
                )
            self.leave()
            return inner
        raise self.unexpected(t)

    def call(self, name: _Token, lower: str) -> Node:
        arity = FUNCTIONS.get(lower)
        if arity is None:
            allowed = ", ".join(FUNCTIONS)
            raise _Fail("unknownFunction", f'unknown function "{name.text}" (allowed: {allowed})', name.pos)
        self.next()  # "("
        self.enter(name.pos)
        args: list[Node] = []
        if self.peek().kind != ")":
            while True:
                if len(args) >= MAX_ARGS:
                    raise _Fail("arity", f"{lower}() takes at most {arity[1]} arguments", name.pos)
                args.append(self.expr())
                if self.peek().kind == ",":
                    self.next()
                    continue
                break
        close = self.next()
        if close.kind != ")":
            raise _Fail("unexpectedEnd", 'missing ")"', close.pos) if close.kind == "end" else self.unexpected(close)
        self.leave()
        lo, hi = arity
        if len(args) < lo or len(args) > hi:
            expected = str(lo) if lo == hi else f"at least {lo}" if hi >= MAX_ARGS else f"{lo} to {hi}"
            plural = "" if expected == "1" else "s"
            raise _Fail("arity", f"{lower}() takes {expected} argument{plural} (got {len(args)})", name.pos)
        return self.node(Call(lower, tuple(args)), tuple(args), name.pos)


def parse_calc(source: Any, references: Iterable[str] | None = None) -> ParseResult:
    """Parse an expression; never raises. ``references``: known measure ids (others → ``unknownReference``)."""
    if not isinstance(source, str):
        return ParseResult(error=CalcError("notAString", "expression must be a string", 0))
    try:
        units = _units(source)
    except UnicodeEncodeError:  # pragma: no cover - surrogatepass accepts every str
        return ParseResult(error=CalcError("invalidCharacter", "invalid character", 0))
    if len(units) > MAX_LENGTH:
        return ParseResult(error=CalcError("tooLong", f"expression is longer than {MAX_LENGTH} characters", MAX_LENGTH))
    if all(u in (0x20, 0x09, 0x0A, 0x0D) for u in units):
        return ParseResult(error=CalcError("empty", "expression is empty", 0))
    try:
        tokens = _tokenize(units)
        parser = _Parser(tokens, frozenset(references) if references is not None else None)
        ast = parser.parse()
        return ParseResult(ast=ast, references=tuple(parser.references))
    except _Fail as e:
        return ParseResult(error=e.error)
    except RecursionError:  # pragma: no cover - the depth limit keeps recursion far below Python's
        return ParseResult(error=CalcError("tooDeep", "expression could not be parsed", 0))


# ---------------------------------------------------------------------------------------------
# Evaluation (same rules as compilePivotCalc; NaN stands for "no value" internally)
# ---------------------------------------------------------------------------------------------

_NAN = float("nan")


def _fin(x: float) -> float:
    return x if math.isfinite(x) else _NAN


def _truthy(x: float) -> bool:
    return x == x and x != 0


def _round_half_away(x: float, digits: float) -> float:
    if x != x or digits != digits:
        return _NAN
    d = max(-15, min(15, math.trunc(digits)))
    sign = -1.0 if x < 0 else 1.0
    ax = abs(x)
    if d >= 0:
        f = 10.0**d
        return _fin((sign * math.floor(ax * f + 0.5)) / f)
    f = 10.0 ** (-d)
    return _fin(sign * math.floor(ax / f + 0.5) * f)


def _pow(x: float, y: float) -> float:
    if x != x or y != y:
        return _NAN
    try:
        return _fin(math.pow(x, y))
    except (OverflowError, ValueError, ZeroDivisionError):
        return _NAN


def _eval(node: Node, get: Callable[[str], float]) -> float:
    if isinstance(node, Num):
        return node.value
    if isinstance(node, Null):
        return _NAN
    if isinstance(node, Ref):
        return get(node.name)
    if isinstance(node, Unary):
        a = _eval(node.arg, get)
        if node.op == "-":
            return -a
        if node.op == "+":
            return a
        return 0.0 if _truthy(a) else 1.0
    if isinstance(node, Binary):
        x = _eval(node.left, get)
        y = _eval(node.right, get)
        op = node.op
        if op == "+":
            return _fin(x + y)
        if op == "-":
            return _fin(x - y)
        if op == "*":
            return _fin(x * y)
        if op == "/":
            return _NAN if y == 0 else _fin(x / y)
        if op == "%":
            return _NAN if y == 0 or x != x or y != y else _fin(math.fmod(x, y))
        if op == "^":
            return _pow(x, y)
        if op == "and":
            return 1.0 if _truthy(x) and _truthy(y) else 0.0
        if op == "or":
            return 1.0 if _truthy(x) or _truthy(y) else 0.0
        if x != x or y != y:
            return _NAN
        result = {"=": x == y, "!=": x != y, "<": x < y, "<=": x <= y, ">": x > y, ">=": x >= y}[op]
        return 1.0 if result else 0.0
    args = node.args
    name = node.name
    if name in ("abs", "sqrt", "floor", "ceil"):
        a = _eval(args[0], get)
        if a != a:
            return _NAN
        if name == "abs":
            return abs(a)
        if name == "sqrt":
            return _NAN if a < 0 else math.sqrt(a)
        return float(math.floor(a) if name == "floor" else math.ceil(a))
    if name == "round":
        return _round_half_away(_eval(args[0], get), _eval(args[1], get) if len(args) > 1 else 0.0)
    if name in ("min", "max"):
        out = _NAN
        for f in args:
            v = _eval(f, get)
            if v != v:
                continue
            if out != out or (v < out if name == "min" else v > out):
                out = v
        return out
    if name == "if":
        if _truthy(_eval(args[0], get)):
            return _eval(args[1], get)
        return _eval(args[2], get) if len(args) > 2 else _NAN
    # coalesce / ifnull
    for f in args:
        v = _eval(f, get)
        if v == v:
            return v
    return _NAN


def evaluate_calc(source: str | Node, values: Mapping[str, float | int | None]) -> float | None:
    """Evaluate an expression (or a parsed AST) with ``values`` per reference (``None`` / missing = no value).

    Returns ``None`` for "no value" (null operands, division by zero, overflow) and for invalid expressions.
    """
    if isinstance(source, str):
        parsed = parse_calc(source)
        if parsed.ast is None:
            return None
        ast: Node = parsed.ast
    else:
        ast = source

    def get(name: str) -> float:
        v = values.get(name)
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
            return _NAN
        return float(v)

    out = _eval(ast, get)
    return out if out == out else None


def find_cycles(refs: Mapping[str, Iterable[str]]) -> list[list[str]]:
    """Reference cycles among calculated measures (``["a", "b", "a"]``), like ``findPivotCalcCycles``."""
    graph = {k: list(v) for k, v in refs.items()}
    cycles: list[list[str]] = []
    state: dict[str, int] = {}
    stack: list[str] = []
    seen: set[tuple[str, ...]] = set()

    def visit(node: str) -> None:
        state[node] = 1
        stack.append(node)
        for nxt in graph.get(node, []):
            if nxt not in graph:
                continue
            s = state.get(nxt)
            if s == 1:
                cycle = [*stack[stack.index(nxt) :], nxt]
                key = tuple(sorted(cycle[:-1]))
                if key not in seen:
                    seen.add(key)
                    cycles.append(cycle)
            elif s is None:
                visit(nxt)
        stack.pop()
        state[node] = 2

    for node in graph:
        if node not in state:
            visit(node)
    return cycles
