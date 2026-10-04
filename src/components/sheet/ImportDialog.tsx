"use client";

import { FileUp, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, errMsg } from "@/lib/client";
import { ymLabel } from "@/lib/dates";
import { KIND_META } from "@/lib/kinds";
import { fmtBRL } from "@/lib/money";
import {
  csvToRows,
  decodeFile,
  isOfx,
  matchRule,
  parseCsv,
  parseOfx,
  ruleKey,
  type CsvMapping,
  type CsvTable,
  type StatementRow,
} from "@/lib/statement";
import type { Block, EntryKind, Member } from "@/lib/types";
import { Modal } from "../ui/Modal";
import type { NewImport } from "./useMonth";

type Source = { kind: "ofx"; rows: StatementRow[]; skipped: number; card: boolean } | { kind: "csv"; table: CsvTable };
type Preview = { rules: { id: string; pattern: string; blockId: string }[]; seen: Set<string> };

const NONE = "";

/**
 * Importar extrato: lê OFX/CSV no navegador, sugere a tabela de cada lançamento
 * pelas regras aprendidas e grava tudo de uma vez. O que a pessoa corrige vira regra.
 */
export function ImportDialog({
  ym,
  blocks,
  members,
  onClose,
  onImport,
}: {
  ym: string;
  blocks: Block[];
  members: Member[];
  onClose: () => void;
  onImport: (input: NewImport) => Promise<{ imported: number; learned: number }>;
}) {
  const [fileName, setFileName] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [payWith, setPayWith] = useState(NONE);
  const [fallbackOut, setFallbackOut] = useState(NONE);
  const [fallbackIn, setFallbackIn] = useState(NONE);
  /** tabela escolhida à mão, por linha (NONE = não importar) */
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ imported: number; learned: number } | null>(null);

  const targets = blocks.filter((b) => b.kind !== "total");
  const cards = targets.filter((b) => b.kind === "expense" && b.card);
  const firstOf = (kind: EntryKind) => targets.find((b) => b.kind === kind && !b.card)?.id ?? NONE;

  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name;
  const blockLabel = (b: Block) => [b.name, memberName(b.memberId)].filter(Boolean).join(" · ");
  const groups = (["expense", "income", "savings"] as EntryKind[])
    .map((k) => ({ kind: k, items: targets.filter((b) => b.kind === k) }))
    .filter((g) => g.items.length);

  /** quem paga muda o padrão das saídas (cartão: entram na fatura) e das entradas */
  const choosePayWith = (id: string) => {
    setPayWith(id);
    setFallbackOut(id || firstOf("expense"));
    setFallbackIn(id ? NONE : firstOf("income"));
  };

  async function pick(file: File) {
    setError(null);
    setPreview(null);
    setChosen({});
    setFileName(file.name);
    if (file.size > 5 * 1024 * 1024) return setError("Arquivo muito grande (máx. 5 MB).");
    const text = decodeFile(await file.arrayBuffer());
    let next: Source | null = null;
    if (isOfx(text)) {
      const r = parseOfx(text);
      next = { kind: "ofx", ...r };
      if (!r.rows.length) return setError("Não encontrei lançamentos neste OFX.");
    } else {
      const table = parseCsv(text);
      if (!table || !table.records.length)
        return setError("Não reconheci este arquivo. Use o extrato em OFX ou CSV exportado pelo banco.");
      next = { kind: "csv", table };
      setMapping(table.mapping);
    }
    setSource(next);
    const card = next.kind === "ofx" ? next.card : next.table.card;
    choosePayWith(card && cards.length ? cards[0].id : NONE);
  }

  const parsed = useMemo(() => {
    if (!source) return { rows: [] as StatementRow[], skipped: 0 };
    if (source.kind === "ofx") return source;
    return csvToRows({ ...source.table, mapping: mapping ?? source.table.mapping });
  }, [source, mapping]);
  const rows = parsed.rows;

  // regras e "já importado" dependem das chaves: muda quando muda o mapeamento do CSV
  const keysSig = rows.map((r) => r.key).join("\n");
  useEffect(() => {
    if (!rows.length) return;
    let alive = true;
    api<{ rules: Preview["rules"]; seen: string[] }>("/api/import/preview", {
      body: { ym, keys: rows.map((r) => r.key) },
    })
      .then((p) => alive && setPreview({ rules: p.rules, seen: new Set(p.seen) }))
      .catch((e) => alive && setError(errMsg(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSig, ym]);

  const lines = useMemo(
    () =>
      rows.map((r) => {
        const rule = preview ? matchRule(r.description, preview.rules) : null;
        const seen = !!preview?.seen.has(r.key);
        const inMonth = r.date.startsWith(ym);
        // fatura do cartão traz compras do mês anterior; extrato da conta, só o mês aberto
        const auto =
          seen || (!payWith && !inMonth) ? NONE : (rule?.blockId ?? (r.amount < 0 ? fallbackOut : fallbackIn));
        const manual = r.key in chosen;
        const target = manual ? chosen[r.key] : auto;
        const learn = remember && manual && target !== NONE && target !== rule?.blockId ? ruleKey(r.description) : null;
        return { r, rule, seen, inMonth, target, manual, learn };
      }),
    [rows, preview, payWith, fallbackOut, fallbackIn, chosen, remember, ym],
  );

  /** escolher a tabela de uma linha leva junto as parecidas que ainda não foram mexidas */
  const choose = (line: (typeof lines)[number], blockId: string) => {
    const key = ruleKey(line.r.description);
    setChosen((c) => {
      const next = { ...c, [line.r.key]: blockId };
      if (blockId !== NONE)
        for (const l of lines)
          if (!(l.r.key in c) && l.target !== NONE && l.r.key !== line.r.key && ruleKey(l.r.description) === key)
            next[l.r.key] = blockId;
      return next;
    });
  };

  const included = lines.filter((l) => l.target !== NONE);
  const totalOut = included.reduce((s, l) => s + Math.min(l.r.amount, 0), 0);
  const totalIn = included.reduce((s, l) => s + Math.max(l.r.amount, 0), 0);
  const learnCount = new Set(included.map((l) => l.learn).filter(Boolean)).size;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const learn = new Map<string, string>();
      for (const l of included) if (l.learn) learn.set(l.learn, l.target);
      setDone(
        await onImport({
          payWith: payWith || null,
          rows: included.map((l) => ({
            key: l.r.key,
            blockId: l.target,
            description: l.r.description,
            amount: l.r.amount,
            date: l.r.date,
          })),
          learn: [...learn].map(([pattern, blockId]) => ({ pattern, blockId })),
        }),
      );
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const tableSelect = (value: string, onChange: (v: string) => void, props: { id?: string; className?: string; label?: string }) => (
    <select
      id={props.id}
      aria-label={props.label}
      className={props.className ?? "field"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value={NONE}>Não importar</option>
      {groups.map((g) => (
        <optgroup key={g.kind} label={KIND_META[g.kind].plural}>
          {g.items.map((b) => (
            <option key={b.id} value={b.id}>
              {blockLabel(b)}
              {b.card ? " (cartão)" : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  /* ---------- concluído ---------- */
  if (done)
    return (
      <Modal title="Extrato importado" onClose={onClose}>
        <p className="text-[15.5px]">
          <strong>{done.imported}</strong> lançamento{done.imported === 1 ? "" : "s"} entr
          {done.imported === 1 ? "ou" : "aram"} em {ymLabel(ym)}, já marcados como pagos/recebidos.
        </p>
        {done.learned > 0 && (
          <p className="mt-2 text-[15px] text-muted">
            {done.learned} regra{done.learned === 1 ? " nova" : "s novas"}: na próxima importação esses lançamentos já vão
            para a tabela certa. Dá para ajustar em <em>Conta → Regras da importação</em>.
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <button className="btn btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </Modal>
    );

  return (
    <Modal title="Importar extrato do banco" onClose={onClose} width={source ? "max-w-6xl" : "max-w-lg"}>
      <div className="space-y-4">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[#aab3bb] bg-head/60 px-4 py-3 hover:border-brand hover:bg-brand-soft">
          <FileUp size={22} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15.5px] font-semibold">
              {fileName || "Escolher arquivo OFX ou CSV"}
            </span>
            <span className="block text-[14px] text-muted">
              No app ou site do banco, exporte o extrato (ou a fatura do cartão) em OFX, também chamado de “Money” ou
              “Quicken”, ou em CSV.
            </span>
          </span>
          <input
            type="file"
            accept=".ofx,.qfx,.csv,.txt,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pick(f);
              e.target.value = "";
            }}
          />
        </label>

        {source && (
          <>
            {source.kind === "csv" && mapping && (
              <CsvMappingEditor table={source.table} mapping={mapping} onChange={setMapping} />
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              {cards.length > 0 && (
                <div>
                  <label className="label" htmlFor="imp-pay">
                    Este arquivo é
                  </label>
                  <select id="imp-pay" className="field" value={payWith} onChange={(e) => choosePayWith(e.target.value)}>
                    <option value={NONE}>Extrato da conta</option>
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        Fatura do {blockLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label" htmlFor="imp-out">
                  Saídas sem regra vão para
                </label>
                {tableSelect(fallbackOut, setFallbackOut, { id: "imp-out" })}
              </div>
              <div>
                <label className="label" htmlFor="imp-in">
                  {payWith ? "Estornos e pagamentos da fatura" : "Entradas sem regra vão para"}
                </label>
                {tableSelect(fallbackIn, setFallbackIn, { id: "imp-in" })}
              </div>
            </div>
            {payWith && (
              <p className="-mt-1 text-[14px] text-muted">
                Compras mandadas para outras tabelas de despesa ficam como <em>pagas com o cartão</em>: entram na fatura e
                descontam o limite.
              </p>
            )}

            <div className="max-h-[52vh] overflow-auto rounded-lg border border-line">
              <table className="sheet" style={{ minWidth: 760 }}>
                <colgroup>
                  <col style={{ width: 104 }} />
                  <col />
                  <col style={{ width: 128 }} />
                  <col style={{ width: 290 }} />
                </colgroup>
                <thead className="sticky top-0 z-[1]">
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th className="!text-right">Valor</th>
                    <th>Tabela</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.r.key} className={l.target === NONE ? "bg-head/70 text-muted" : ""}>
                      <td className="px-2.5 tabular-nums">{l.r.date.split("-").reverse().join("/")}</td>
                      <td className="px-2.5">
                        <div className="truncate" title={l.r.description}>
                          {l.r.description}
                        </div>
                        <Tags line={l} />
                      </td>
                      <td
                        className={`px-2.5 text-right tabular-nums ${l.target === NONE ? "" : l.r.amount < 0 ? "text-expense" : "text-income"}`}
                      >
                        {fmtBRL(l.r.amount)}
                      </td>
                      <td className="px-1">
                        {tableSelect(l.target, (v) => choose(l, v), {
                          label: `Tabela de ${l.r.description}`,
                          className: `h-9 w-full rounded-md border bg-white px-2 text-[14.5px] outline-none focus:border-brand ${
                            l.manual ? "border-brand/60" : "border-line"
                          }`,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.skipped > 0 && (
              <p className="text-[14px] text-muted">
                {parsed.skipped} linha{parsed.skipped === 1 ? "" : "s"} sem data ou valor (saldos, cabeçalhos) ficaram de fora.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-grid pt-3">
              <label className="flex items-center gap-2 text-[15px]">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Lembrar minhas escolhas nas próximas importações
                {learnCount > 0 && <span className="text-muted">({learnCount} regra{learnCount === 1 ? "" : "s"})</span>}
              </label>
              <div className="ml-auto flex flex-wrap items-center gap-3">
                <span className="text-[15px] text-muted">
                  {included.length} de {lines.length} ·{" "}
                  <span className="text-expense">{fmtBRL(totalOut)}</span>
                  {totalIn > 0 && (
                    <>
                      {" "}· <span className="text-income">+{fmtBRL(totalIn)}</span>
                    </>
                  )}
                </span>
                <button className="btn" onClick={onClose}>
                  Cancelar
                </button>
                <button className="btn btn-primary" disabled={busy || !preview || !included.length} onClick={submit}>
                  {busy ? "Importando..." : `Importar ${included.length}`}
                </button>
              </div>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="text-[15px] text-expense">
            {error}
          </p>
        )}
        {!targets.length && (
          <p className="text-[15px] text-expense">Crie as tabelas do mês antes de importar.</p>
        )}
      </div>
    </Modal>
  );
}

function Tags({
  line,
}: {
  line: { rule: { pattern: string } | null; seen: boolean; inMonth: boolean; manual: boolean; learn: string | null };
}) {
  const tag = "mr-1.5 inline-flex items-center gap-1 rounded px-1.5 text-[12.5px] leading-[18px]";
  return (
    <div className="-mt-0.5 mb-1 min-h-0 empty:hidden">
      {line.seen && <span className={`${tag} bg-amber-100 text-amber-900`}>já importado</span>}
      {!line.inMonth && <span className={`${tag} bg-head text-muted`}>outro mês</span>}
      {line.learn ? (
        <span className={`${tag} bg-brand-soft text-brand`} title="Vira uma regra ao importar">
          <Sparkles size={11} /> lembrar “{line.learn}”
        </span>
      ) : (
        line.rule &&
        !line.manual && (
          <span className={`${tag} bg-brand-soft text-brand`} title="Tabela escolhida por uma regra">
            regra “{line.rule.pattern}”
          </span>
        )
      )}
    </div>
  );
}

/** Quais colunas do CSV são data, descrição e valor (já vem adivinhado). */
function CsvMappingEditor({
  table,
  mapping,
  onChange,
}: {
  table: CsvTable;
  mapping: CsvMapping;
  onChange: (m: CsvMapping) => void;
}) {
  const cols = table.headers.map((h, i) => ({ i, label: h || `Coluna ${i + 1}` }));
  const hasCd = mapping.credit >= 0 && mapping.debit >= 0;
  const sel = (id: string, label: string, value: number | "cd", set: (v: number | "cd") => void, cd = false) => (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="field"
        value={String(value)}
        onChange={(e) => set(e.target.value === "cd" ? "cd" : Number(e.target.value))}
      >
        <option value="-1">—</option>
        {cd && hasCd && <option value="cd">Crédito − Débito (2 colunas)</option>}
        {cols.map((c) => (
          <option key={c.i} value={c.i}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <fieldset className="rounded-lg border border-grid px-3 pb-3 pt-1">
      <legend className="px-1 text-[14px] font-medium text-muted">Colunas do CSV</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {sel("csv-date", "Data", mapping.date, (v) => onChange({ ...mapping, date: v as number }))}
        {sel("csv-desc", "Descrição", mapping.description, (v) => onChange({ ...mapping, description: v as number }))}
        {sel("csv-desc2", "Mais descrição", mapping.description2, (v) => onChange({ ...mapping, description2: v as number }))}
        {sel("csv-amount", "Valor", mapping.amount, (v) => onChange({ ...mapping, amount: v }), true)}
        <label className="flex items-end gap-2 pb-2.5 text-[15px]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand"
            checked={mapping.invert}
            onChange={(e) => onChange({ ...mapping, invert: e.target.checked })}
          />
          Compras aparecem positivas (fatura)
        </label>
      </div>
    </fieldset>
  );
}
