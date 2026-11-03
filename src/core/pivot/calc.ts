/**
 * Calculated measures: a small, safe expression language over other measures (Excel's
 * calculated fields). Tokenizer + recursive-descent parser → AST → closures; no `eval` /
 * `Function`, bounded input length and nesting, whitelisted functions only. Specs can come from
 * AI agents, so every failure is a `PivotCalcError` value, never an exception.
 *
 * Mirrored line by line in Python (`integrations/python/src/nqgrid_export/calc.py`); shared
 * test vectors live in `contract/pivot/v1/calc-expressions.json`.
 *
 * Grammar (lowest precedence first; keywords and function names are case-insensitive):
 *
 * ```
 * expr    := or
 * or      := and (("or" | "||") and)*
 * and     := not (("and" | "&&") not)*
 * not     := ("not" | "!") not | cmp
 * cmp     := add (("=" | "==" | "!=" | "<>" | "<" | "<=" | ">" | ">=") add)?      (non-associative)
 * add     := mul (("+" | "-") mul)*
 * mul     := unary (("*" | "/" | "%") unary)*
 * unary   := ("-" | "+") unary | power
 * power   := primary ("^" unary)?                                               (right-associative)
 * primary := number | "null" | name | "[" any id "]" | function "(" args? ")" | "(" expr ")"
 * ```
 *
 * `-2^2` is `-(2^2) = -4` (math convention, unlike Excel). Names are measure ids (`actual`,
 * `prior_year`); ids with other characters go in brackets (`[prior year]`, `[Plan-2026]`).
 */

/** Longest accepted expression, in UTF-16 code units (Python counts the same units). */
export const PIVOT_CALC_MAX_LENGTH = 1000;
/** Deepest accepted nesting: parentheses, calls, unary operators and operator chains. */
export const PIVOT_CALC_MAX_DEPTH = 64;
/** Most arguments of one function call. */
export const PIVOT_CALC_MAX_ARGS = 32;

/** Whitelisted functions with their `[min, max]` argument counts. */
export const PIVOT_CALC_FUNCTIONS: Readonly<Record<string, readonly [number, number]>> = {
  abs: [1, 1],
  sqrt: [1, 1],
  floor: [1, 1],
  ceil: [1, 1],
  round: [1, 2],
  min: [1, PIVOT_CALC_MAX_ARGS],
  max: [1, PIVOT_CALC_MAX_ARGS],
  if: [2, 3],
  coalesce: [1, PIVOT_CALC_MAX_ARGS],
  ifnull: [2, 2],
};

/** Names that can never be references (they mean something to JS / Python object models). */
export const PIVOT_CALC_RESERVED_NAMES: readonly string[] = ["__proto__", "constructor", "prototype"];

export type PivotCalcErrorCode =
  | "notAString"
  | "empty"
  | "tooLong"
  | "tooDeep"
  | "invalidCharacter"
  | "invalidNumber"
  | "unterminatedReference"
  | "emptyReference"
  | "unexpectedToken"
  | "unexpectedEnd"
  | "unknownFunction"
  | "arity"
  | "reservedName"
  | "unknownReference";

export interface PivotCalcError {
  readonly code: PivotCalcErrorCode;
  readonly message: string;
  /** Offset (UTF-16 code units) where the problem starts. */
  readonly position: number;
}

export type PivotCalcBinaryOp = "+" | "-" | "*" | "/" | "%" | "^" | "=" | "!=" | "<" | "<=" | ">" | ">=" | "and" | "or";

export type PivotCalcNode =
  | { readonly type: "number"; readonly value: number }
  | { readonly type: "null" }
  | { readonly type: "ref"; readonly name: string }
  | { readonly type: "unary"; readonly op: "-" | "+" | "not"; readonly arg: PivotCalcNode }
  | { readonly type: "binary"; readonly op: PivotCalcBinaryOp; readonly left: PivotCalcNode; readonly right: PivotCalcNode }
  | { readonly type: "call"; readonly name: string; readonly args: readonly PivotCalcNode[] };

export type PivotCalcParseResult =
  | { readonly ok: true; readonly ast: PivotCalcNode; readonly references: readonly string[] }
  | { readonly ok: false; readonly error: PivotCalcError };

