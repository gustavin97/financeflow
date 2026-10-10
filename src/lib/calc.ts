/**
 * Motor de cálculo do mês: faz as tabelas "conversarem".
 *
 * Uma referência (ref) é um texto que aponta para um valor do mês:
 *   block:<id>                    total de uma tabela (inclusive de outra tabela de total)
 *   kind:<tipo>                   soma de todas as tabelas do tipo (income | expense | savings)
 *   kind:<tipo>:<pessoa|shared>   idem, só as tabelas de uma pessoa ou do conjunto
 *   balance[:<pessoa|shared>]     saldo do mês (receitas − despesas − cofrinho)
 *   carry                         saldo acumulado dos meses anteriores
 *
 * Usado no navegador (planilha e painel) e no servidor.
 */
import { cardIds, cardInfo, cashTotals, onCard, type CardInfo } from "./summary";
import type { Block, Carry, Entry, EntryKind, Member } from "./types";

export const ENTRY_KINDS: EntryKind[] = ["income", "expense", "savings"];

export interface ScopeTotals {
  income: number;
  incomeDone: number;
  expense: number;
  expenseDone: number;
  savings: number;
  savingsDone: number;
  balance: number;
  balanceRealized: number;
}

export interface Running {
  /** ref efetiva de onde a tabela tira o dinheiro */
  source: string;
  /** valor disponível na fonte antes desta tabela */
  start: number;
  /** saldo depois de cada linha, na ordem da tabela */
  after: number[];
  end: number;
  /** tabelas anteriores que já usaram a mesma fonte */
  sharedWith: string[];
}

export interface MonthCalc {
  /** "all" (casa inteira), "shared" (conjunto) ou id da pessoa */
  scopes: Map<string, ScopeTotals>;
  blockValue(id: string): number;
  rowValue(block: Block, entry: Entry): number;
  resolve(ref: string): number;
  running: Map<string, Running>;
  /** tabelas de total que se referenciam em círculo */
  cyclic: Set<string>;
  sourceOf(block: Block): string;
  /** cartões de crédito do mês */
  cards: Map<string, CardInfo>;
}

const emptyScope = (): ScopeTotals => ({
  income: 0,
  incomeDone: 0,
  expense: 0,
  expenseDone: 0,
  savings: 0,
  savingsDone: 0,
  balance: 0,
  balanceRealized: 0,
});

/** Pessoa dona da tabela, ou "shared" quando é do casal (ou a pessoa foi removida). */
export function ownerScope(b: Pick<Block, "memberId">, members: Member[]): string {
  return b.memberId && members.some((m) => m.id === b.memberId) ? b.memberId : "shared";
}

export function defaultSource(b: Pick<Block, "memberId">, members: Member[]): string {
  const scope = ownerScope(b, members);
  return scope === "shared" ? "kind:income" : `kind:income:${scope}`;
}

export function buildCalc(blocks: Block[], members: Member[], carry: Carry): MonthCalc {
  const scopes = new Map<string, ScopeTotals>();
  const scope = (k: string) => {
    let s = scopes.get(k);
    if (!s) scopes.set(k, (s = emptyScope()));
    return s;
  };
  scope("all");
  scope("shared");
  for (const m of members) scope(m.id);

  const cardSet = cardIds(blocks);
  const cards = new Map<string, CardInfo>();
  for (const id of cardSet) cards.set(id, cardInfo(blocks.find((b) => b.id === id)!, blocks));

  const plainTotals = new Map<string, number>();
  for (const b of blocks) {
    if (b.kind === "total") continue;
    const t = cashTotals(b, cardSet);
    // nas referências, um cartão vale a fatura inteira; receita e despesa só o que já foi recebido/pago
    plainTotals.set(b.id, cards.get(b.id)?.net ?? (b.kind === "income" || b.kind === "expense" ? t.done : t.total));
    for (const s of [scope("all"), scope(ownerScope(b, members))]) {
      if (b.kind === "income") (s.income += t.total), (s.incomeDone += t.done);
      else if (b.kind === "expense") (s.expense += t.total), (s.expenseDone += t.done);
      else (s.savings += t.total), (s.savingsDone += t.done);
    }
  }
  for (const s of scopes.values()) {
    s.balance = s.income - s.expense - s.savings;
    s.balanceRealized = s.incomeDone - s.expenseDone - s.savingsDone;
  }

  const byId = new Map(blocks.map((b) => [b.id, b]));
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const cyclic = new Set<string>();

  function blockValue(id: string): number {
    const plain = plainTotals.get(id);
    if (plain !== undefined) return plain;
    const b = byId.get(id);
    if (!b) return 0;
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) {
      cyclic.add(id);
      return 0;
    }
    visiting.add(id);
    const v = b.entries.reduce((s, e) => s + rowValue(b, e), 0);
    visiting.delete(id);
    memo.set(id, v);
    return v;
  }

  function rowValue(b: Block, e: Entry): number {
    if (b.kind !== "total") return e.amount;
    return (e.ref ? resolve(e.ref) : e.amount) * (e.sign === -1 ? -1 : 1);
  }

  function resolve(ref: string): number {
    const [head, a, b] = ref.split(":");
    if (head === "block" && a) return blockValue(a);
    if (head === "carry") return carry.planned;
    if (head === "balance") return scopes.get(a ?? "all")?.balance ?? 0;
    if (head === "kind" && (ENTRY_KINDS as string[]).includes(a)) {
      const s = scopes.get(b ?? "all");
      return s ? s[a as EntryKind] : 0;
    }
    return 0;
  }

  const sourceOf = (b: Block) => b.source || defaultSource(b, members);

  /** Como resolve, mas as receitas valem só o que já foi recebido. */
  function cash(ref: string): number {
    const [head, a, b] = ref.split(":");
    if (head === "kind" && a === "income") return scopes.get(b ?? "all")?.incomeDone ?? 0;
    return resolve(ref);
  }

  // O saldo é o dinheiro em conta (débito): parte do que já foi recebido e
  // cada fonte vai sendo consumida pelas tabelas na ordem em que aparecem.
  // Só saem do saldo despesas pagas e economias guardadas. Linhas pagas com
  // cartão não consomem a fonte; o cartão consome só o valor pago da fatura.
  // Gastar das receitas de uma pessoa também consome o total da casa
  // (kind:income:<pessoa> faz parte de kind:income), senão o dinheiro contaria duas vezes.
  // O dinheiro segue receitas → despesas → economias: as economias guardam a
  // sobra das despesas pagas (mesmo de tabelas que aparecem depois delas) e
  // as despesas não descontam as economias. O cartão é crédito: o pagamento
  // dele não entra no saldo das outras tabelas.
  const running = new Map<string, Running>();
  const containers = (ref: string) => {
    const [head, k, who] = ref.split(":");
    return head === "kind" && who ? [ref, `kind:${k}`] : [ref];
  };
  const spenders = blocks
    // o cartão é crédito: não consome a fonte (o pagamento é linha de despesa)
    .filter((b) => (b.kind === "expense" || b.kind === "savings") && !cards.has(b.id))
    .map((b, order) => {
      const spent = b.entries.reduce((s, e) => (onCard(e, cardSet) || e.status !== "done" ? s : s + e.amount), 0);
      return { b, order, source: sourceOf(b), spent };
    });
  const comesBefore = (x: (typeof spenders)[number], y: (typeof spenders)[number]) => {
    if (x.b.kind === "savings") return y.b.kind === "savings" && x.order < y.order;
    return y.b.kind === "savings" || x.order < y.order;
  };
  for (const s of spenders) {
    const { b, source } = s;
    const prior = spenders.filter((o) => o !== s && comesBefore(o, s) && containers(o.source).includes(source));
    const start = cash(source) - prior.reduce((t, o) => t + o.spent, 0);
    let bal = start;
    const after = b.entries.map((e) => (onCard(e, cardSet) || e.status !== "done" ? bal : (bal -= e.amount)));
    running.set(b.id, { source, start, after, end: bal, sharedWith: prior.map((o) => o.b.name) });
  }

  // força a avaliação para detectar ciclos antes de desenhar
  for (const b of blocks) if (b.kind === "total") blockValue(b.id);

  return { scopes, blockValue, rowValue, resolve, running, cyclic, sourceOf, cards };
}

