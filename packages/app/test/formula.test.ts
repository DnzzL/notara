import { describe, test, expect } from "bun:test";
import { evaluateFormula, tryEvaluate } from "../src/lib/formula.js";

const vals = { Price: 10, Qty: 3, Name: "Widget", Discount: 0.1, Done: true };

describe("formula evaluator", () => {
  test("arithmetic precedence", () => {
    expect(evaluateFormula("1 + 2 * 3", {})).toBe(7);
    expect(evaluateFormula("(1 + 2) * 3", {})).toBe(9);
    expect(evaluateFormula("10 / 4", {})).toBe(2.5);
  });

  test("unary minus", () => {
    expect(evaluateFormula("-5 + 3", {})).toBe(-2);
  });

  test("prop() reads record values", () => {
    expect(evaluateFormula(`prop("Price") * prop("Qty")`, vals)).toBe(30);
  });

  test("string concatenation via +", () => {
    expect(evaluateFormula(`prop("Name") + " x" + prop("Qty")`, vals)).toBe("Widget x3");
  });

  test("if() branches", () => {
    expect(evaluateFormula(`if(prop("Qty") > 2, "many", "few")`, vals)).toBe("many");
    expect(evaluateFormula(`if(prop("Qty") < 2, 1, 0)`, vals)).toBe(0);
  });

  test("sum, round, min, max", () => {
    expect(evaluateFormula(`sum(1, 2, 3, 4)`, {})).toBe(10);
    expect(evaluateFormula(`round(1.2345, 2)`, {})).toBe(1.23);
    expect(evaluateFormula(`min(5, 3, 9)`, {})).toBe(3);
    expect(evaluateFormula(`max(5, 3, 9)`, {})).toBe(9);
  });

  test("missing prop returns null, coerces to 0 in arithmetic", () => {
    expect(evaluateFormula(`prop("Nope")`, {})).toBeNull();
    expect(evaluateFormula(`prop("Nope") + 5`, {})).toBe(5);
  });

  test("division by zero yields NaN", () => {
    expect(Number.isNaN(evaluateFormula("1 / 0", {}) as number)).toBe(true);
  });

  test("tryEvaluate wraps errors", () => {
    expect(tryEvaluate("1 +", {})).toEqual({ ok: false, error: expect.any(String) });
    expect(tryEvaluate("", {})).toEqual({ ok: true, value: null });
    expect(tryEvaluate(null, {})).toEqual({ ok: true, value: null });
  });

  test("boolean truthy in if()", () => {
    expect(evaluateFormula(`if(prop("Done"), "ok", "no")`, vals)).toBe("ok");
  });
});