export interface ParsePivotCalcOptions {
  /** Known reference names (measure ids). When given, other names fail with `unknownReference`. */
  readonly references?: Iterable<string>;
}

type TokenKind = "num" | "name" | "ref" | "op" | "(" | ")" | "," | "end";

interface Token {
  readonly kind: TokenKind;
  readonly text: string;
  readonly pos: number;
  readonly value?: number;
}

class CalcError extends Error {
  constructor(
    readonly code: PivotCalcErrorCode,
    message: string,
    readonly position: number,
  ) {
    super(message);
  }
}

const isDigit = (c: string) => c >= "0" && c <= "9";
const isNameStart = (c: string) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
const isNamePart = (c: string) => isNameStart(c) || isDigit(c);
const KEYWORDS = new Set(["and", "or", "not", "null"]);
const TWO_CHAR_OPS = new Set(["==", "!=", "<>", "<=", ">=", "&&", "||"]);
const ONE_CHAR_OPS = new Set(["+", "-", "*", "/", "%", "^", "=", "<", ">", "!"]);

/**
 * Characters never accepted, even inside `[...]`: C0 / C1 controls, zero-width characters,
 * bidirectional overrides / isolates and the BOM (they make an expression read differently from
 * what it does).
 */
function isForbidden(code: number): boolean {
  return (
    code < 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2069) ||
    code === 0xfeff
  );
}

const describeChar = (c: string) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i]!;
    const code = src.charCodeAt(i);
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (isForbidden(code)) throw new CalcError("invalidCharacter", `invalid character ${describeChar(c)}`, i);
    if (isDigit(c) || (c === "." && i + 1 < n && isDigit(src[i + 1]!))) {
      const start = i;
      while (i < n && isDigit(src[i]!)) i++;
      if (i < n && src[i] === ".") {
        i++;
        while (i < n && isDigit(src[i]!)) i++;
      }
      if (i < n && (src[i] === "e" || src[i] === "E")) {
        let j = i + 1;
        if (j < n && (src[j] === "+" || src[j] === "-")) j++;
        if (j < n && isDigit(src[j]!)) {
          while (j < n && isDigit(src[j]!)) j++;
          i = j;
        } else {
          throw new CalcError("invalidNumber", `invalid number "${src.slice(start, j)}"`, start);
        }
      }
      if (i < n && (isNamePart(src[i]!) || src[i] === ".")) throw new CalcError("invalidNumber", `invalid number "${src.slice(start, i + 1)}"`, start);
      const text = src.slice(start, i);
      const value = Number(text);
      if (!Number.isFinite(value)) throw new CalcError("invalidNumber", `number "${text}" is out of range`, start);
      tokens.push({ kind: "num", text, pos: start, value });
      continue;
    }
    if (isNameStart(c)) {
      const start = i;
      while (i < n && isNamePart(src[i]!)) i++;
      tokens.push({ kind: "name", text: src.slice(start, i), pos: start });
      continue;
    }
    if (c === "[") {
      const start = i;
      i++;
      while (i < n && src[i] !== "]") {
        const ch = src[i]!;
        if (ch === "[") throw new CalcError("invalidCharacter", 'invalid character "[" inside a [reference]', i);
        if (isForbidden(src.charCodeAt(i))) throw new CalcError("invalidCharacter", `invalid character ${describeChar(ch)}`, i);
        i++;
      }
      if (i >= n) throw new CalcError("unterminatedReference", 'missing "]"', start);
      const text = src.slice(start + 1, i);
      i++;
      if (text.length === 0) throw new CalcError("emptyReference", "empty reference []", start);
      tokens.push({ kind: "ref", text, pos: start });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      tokens.push({ kind: "op", text: two, pos: i });
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS.has(c)) {
      tokens.push({ kind: "op", text: c, pos: i });
      i++;
      continue;
    }
    if (c === "(" || c === ")" || c === ",") {
      tokens.push({ kind: c, text: c, pos: i });
      i++;
      continue;
    }
    throw new CalcError("invalidCharacter", code < 0x80 ? `invalid character "${c}"` : `invalid character ${describeChar(c)}`, i);
  }
  tokens.push({ kind: "end", text: "", pos: n });
  return tokens;
}

