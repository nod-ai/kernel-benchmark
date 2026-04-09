import { Parser } from "safe-expr-eval";

const parser = new Parser();

/**
 * Flatten a nested row object into a single-level scope suitable for the
 * expression evaluator. Nested keys are joined with underscores so that
 * `shape.M` becomes accessible as `shape_M` in expressions, while
 * top-level keys like `tflops` stay as-is.
 *
 * Both the dot-notation form (`shape.M`) and the flat form (`shape_M`)
 * are placed in scope so users can write either style.
 */
function buildScope(row: Record<string, any>, prefix = ""): Record<string, any> {
  const scope: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const fullKey = prefix ? `${prefix}_${key}` : key;
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(scope, buildScope(value, fullKey));
    } else {
      scope[fullKey] = value ?? 0;
    }
    if (!prefix) {
      scope[key] = value ?? 0;
    }
  }
  return scope;
}

/**
 * Evaluate a mathematical expression against a data row.
 *
 * Supported syntax (provided by safe-expr-eval):
 *   - Arithmetic: +, -, *, /, %
 *   - Comparisons: >, <, >=, <=, ==, !=
 *   - Logical: and, or, not
 *   - Ternary: condition ? a : b
 *   - Built-in functions: abs(), ceil(), floor(), round(), sqrt(), log(),
 *     pow(), min(), max(), sin(), cos(), tan(), etc.
 *   - Constants: PI, E
 *
 * Field references use underscore for nested access:
 *   `shape_M`, `shape_N`, `tflops`, etc.
 *
 * Returns `NaN` if the expression cannot be evaluated for a given row.
 */
/**
 * Check whether an expression string is syntactically valid.
 * Returns null on success, or an error message string on failure.
 */
export function validateExpression(expression: string): string | null {
  if (!expression.trim()) return "Expression is empty";
  try {
    parser.parse(expression);
    return null;
  } catch (e: any) {
    return e?.message ?? "Invalid expression";
  }
}

const KEYWORDS = new Set(["and", "or", "not", "true", "false", "PI", "E"]);

export function evaluateExpression(
  expression: string,
  row: Record<string, any>
): number {
  try {
    const expr = parser.parse(expression);
    const scope = buildScope(row);
    const identifiers = expression.match(/[a-zA-Z_]\w*/g) ?? [];
    for (const id of identifiers) {
      if (!KEYWORDS.has(id) && !(id in scope)) scope[id] = 0;
    }
    const result = expr.evaluate(scope);
    return typeof result === "number" ? result : Number(result) || 0;
  } catch {
    return NaN;
  }
}
