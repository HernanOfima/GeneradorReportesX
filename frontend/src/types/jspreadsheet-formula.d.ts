declare module '@jspreadsheet/formula' {
  interface FormulaEngine {
    (expression: string, vars?: Record<string, unknown>, x?: number, y?: number, worksheet?: unknown): unknown;
    setFormula(formulas: Record<string, (...args: unknown[]) => unknown>): void;
  }

  const formula: FormulaEngine;
  export default formula;
}