const depthOf = (node: PivotCalcNode): number => DEPTHS.get(node) ?? 1;
const DEPTHS = new WeakMap<PivotCalcNode, number>();

class Parser {
  private i = 0;
  private nesting = 0;
  readonly references: string[] = [];

  constructor(
    private readonly tokens: readonly Token[],
    private readonly known: ReadonlySet<string> | null,
  ) {}

  parse(): PivotCalcNode {
    const node = this.expr();
    const t = this.peek();
    if (t.kind !== "end") throw this.unexpected(t);
    return node;
  }

  private peek(): Token {
    return this.tokens[this.i]!;
  }

  private next(): Token {
    return this.tokens[this.i++]!;
  }

  private isKeyword(t: Token, word: string): boolean {
    return t.kind === "name" && t.text.toLowerCase() === word;
  }

  private unexpected(t: Token): CalcError {
    return t.kind === "end" ? new CalcError("unexpectedEnd", "unexpected end of expression", t.pos) : new CalcError("unexpectedToken", `unexpected "${t.text}"`, t.pos);
  }

  /** Enter one nesting level (parentheses, calls, prefix operators). */
  private enter(pos: number): void {
    if (++this.nesting > PIVOT_CALC_MAX_DEPTH) throw new CalcError("tooDeep", `expression is nested deeper than ${PIVOT_CALC_MAX_DEPTH} levels`, pos);
  }

  private leave(): void {
    this.nesting--;
  }

  /** A node whose depth (1 + deepest child) is checked against the limit. */
  private node(node: PivotCalcNode, children: readonly PivotCalcNode[], pos: number): PivotCalcNode {
    let depth = 1;
    for (const c of children) depth = Math.max(depth, depthOf(c) + 1);
    if (depth > PIVOT_CALC_MAX_DEPTH) throw new CalcError("tooDeep", `expression is nested deeper than ${PIVOT_CALC_MAX_DEPTH} levels`, pos);
    if (depth > 1) DEPTHS.set(node, depth);
    return node;
  }

  private binary(op: PivotCalcBinaryOp, left: PivotCalcNode, right: PivotCalcNode, pos: number): PivotCalcNode {
    return this.node({ type: "binary", op, left, right }, [left, right], pos);
  }

  private expr(): PivotCalcNode {
    return this.or();
  }

  private or(): PivotCalcNode {
    let left = this.and();
    for (;;) {
      const t = this.peek();
      if (!(this.isKeyword(t, "or") || (t.kind === "op" && t.text === "||"))) return left;
      this.next();
      left = this.binary("or", left, this.and(), t.pos);
    }
  }

  private and(): PivotCalcNode {
    let left = this.not();
    for (;;) {
      const t = this.peek();
      if (!(this.isKeyword(t, "and") || (t.kind === "op" && t.text === "&&"))) return left;
      this.next();
      left = this.binary("and", left, this.not(), t.pos);
    }
  }

  private not(): PivotCalcNode {
    const t = this.peek();
    if (this.isKeyword(t, "not") || (t.kind === "op" && t.text === "!")) {
      this.next();
      this.enter(t.pos);
      const arg = this.not();
      this.leave();
      return this.node({ type: "unary", op: "not", arg }, [arg], t.pos);
    }
    return this.cmp();
  }

  private cmp(): PivotCalcNode {
    const left = this.add();
    const t = this.peek();
    if (t.kind !== "op") return left;
    const op = t.text === "==" ? "=" : t.text === "<>" ? "!=" : t.text;
    if (op !== "=" && op !== "!=" && op !== "<" && op !== "<=" && op !== ">" && op !== ">=") return left;
    this.next();
    const node = this.binary(op, left, this.add(), t.pos);
    const after = this.peek();
    if (after.kind === "op" && ["=", "==", "!=", "<>", "<", "<=", ">", ">="].includes(after.text)) {
      throw new CalcError("unexpectedToken", `unexpected "${after.text}" (comparisons do not chain; use "and")`, after.pos);
    }
    return node;
  }

