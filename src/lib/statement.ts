/**
 * Leitura de extratos bancários (OFX e CSV) e regras de categorização.
 * Funções puras: rodam no navegador (leitura do arquivo) e no servidor (regras).
 */

/** Uma linha do extrato. `amount` em centavos: negativo = saiu dinheiro, positivo = entrou. */
export interface StatementRow {
  /** identifica a linha entre importações (FITID do OFX ou assinatura da linha) */
  key: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  amount: number;
}

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */

/** Os bancos ainda exportam muito em Windows-1252; tenta UTF-8 primeiro. */
export function decodeFile(buf: ArrayBuffer): string {
  const head = new TextDecoder("latin1").decode(buf.slice(0, 400));
  if (/CHARSET:\s*(1252|ISO-8859-1)/i.test(head) || /encoding="(windows-1252|iso-8859-1)"/i.test(head))
    return new TextDecoder("windows-1252").decode(buf);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

/** "Padaria São João - 03/10" -> "padaria sao joao 03 10" */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const cleanDesc = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 200);

/* ------------------------------------------------------------------ */
/* Valores e datas                                                     */
/* ------------------------------------------------------------------ */

/**
 * "R$ -1.234,56" | "-1234.56" | "1.234,56 D" | "(50,00)" | "89,90-" -> centavos.
 * Sem separador decimal claro, "1.500" vale mil e quinhentos.
 */
export function parseAmount(raw: string): number | null {
  let t = raw.trim();
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) neg = true;
  if (/[-−]\s*$/.test(t) || /\sD$/i.test(t)) neg = true;
  t = t.replace(/\s[DC]$/i, "");
  if (/^[^\d]*[-−]/.test(t)) neg = true;
  t = t.replace(/[^\d.,]/g, "");
  if (!/\d/.test(t)) return null;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    t = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (lastComma >= 0) {
    t = (t.match(/,/g)!.length > 1 ? t.replace(/,/g, "") : t.replace(",", "."));
  } else if (lastDot >= 0 && (t.match(/\./g)!.length > 1 || /\.\d{3}$/.test(t))) {
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return neg ? -cents : cents;
}

const pad = (n: number) => String(n).padStart(2, "0");

function validDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** "03/10/2026" | "03/10/26" | "2026-10-03" | "03-10-2026 14:22" -> "2026-10-03" */
export function parseDate(raw: string): string | null {
  const t = raw.trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
  if (m) return validDate(+m[3], +m[2], +m[1]);
  m = t.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  return null;
}

/** Linhas idênticas (dois cafés iguais no mesmo dia) ganham um número de ordem. */
function signatureKeys(prefix: string) {
  const seen = new Map<string, number>();
  return (date: string, amount: number, description: string) => {
    const base = `${date}|${amount}|${normalizeText(description)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${prefix}:${base}|${n}`.slice(0, 300);
  };
}

/* ------------------------------------------------------------------ */
/* OFX                                                                 */
/* ------------------------------------------------------------------ */

export const isOfx = (text: string) => /<OFX>/i.test(text) || /OFXHEADER/i.test(text);

export interface OfxResult {
  rows: StatementRow[];
  /** extrato de cartão de crédito (CREDITCARDMSGSRSV1) */
  card: boolean;
  skipped: number;
}

