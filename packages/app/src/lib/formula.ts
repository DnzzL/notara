/**
 * Tiny formula evaluator for database formula fields.
 *
 * Grammar (recursive descent):
 *   expr   := term (('+'|'-') term)*
 *   term   := factor (('*'|'/') factor)*
 *   factor := ('-' | '+') factor
 *           | number
 *           | string                    (double-quoted)
 *           | ident '(' args? ')'       (function call)
 *           | '(' expr ')'
 *   args   := expr (',' expr)*
 *
 * Built-in functions:
 *   prop("Field Name")   → value of that field on the current record
 *   if(cond, a, b)       → a if cond truthy else b (cond may use > < >= <= == != or any number)
 *   sum(a, b, …)         → sum of numeric args (non-numeric coerced to 0)
 *   round(n[, digits])   → round to `digits` decimals (default 0)
 *
 * Errors are reported by throwing FormulaError; callers should catch and
 * show "#ERR" or similar. Result type is `number | string | boolean | null`.
 */

export type FormulaValue = number | string | boolean | null;

export class FormulaError extends Error {}

export function evaluateFormula(
  expression: string,
  recordValues: Record<string, unknown>,
): FormulaValue {
  const tokens = tokenize(expression);
  const parser = new Parser(tokens);
  const ast = parser.parseExpr();
  if (!parser.eof()) throw new FormulaError("Unexpected trailing input");
  return evalNode(ast, recordValues);
}

// ── Tokenizer ─────────────────────────────────────────────────────────────

type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "ident"; v: string }
  | { t: "op"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "comma" };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (c === "(") { out.push({ t: "lp" }); i++; continue; }
    if (c === ")") { out.push({ t: "rp" }); i++; continue; }
    if (c === ",") { out.push({ t: "comma" }); i++; continue; }
    if (c === '"') {
      let j = i + 1; let s = "";
      while (j < src.length && src[j] !== '"') {
        if (src[j] === "\\" && j + 1 < src.length) { s += src[j + 1]; j += 2; continue; }
        s += src[j]; j++;
      }
      if (j >= src.length) throw new FormulaError("Unterminated string");
      out.push({ t: "str", v: s });
      i = j + 1; continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const n = Number(src.slice(i, j));
      if (Number.isNaN(n)) throw new FormulaError(`Bad number: ${src.slice(i, j)}`);
      out.push({ t: "num", v: n });
      i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: "ident", v: src.slice(i, j) });
      i = j; continue;
    }
    // Multi-char ops first: >= <= == !=
    const two = src.slice(i, i + 2);
    if (two === ">=" || two === "<=" || two === "==" || two === "!=") {
      out.push({ t: "op", v: two }); i += 2; continue;
    }
    if ("+-*/<>".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    throw new FormulaError(`Unexpected character: ${c}`);
  }
  return out;
}

// ── Parser ────────────────────────────────────────────────────────────────

type Node =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bin"; op: string; a: Node; b: Node }
  | { k: "neg"; a: Node }
  | { k: "call"; name: string; args: Node[] };

class Parser {
  constructor(private toks: Tok[], private i = 0) {}
  eof() { return this.i >= this.toks.length; }
  peek(): Tok | undefined { return this.toks[this.i]; }
  consume(): Tok { return this.toks[this.i++]; }

  parseExpr(): Node { return this.parseCompare(); }

  parseCompare(): Node {
    let a = this.parseAdditive();
    while (true) {
      const t = this.peek();
      if (!t || t.t !== "op") break;
      if (!(t.v === ">" || t.v === "<" || t.v === ">=" || t.v === "<=" || t.v === "==" || t.v === "!=")) break;
      this.consume();
      const b = this.parseAdditive();
      a = { k: "bin", op: t.v, a, b };
    }
    return a;
  }

  parseAdditive(): Node {
    let a = this.parseTerm();
    while (true) {
      const t = this.peek();
      if (!t || t.t !== "op" || (t.v !== "+" && t.v !== "-")) break;
      this.consume();
      const b = this.parseTerm();
      a = { k: "bin", op: t.v, a, b };
    }
    return a;
  }

  parseTerm(): Node {
    let a = this.parseFactor();
    while (true) {
      const t = this.peek();
      if (!t || t.t !== "op" || (t.v !== "*" && t.v !== "/")) break;
      this.consume();
      const b = this.parseFactor();
      a = { k: "bin", op: t.v, a, b };
    }
    return a;
  }

