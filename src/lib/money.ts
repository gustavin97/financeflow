const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dec2 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const plain = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** 123456 -> "R$ 1.234,56" */
export const fmtBRL = (cents: number) => brl.format(cents / 100);
/** 123456 -> "1.234,56" */
export const fmtNum = (cents: number) => dec2.format(cents / 100);
/** 12.5 -> "12,5" */
export const fmtPlain = (n: number) => plain.format(n);
export const fmtPct = (ratio: number, digits = 0) =>
  `${(ratio * 100).toFixed(digits).replace(".", ",")}%`;

/** 125050 -> "1250,50" (para edição) */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function normalizeNumber(token: string): number {
  let t = token;
  if (t.includes(",")) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, "");
  }
  return Number(t);
}

/**
 * Avaliador aritmético seguro (sem eval) para células de valor.
 * Aceita: 1.250,50 | 1250.5 | =100+50*2 | (300-20)/2 | R$ 89,90
 */
export function evalExpression(src: string): number | null {
  const s = src.replace(/R\$/gi, "").replace(/^=/, "").trim();
  if (!s) return null;
  const re = /\s*(\d[\d.,]*|[()+\-*/])/y;
  const tokens: string[] = [];
  let pos = 0;
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) {
      if (s.slice(pos).trim() === "") break;
      return null;
    }
    tokens.push(m[1]);
    pos = re.lastIndex;
  }
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];

  function factor(): number {
    const t = next();
    if (t === undefined) throw new Error("fim");
    if (t === "-") return -factor();
    if (t === "+") return factor();
    if (t === "(") {
      const v = expr();
      if (next() !== ")") throw new Error("parêntese");
      return v;
    }
    if (/^\d/.test(t)) {
      const n = normalizeNumber(t);
      if (Number.isNaN(n)) throw new Error("número");
      return n;
    }
    throw new Error("token");
  }
  function term(): number {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const r = factor();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function expr(): number {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  try {
    const v = expr();
    if (i !== tokens.length || !Number.isFinite(v)) return null;
    return v;
  } catch {
    return null;
  }
}

/** Texto digitado -> centavos. Vazio = 0. Inválido = null. */
export function parseMoney(input: string): number | null {
  if (input.trim() === "") return 0;
  const v = evalExpression(input);
  if (v === null) return null;
  return Math.round(v * 100);
}