export function parseOfx(text: string): OfxResult {
  // OFX 1.x é SGML: as tags de valor não fecham; lemos até o próximo "<" ou fim de linha
  const tag = (src: string, name: string) => {
    const m = src.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
    return m ? m[1].trim() : "";
  };
  const acct = tag(text, "ACCTID");
  const sig = signatureKeys("ofx");
  const rows: StatementRow[] = [];
  let skipped = 0;
  for (const m of text.matchAll(/<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi)) {
    const t = m[1];
    const date = parseDate(tag(t, "DTPOSTED"));
    const amount = parseAmount(tag(t, "TRNAMT"));
    const name = tag(t, "NAME");
    const memo = tag(t, "MEMO");
    const description = cleanDesc(
      name && memo && !memo.toLowerCase().includes(name.toLowerCase()) && !name.toLowerCase().includes(memo.toLowerCase())
        ? `${name} - ${memo}`
        : memo || name,
    );
    if (!date || amount === null || amount === 0) {
      skipped++;
      continue;
    }
    const fitid = tag(t, "FITID");
    const key = fitid ? `ofx:${acct}:${fitid}:${date}:${amount}`.slice(0, 300) : sig(date, amount, description);
    rows.push({ key, date, description: description || "(sem descrição)", amount });
  }
  return { rows, card: /<CREDITCARDMSGSRSV1>/i.test(text), skipped };
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

function detectDelimiter(lines: string[]): string {
  let best = ",";
  let bestScore = -1;
  for (const d of [";", ",", "\t", "|"]) {
    // o separador certo aparece o mesmo número de vezes (e mais de uma) nas linhas
    const counts = lines.slice(0, 15).map((l) => splitCsvLine(l, d).length);
    const common = counts.sort((a, b) => b - a)[Math.floor(counts.length / 2)] ?? 0;
    const score = common > 1 ? common * 10 + counts.filter((c) => c === common).length : 0;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

function splitCsvLine(line: string, d: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === d) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Colunas que a gente sabe ler. `amount` pode ser "cd": crédito menos débito, em duas colunas. */
export interface CsvMapping {
  date: number;
  description: number;
  /** segunda coluna de texto (ex.: BB "Lançamento" + "Detalhes"), juntada à descrição */
  description2: number;
  amount: number | "cd";
  credit: number;
  debit: number;
  id: number;
  /** a fatura do cartão lista as compras como valor positivo: inverte o sinal */
  invert: boolean;
}

export interface CsvTable {
  headers: string[];
  records: string[][];
  mapping: CsvMapping;
  /** parece fatura de cartão (ex.: CSV do Nubank: date,title,amount) */
  card: boolean;
}

const H = {
  date: /^(data|date|dt)\b|data (da )?(transa|compra|lan|mov)/,
  description: /descri|hist|title|titulo|estabelecimento|lancamento|memo|detalhe|favorecido|nome/,
  amount: /^(valor|amount|value|quantia|montante)|valor (r|em|da|do|final|em reais)|^r\$/,
  credit: /^(credito|entrada)s?\b|valor credito/,
  debit: /^(debito|saida)s?\b|valor debito/,
  id: /^(identificador|id|fitid|codigo da transa|id da transa)/,
};

export function parseCsv(text: string): CsvTable | null {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return null;
  const d = detectDelimiter(lines);
  const all = lines.map((l) => splitCsvLine(l, d));

  // alguns bancos põem um cabeçalho de texto antes da tabela: procura a linha com "data" e "valor"
  let headerIdx = all.slice(0, 25).findIndex((r) => {
    const n = r.map(normalizeText);
    return n.some((c) => H.date.test(c)) && n.some((c) => H.amount.test(c) || H.credit.test(c) || H.debit.test(c));
  });
  let headers: string[];
  let records: string[][];
  if (headerIdx >= 0) {
    headers = all[headerIdx];
    records = all.slice(headerIdx + 1);
  } else {
    headerIdx = all.findIndex((r) => r.some((c) => parseDate(c)));
    if (headerIdx < 0) return null;
    records = all.slice(headerIdx);
    const width = Math.max(...records.map((r) => r.length));
    headers = Array.from({ length: width }, (_, i) => `Coluna ${i + 1}`);
  }
  const width = headers.length;
  records = records.filter((r) => r.length >= Math.min(width, 2));

  const norm = headers.map(normalizeText);
  const find = (re: RegExp, except: number[] = []) => norm.findIndex((h, i) => re.test(h) && !except.includes(i));
  const sample = records.slice(0, 40);
  const share = (col: number, ok: (s: string) => boolean) =>
    sample.length ? sample.filter((r) => r[col] !== undefined && ok(r[col])).length / sample.length : 0;
  const byContent = (ok: (s: string) => boolean, except: number[]) => {
    let best = -1;
    let bestShare = 0.6;
    for (let i = 0; i < width; i++) {
      if (except.includes(i)) continue;
      const s = share(i, ok);
      if (s > bestShare) {
        best = i;
        bestShare = s;
      }
    }
    return best;
  };

  let date = find(H.date);
  if (date < 0) date = byContent((s) => parseDate(s) !== null, []);
  const id = find(H.id, [date]);
  let amount: number | "cd" = find(H.amount, [date, id].filter((x) => x >= 0));
  const credit = find(H.credit, [date]);
  const debit = find(H.debit, [date]);
  if (amount < 0 && credit >= 0 && debit >= 0) amount = "cd";
  if (amount === -1) amount = byContent((s) => /\d/.test(s) && parseAmount(s) !== null && !parseDate(s), [date, id]);
  const used = [date, id, typeof amount === "number" ? amount : -1, credit, debit].filter((x) => x >= 0);
  let description = find(H.description, used);
  if (description < 0) {
    // a coluna com o texto mais longo
    let longest = 0;
    for (let i = 0; i < width; i++) {
      if (used.includes(i)) continue;
      const len = sample.reduce((s, r) => s + (r[i]?.length ?? 0), 0);
      if (len > longest) {
        longest = len;
        description = i;
      }
    }
  }

  const description2 = description >= 0 ? find(H.description, [...used, description]) : -1;

  const nubankCard = norm.join(",") === "date,title,amount";
  const mapping: CsvMapping = { date, description, description2, amount, credit, debit, id, invert: false };
  // fatura: a maioria dos valores é positiva (compras), com um ou outro pagamento/estorno negativo
  const values = csvToRows({ headers, records, mapping, card: false }).rows.map((r) => r.amount);
  const positive = values.filter((v) => v > 0).length;
  const card = nubankCard || (amount !== "cd" && values.length >= 3 && positive / values.length > 0.7);
  mapping.invert = card;
  return { headers, records, mapping, card };
}

export function csvToRows(t: CsvTable): { rows: StatementRow[]; skipped: number } {
  const { mapping: m } = t;
  const sig = signatureKeys("csv");
  const rows: StatementRow[] = [];
  let skipped = 0;
  for (const r of t.records) {
    const date = m.date >= 0 ? parseDate(r[m.date] ?? "") : null;
    let amount: number | null;
    if (m.amount === "cd") {
      const c = parseAmount(r[m.credit] ?? "") ?? 0;
      const d = parseAmount(r[m.debit] ?? "") ?? 0;
      amount = Math.abs(c) - Math.abs(d);
    } else amount = m.amount >= 0 ? parseAmount(r[m.amount] ?? "") : null;
    const description = cleanDesc(
      [m.description, m.description2]
        .filter((c) => c >= 0)
        .map((c) => (r[c] ?? "").trim())
        .filter(Boolean)
        .join(" - "),
    );
    if (!date || amount === null || amount === 0) {
      skipped++;
      continue;
    }
    if (m.invert) amount = -amount;
    // linhas de saldo do dia não são lançamentos
    if (/^saldo\b|saldo (do dia|anterior|final)/.test(normalizeText(description))) {
      skipped++;
      continue;
    }
    const idv = m.id >= 0 ? (r[m.id] ?? "").trim() : "";
    const key = idv ? `csv:${idv}`.slice(0, 300) : sig(date, amount, description);
    rows.push({ key, date, description: description || "(sem descrição)", amount });
  }
  return { rows, skipped };
}

/* ------------------------------------------------------------------ */
/* Regras de categorização                                             */
/* ------------------------------------------------------------------ */

// palavras que os bancos colocam antes do nome do estabelecimento
const NOISE = new Set(
  "compra compras cartao card deb debito cred credito mc visa elo master mastercard no na em de da do das dos com e o a".split(" "),
);

/** Palavras que identificam o lançamento: "COMPRA CARTAO DEB 03/10 IFOOD *RESTAURANTE" -> "ifood restaurante". */
export function ruleKey(description: string): string {
  const words: string[] = [];
  for (const w of normalizeText(description).split(" ")) {
    if (!w || w.length < 2 || /\d/.test(w) || NOISE.has(w) || words.includes(w)) continue;
    words.push(w);
    if (words.length === 3) break;
  }
  return words.join(" ") || normalizeText(description).slice(0, 60);
}

/** Limpa o que a pessoa digitou como palavra-chave da regra. */
export const cleanPattern = (s: string) => normalizeText(s).split(" ").filter(Boolean).slice(0, 8).join(" ");

/**
 * Regra que vale para a descrição: todas as palavras da regra aparecem nela.
 * Ganha a regra mais específica (mais palavras). `rules` vem da mais recente para a mais antiga.
 */
export function matchRule<R extends { pattern: string }>(description: string, rules: R[]): R | null {
  const words = new Set(normalizeText(description).split(" "));
  let best: R | null = null;
  let bestLen = 0;
  for (const r of rules) {
    const p = r.pattern.split(" ").filter(Boolean);
    if (p.length > bestLen && p.every((w) => words.has(w))) {
      best = r;
      bestLen = p.length;
    }
  }
  return best;
}
