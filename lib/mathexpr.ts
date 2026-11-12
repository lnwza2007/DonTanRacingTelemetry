// Checked evaluator for math-channel formulas: only numbers, feed channel names, a few Math functions and operators.
type FeedKey = string;
const FNS: Record<string, (...a: number[]) => number> = { abs: Math.abs, min: Math.min, max: Math.max, sqrt: Math.sqrt, pow: Math.pow };
const SYMBOLS = new Set(["+", "-", "*", "/", "%", "(", ")", ",", "<", ">", "?", ":"]);

type Compiled = { ok: true; uses: FeedKey[]; run: (v: Record<string, number | undefined>) => number } | { ok: false; error: string };

export function compile(expr: string, KEYS: string[]): Compiled {
  const toks = expr.match(/[A-Za-z_]\w*|\d*\.?\d+|\S/g) ?? [];
  if (!toks.length) return { ok: false, error: "Empty formula" };
  const uses = new Set<FeedKey>();
  for (const t of toks) {
    if (/^[A-Za-z_]/.test(t)) {
      if (KEYS.includes(t as FeedKey)) uses.add(t as FeedKey);
      else if (!Object.hasOwn(FNS, t)) return { ok: false, error: `Unknown name "${t}"` };
    } else if (!/^\d/.test(t) && !/^\./.test(t) && !SYMBOLS.has(t)) return { ok: false, error: `Not allowed: "${t}"` };
  }
  try {
    const names = [...KEYS, ...Object.keys(FNS)];
    const f = new Function(...names, `"use strict"; return (${expr});`);
    return { ok: true, uses: [...uses], run: (v) => Number(f(...KEYS.map((k) => v[k] ?? NaN), ...Object.values(FNS))) };
  } catch (e: any) {
    return { ok: false, error: "Cannot read this formula" };
  }
}