  private add(): PivotCalcNode {
    let left = this.mul();
    for (;;) {
      const t = this.peek();
      if (t.kind !== "op" || (t.text !== "+" && t.text !== "-")) return left;
      this.next();
      left = this.binary(t.text, left, this.mul(), t.pos);
    }
  }

  private mul(): PivotCalcNode {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (t.kind !== "op" || (t.text !== "*" && t.text !== "/" && t.text !== "%")) return left;
      this.next();
      left = this.binary(t.text, left, this.unary(), t.pos);
    }
  }

  private unary(): PivotCalcNode {
    const t = this.peek();
    if (t.kind === "op" && (t.text === "-" || t.text === "+")) {
      this.next();
      this.enter(t.pos);
      const arg = this.unary();
      this.leave();
      return this.node({ type: "unary", op: t.text, arg }, [arg], t.pos);
    }
    return this.power();
  }

  private power(): PivotCalcNode {
    const base = this.primary();
    const t = this.peek();
    if (t.kind !== "op" || t.text !== "^") return base;
    this.next();
    this.enter(t.pos);
    const exponent = this.unary();
    this.leave();
    return this.binary("^", base, exponent, t.pos);
  }

  private reference(name: string, pos: number): PivotCalcNode {
    if (PIVOT_CALC_RESERVED_NAMES.includes(name)) throw new CalcError("reservedName", `"${name}" is a reserved name`, pos);
    if (this.known !== null && !this.known.has(name)) throw new CalcError("unknownReference", `unknown measure "${name}"`, pos);
    if (!this.references.includes(name)) this.references.push(name);
    return { type: "ref", name };
  }

  private primary(): PivotCalcNode {
    const t = this.next();
    switch (t.kind) {
      case "num":
        return { type: "number", value: t.value! };
      case "ref": {
        if (this.peek().kind === "(") throw this.unexpected(this.peek());
        return this.reference(t.text, t.pos);
      }
      case "name": {
        const lower = t.text.toLowerCase();
        if (this.peek().kind === "(") return this.call(t, lower);
        if (lower === "null") return { type: "null" };
        if (KEYWORDS.has(lower)) throw this.unexpected(t);
        return this.reference(t.text, t.pos);
      }
      case "(": {
        this.enter(t.pos);
        const inner = this.expr();
        const close = this.next();
        if (close.kind !== ")") throw close.kind === "end" ? new CalcError("unexpectedEnd", 'missing ")"', close.pos) : this.unexpected(close);
        this.leave();
        return inner;
      }
      default:
        throw this.unexpected(t);
    }
  }

  private call(name: Token, lower: string): PivotCalcNode {
    const arity = Object.prototype.hasOwnProperty.call(PIVOT_CALC_FUNCTIONS, lower) ? PIVOT_CALC_FUNCTIONS[lower]! : null;
    if (arity === null) {
      const list = Object.keys(PIVOT_CALC_FUNCTIONS).join(", ");
      throw new CalcError("unknownFunction", `unknown function "${name.text}" (allowed: ${list})`, name.pos);
    }
    this.next(); // "("
    this.enter(name.pos);
    const args: PivotCalcNode[] = [];
    if (this.peek().kind !== ")") {
      for (;;) {
        if (args.length >= PIVOT_CALC_MAX_ARGS) throw new CalcError("arity", `${lower}() takes at most ${arity[1]} arguments`, name.pos);
        args.push(this.expr());
        const t = this.peek();
        if (t.kind === ",") {
          this.next();
          continue;
        }
        break;
      }
    }
    const close = this.next();
    if (close.kind !== ")") throw close.kind === "end" ? new CalcError("unexpectedEnd", 'missing ")"', close.pos) : this.unexpected(close);
    this.leave();
    const [min, max] = arity;
    if (args.length < min || args.length > max) {
      const expected = min === max ? `${min}` : max >= PIVOT_CALC_MAX_ARGS ? `at least ${min}` : `${min} to ${max}`;
      throw new CalcError("arity", `${lower}() takes ${expected} argument${expected === "1" ? "" : "s"} (got ${args.length})`, name.pos);
    }
    return this.node({ type: "call", name: lower, args }, args, name.pos);
  }
}

/**
 * Parse a calculated-measure expression. Never throws: problems come back as `{ ok: false,
 * error }` with a stable `code` (shared with the Python mirror) and the offending position.
 */