/* ------------------------------------------------------------------ */
/* Rótulos e opções para as telas                                      */
/* ------------------------------------------------------------------ */

const KIND_WORD: Record<EntryKind, string> = {
  income: "Receitas",
  expense: "Despesas",
  savings: "Cofrinho",
};

function scopeName(s: string | undefined, members: Member[]): string | null {
  if (!s) return null;
  if (s === "shared") return "do conjunto";
  const m = members.find((x) => x.id === s);
  return m ? `de ${m.name}` : "(pessoa removida)";
}

export function refLabel(ref: string, blocks: Block[], members: Member[]): string {
  const [head, a, b] = ref.split(":");
  if (head === "block") return blocks.find((x) => x.id === a)?.name ?? "(tabela excluída)";
  if (head === "carry") return "Saldo dos meses anteriores";
  if (head === "balance") {
    const who = scopeName(a, members);
    return who ? `Saldo ${who}` : "Saldo do mês";
  }
  if (head === "kind" && (ENTRY_KINDS as string[]).includes(a)) {
    const who = scopeName(b, members);
    const word = KIND_WORD[a as EntryKind];
    return who ? `${word} ${who}` : a === "savings" ? "Todo o cofrinho" : `Todas as ${word.toLowerCase()}`;
  }
  return "(referência inválida)";
}

export interface RefGroup {
  label: string;
  options: { value: string; label: string }[];
}

export function refOptions(blocks: Block[], members: Member[], exceptBlockId?: string): RefGroup[] {
  const lab = (r: string) => ({ value: r, label: refLabel(r, blocks, members) });
  const groups: RefGroup[] = [
    {
      label: "Casa inteira",
      options: ["kind:income", "kind:expense", "kind:savings", "balance", "carry"].map(lab),
    },
  ];
  if (members.length) {
    for (const m of members)
      groups.push({
        label: m.name,
        options: [...ENTRY_KINDS.map((k) => `kind:${k}:${m.id}`), `balance:${m.id}`].map(lab),
      });
    groups.push({
      label: "Conjunto",
      options: [...ENTRY_KINDS.map((k) => `kind:${k}:shared`), "balance:shared"].map(lab),
    });
  }
  const others = blocks.filter((b) => b.id !== exceptBlockId);
  if (others.length)
    groups.push({ label: "Tabelas deste mês", options: others.map((b) => ({ value: `block:${b.id}`, label: b.name })) });
  return groups;
}

/** Troca ids de tabela dentro de uma ref (usado ao copiar um mês). */
export function remapRef(ref: string | null, ids: Map<string, string>): string | null {
  if (!ref?.startsWith("block:")) return ref;
  const next = ids.get(ref.slice(6));
  return next ? `block:${next}` : null;
}

export const REF_RE = /^(block:[\w-]{1,64}|kind:(income|expense|savings)(:[\w-]{1,64})?|balance(:[\w-]{1,64})?|carry)$/;