  parseFactor(): Node {
    const t = this.peek();
    if (!t) throw new FormulaError("Unexpected end of expression");
    if (t.t === "op" && (t.v === "-" || t.v === "+")) {
      this.consume();
      const a = this.parseFactor();
      return t.v === "-" ? { k: "neg", a } : a;
    }
    if (t.t === "num") { this.consume(); return { k: "num", v: t.v }; }
    if (t.t === "str") { this.consume(); return { k: "str", v: t.v }; }
    if (t.t === "lp") {
      this.consume();
      const e = this.parseExpr();
      const r = this.consume();
      if (!r || r.t !== "rp") throw new FormulaError("Missing closing paren");
      return e;
    }
    if (t.t === "ident") {
      this.consume();
      const lp = this.peek();
      if (!lp || lp.t !== "lp") throw new FormulaError(`Identifier '${t.v}' must be followed by '('`);
      this.consume();
      const args: Node[] = [];
      if (this.peek()?.t !== "rp") {
        args.push(this.parseExpr());
        while (this.peek()?.t === "comma") { this.consume(); args.push(this.parseExpr()); }
      }
      const rp = this.consume();
      if (!rp || rp.t !== "rp") throw new FormulaError("Missing closing paren");
      return { k: "call", name: t.v, args };
    }
    throw new FormulaError(`Unexpected token: ${JSON.stringify(t)}`);
  }
}

// ── Evaluator ─────────────────────────────────────────────────────────────

function evalNode(n: Node, vals: Record<string, unknown>): FormulaValue {
  switch (n.k) {
    case "num": return n.v;
    case "str": return n.v;
    case "neg": {
      const a = toNum(evalNode(n.a, vals));
      return -a;
    }
    case "bin": {
      const av = evalNode(n.a, vals);
      const bv = evalNode(n.b, vals);
      switch (n.op) {
        case "+":
          if (typeof av === "string" || typeof bv === "string") return String(av ?? "") + String(bv ?? "");
          return toNum(av) + toNum(bv);
        case "-": return toNum(av) - toNum(bv);
        case "*": return toNum(av) * toNum(bv);
        case "/": {
          const b = toNum(bv);
          if (b === 0) return NaN;
          return toNum(av) / b;
        }
        case ">": return toNum(av) > toNum(bv);
        case "<": return toNum(av) < toNum(bv);
        case ">=": return toNum(av) >= toNum(bv);
        case "<=": return toNum(av) <= toNum(bv);
        case "==": return av === bv || toNum(av) === toNum(bv);
        case "!=": return !(av === bv || toNum(av) === toNum(bv));
      }
      throw new FormulaError(`Unknown operator: ${n.op}`);
    }
    case "call": {
      const args = n.args.map((a) => evalNode(a, vals));
      switch (n.name) {
        case "prop": {
          const key = args[0];
          if (typeof key !== "string") throw new FormulaError("prop() requires a string argument");
          if (!(key in vals)) return null;
          const raw = vals[key];
          if (raw === null || raw === undefined || raw === "") return null;
          return raw as FormulaValue;
        }
        case "if": {
          if (args.length !== 3) throw new FormulaError("if() requires 3 arguments");
          return truthy(args[0]) ? args[1] : args[2];
        }
        case "sum": return args.reduce<number>((acc, v) => acc + toNum(v), 0);
        case "round": {
          const n0 = toNum(args[0]);
          const digits = args.length > 1 ? Math.floor(toNum(args[1])) : 0;
          const m = Math.pow(10, digits);
          return Math.round(n0 * m) / m;
        }
        case "min": return Math.min(...args.map(toNum));
        case "max": return Math.max(...args.map(toNum));
      }
      throw new FormulaError(`Unknown function: ${n.name}`);
    }
  }
}

function toNum(v: FormulaValue | unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function truthy(v: FormulaValue | unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0 && !Number.isNaN(v);
  if (typeof v === "string") return v.length > 0 && v !== "false";
  return v != null;
}

/**
 * Safely evaluate a formula, returning `null` on errors (callers can render
 * `#ERR` or the underlying message via `evaluateFormula` directly).
 */
export function tryEvaluate(expression: string | null | undefined, recordValues: Record<string, unknown>): { ok: true; value: FormulaValue } | { ok: false; error: string } {
  if (!expression || !expression.trim()) return { ok: true, value: null };
  try {
    return { ok: true, value: evaluateFormula(expression, recordValues) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