export function parsePivotCalc(source: unknown, options: ParsePivotCalcOptions = {}): PivotCalcParseResult {
  const fail = (code: PivotCalcErrorCode, message: string, position = 0): PivotCalcParseResult => ({ ok: false, error: { code, message, position } });
  if (typeof source !== "string") return fail("notAString", "expression must be a string");
  if (source.length > PIVOT_CALC_MAX_LENGTH) return fail("tooLong", `expression is longer than ${PIVOT_CALC_MAX_LENGTH} characters`, PIVOT_CALC_MAX_LENGTH);
  if (/^[ \t\r\n]*$/.test(source)) return fail("empty", "expression is empty");
  try {
    const tokens = tokenize(source);
    const known = options.references ? new Set(options.references) : null;
    const parser = new Parser(tokens, known);
    const ast = parser.parse();
    return { ok: true, ast, references: parser.references };
  } catch (e) {
    if (e instanceof CalcError) return fail(e.code, e.message, e.position);
    // Defensive: anything unexpected (e.g. a host stack overflow) is reported, never rethrown.
    return fail("tooDeep", "expression could not be parsed");
  }
}

/** Human-readable `parsePivotCalc` error: `unknown measure "plann" at 9`. */
export function formatPivotCalcError(error: PivotCalcError): string {
  return `${error.message} at ${error.position}`;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Compiled expression: reads reference values by index (`NaN` = no value) and returns a finite
 * number or `NaN` (= `null`). Null propagates through arithmetic, comparisons and most functions.
 */
export type PivotCalcProgram = (values: ArrayLike<number>) => number;

/** `x` when finite, else `NaN` (division by zero, overflow and `sqrt(-1)` all become "no value"). */
const fin = (x: number) => (x - x === 0 ? x : NaN);
const truthy = (x: number) => x === x && x !== 0;

function roundHalfAway(x: number, digits: number): number {
  if (x !== x || digits !== digits) return NaN;
  const d = Math.max(-15, Math.min(15, Math.trunc(digits)));
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  if (d >= 0) {
    const f = 10 ** d;
    return fin((sign * Math.floor(ax * f + 0.5)) / f);
  }
  const f = 10 ** -d;
  return fin(sign * Math.floor(ax / f + 0.5) * f);
}

/**
 * Compile an AST once into closures (`refIndex` maps a reference name to its slot in the values
 * array). Evaluation semantics:
 *
 * - `+ - * ^` → `NaN`/null when an operand is null or the result is not finite; `/` and `%`
 *   (remainder with the sign of the dividend) → null when dividing by zero;
 * - comparisons → `1` / `0`, null when an operand is null;
 * - `and` / `or` / `not` → `1` / `0`; null and `0` are false;
 * - `if(c, a, b?)` → `a` when `c` is true, else `b` (null when absent);
 * - `min` / `max` skip nulls (null when all are null); `coalesce` / `ifnull` → first non-null;
 * - `round(x, digits = 0)` rounds half away from zero; `sqrt` of a negative → null.
 */
export function compilePivotCalc(ast: PivotCalcNode, refIndex: (name: string) => number): PivotCalcProgram {
  const c = (node: PivotCalcNode): PivotCalcProgram => {
    switch (node.type) {
      case "number": {
        const v = node.value;
        return () => v;
      }
      case "null":
        return () => NaN;
      case "ref": {
        const k = refIndex(node.name);
        if (k < 0) return () => NaN;
        return (v) => v[k]!;
      }
      case "unary": {
        const a = c(node.arg);
        if (node.op === "-") return (v) => -a(v);
        if (node.op === "+") return a;
        return (v) => (truthy(a(v)) ? 0 : 1);
      }
      case "binary": {
        const a = c(node.left);
        const b = c(node.right);
        switch (node.op) {
          case "+":
            return (v) => fin(a(v) + b(v));
          case "-":
            return (v) => fin(a(v) - b(v));
          case "*":
            return (v) => fin(a(v) * b(v));
          case "/":
            return (v) => {
              const y = b(v);
              return y === 0 ? NaN : fin(a(v) / y);
            };
          case "%":
            return (v) => {
              const y = b(v);
              return y === 0 ? NaN : fin(a(v) % y);
            };
          case "^":
            return (v) => {
              const x = a(v);
              const y = b(v);
              return x !== x || y !== y ? NaN : fin(Math.pow(x, y));
            };
          case "=":
          case "!=":
          case "<":
          case "<=":
          case ">":
          case ">=": {
            const op = node.op;
            return (v) => {
              const x = a(v);
              const y = b(v);
              if (x !== x || y !== y) return NaN;
              const r = op === "=" ? x === y : op === "!=" ? x !== y : op === "<" ? x < y : op === "<=" ? x <= y : op === ">" ? x > y : x >= y;
              return r ? 1 : 0;
            };
          }
          case "and":
            return (v) => (truthy(a(v)) && truthy(b(v)) ? 1 : 0);
          case "or":
            return (v) => (truthy(a(v)) || truthy(b(v)) ? 1 : 0);
        }
        break;
      }
      case "call": {
        const args = node.args.map(c);
        const [a, b, d] = args;
        switch (node.name) {
          case "abs":
            return (v) => Math.abs(a!(v));
          case "sqrt":
            return (v) => {
              const x = a!(v);
              return x < 0 ? NaN : Math.sqrt(x);
            };
          case "floor":
            return (v) => Math.floor(a!(v));
          case "ceil":
            return (v) => Math.ceil(a!(v));
          case "round":
            return b ? (v) => roundHalfAway(a!(v), b(v)) : (v) => roundHalfAway(a!(v), 0);
          case "min":
          case "max": {
            const isMin = node.name === "min";
            return (v) => {
              let out = NaN;
              for (const f of args) {
                const x = f(v);
                if (x !== x) continue;
                if (out !== out || (isMin ? x < out : x > out)) out = x;
              }
              return out;
            };
          }
          case "if":
            return d ? (v) => (truthy(a!(v)) ? b!(v) : d(v)) : (v) => (truthy(a!(v)) ? b!(v) : NaN);
          case "coalesce":
          case "ifnull":
            return (v) => {
              for (const f of args) {
                const x = f(v);
                if (x === x) return x;
              }
              return NaN;
            };
        }
        break;
      }
    }
    return () => NaN;
  };
  return c(ast);
}

/**
 * Parse + compile + evaluate in one call (tests, previews). `values` maps reference names to
 * numbers (`null` / missing = no value). Returns `null` for "no value" and for invalid expressions
 * (use `parsePivotCalc` to see why).
 */
export function evaluatePivotCalc(source: string, values: Readonly<Record<string, number | null | undefined>> | ReadonlyMap<string, number | null>): number | null {
  const parsed = parsePivotCalc(source);
  if (!parsed.ok) return null;
  const names = parsed.references;
  const get = (name: string): number | null | undefined =>
    values instanceof Map ? values.get(name) : Object.prototype.hasOwnProperty.call(values, name) ? (values as Record<string, number | null | undefined>)[name] : undefined;
  const slots = names.map((name) => {
    const v = get(name);
    return typeof v === "number" && Number.isFinite(v) ? v : NaN;
  });
  const program = compilePivotCalc(parsed.ast, (name) => names.indexOf(name));
  const out = program(slots);
  return out === out ? out : null;
}

/**
 * Reference cycles among calculated measures: each cycle as the ids along it, first id repeated
 * at the end (`["a", "b", "a"]`). `refs` maps a calculated measure id to the ids it references.
 */
export function findPivotCalcCycles(refs: ReadonlyMap<string, readonly string[]>): string[][] {
  const cycles: string[][] = [];
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    state.set(id, 1);
    stack.push(id);
    for (const next of refs.get(id) ?? []) {
      if (!refs.has(next)) continue;
      const s = state.get(next);
      if (s === 1) {
        const cycle = [...stack.slice(stack.indexOf(next)), next];
        const key = [...cycle.slice(0, -1)].sort().join("\u0000");
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(cycle);
        }
      } else if (s === undefined) {
        visit(next);
      }
    }
    stack.pop();
    state.set(id, 2);
  };
  for (const id of refs.keys()) if (!state.has(id)) visit(id);
  return cycles;
}
