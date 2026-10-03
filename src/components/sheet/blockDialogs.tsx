"use client";

import { useMemo, useState } from "react";
import { defaultSource, refLabel, refOptions, type RefGroup } from "@/lib/calc";
import { newColumnId } from "@/lib/client";
import { BLOCK_PRESETS, CARD_META, KIND_META } from "@/lib/kinds";
import type { Block, Kind, Member } from "@/lib/types";
import { Modal } from "../ui/Modal";
import type { NewBlock } from "./useMonth";

/** "card" é uma despesa marcada como cartão de crédito */
type NewKind = Kind | "card";
const KINDS: NewKind[] = ["income", "expense", "card", "savings", "total"];
const kindMeta = (k: NewKind) => (k === "card" ? CARD_META : KIND_META[k]);

type Row = NonNullable<NewBlock["rows"]>[number];
type TotalModel = "income" | "expense" | "left" | "blank";

/** Linhas prontas das tabelas de total. `who` = pessoa escolhida ou null (casal). */
function totalRows(model: TotalModel, who: Member | null, members: Member[]): Row[] {
  const row = (ref: string, sign: 1 | -1 = 1): Row => ({ description: refLabel(ref, [], members), ref, sign });
  // casal com pessoas cadastradas: uma linha por pessoa + o conjunto ("juntar o montante")
  const scopes = who ? [who.id] : members.length ? [...members.map((m) => m.id), "shared"] : [null];
  const suffix = (s: string | null) => (s ? `:${s}` : "");
  if (model === "income" || model === "expense") return scopes.map((s) => row(`kind:${model}${suffix(s)}`));
  if (model === "left") {
    const s = who ? `:${who.id}` : "";
    return [row(`kind:income${s}`), row(`kind:expense${s}`, -1), row(`kind:savings${s}`, -1)];
  }
  return [];
}

export function NewBlockDialog({
  members,
  onClose,
  onCreate,
  onManageMembers,
  defaultMemberId,
}: {
  members: Member[];
  onClose: () => void;
  onCreate: (b: NewBlock) => Promise<void>;
  onManageMembers: () => void;
  defaultMemberId: string | null;
}) {
  const [kind, setKind] = useState<NewKind>("expense");
  const [memberId, setMemberId] = useState<string | null>(defaultMemberId);
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<string | null>(null);
  const [model, setModel] = useState<TotalModel>("income");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const who = members.find((m) => m.id === memberId) ?? null;
  const whoName = who ? who.name : members.length ? "do casal" : "da casa";
  const models: { v: TotalModel; label: string; hint: string; name: string }[] = [
    {
      v: "income",
      label: "Juntar receitas",
      hint: who ? `Receitas de ${who.name}` : members.length ? "Salário de cada um somado em um total" : "Todas as receitas",
      name: who ? `Renda de ${who.name}` : `Renda ${whoName}`,
    },
    {
      v: "expense",
      label: "Juntar despesas",
      hint: who ? `Despesas de ${who.name}` : members.length ? "Despesas de cada um + as do conjunto" : "Todas as despesas",
      name: who ? `Despesas de ${who.name}` : `Despesas ${whoName}`,
    },
    {
      v: "left",
      label: "Quanto sobra",
      hint: "Receitas − despesas − economias",
      name: who ? `Sobra de ${who.name}` : `Sobra ${whoName}`,
    },
    { v: "blank", label: "Em branco", hint: "Você escolhe cada linha", name: "Total" },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const finalName =
      name.trim() ||
      (kind === "total"
        ? models.find((m) => m.v === model)!.name
        : kind === "card"
          ? who
            ? `Cartão (${who.name})`
            : "Cartão de crédito"
          : "");
    if (!finalName) return setError("Dê um nome à tabela.");
    const p = BLOCK_PRESETS.find((x) => x.name === preset && x.kind === kind);
    setBusy(true);
    try {
      await onCreate({
        name: finalName,
        kind: kind === "card" ? "expense" : kind,
        card: kind === "card" || undefined,
        memberId,
        columns: p?.columns?.map((c) => ({ id: newColumnId(), ...c })),
        rows: kind === "total" ? totalRows(model, who, members) : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a tabela.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Nova tabela" onClose={onClose} width="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className="label">Tipo de tabela</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {KINDS.map((k) => {
              const m = kindMeta(k);
              const active = kind === k;
              return (
                <button
                  type="button"
                  key={k}
                  onClick={() => {
                    setKind(k);
                    setPreset(null);
                  }}
                  aria-pressed={active}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                    active ? "border-brand bg-brand-soft" : "border-grid bg-white hover:bg-head"
                  }`}
                >
                  <span className="mt-1 h-3 w-3 shrink-0" style={{ background: m.color }} />
                  <span>
                    <span className="block text-[15px] font-semibold">{m.label}</span>
                    <span className="block text-[14px] text-muted">{m.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="block-owner">
            De quem é a tabela?
          </label>
          {members.length ? (
            <select
              id="block-owner"
              className="field"
              value={memberId ?? ""}
              onChange={(e) => setMemberId(e.target.value || null)}
            >
              <option value="">Conjunto (do casal)</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[15px] text-muted">
              Ainda não há pessoas cadastradas, então a tabela é da casa.{" "}
              <button type="button" className="font-medium text-brand hover:underline" onClick={onManageMembers}>
                Cadastrar marido, esposa...
              </button>
            </p>
          )}
        </div>

        {kind === "total" ? (
          <div>
            <span className="label">O que essa tabela calcula?</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {models.map((m) => (
                <label
                  key={m.v}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 ${
                    model === m.v ? "border-brand bg-brand-soft" : "border-grid hover:bg-head"
                  }`}
                >
                  <input
                    type="radio"
                    name="total-model"
                    className="mt-1 accent-[#107c41]"
                    checked={model === m.v}
                    onChange={() => setModel(m.v)}
                  />
                  <span>
                    <span className="block text-[15px] font-semibold">{m.label}</span>
                    <span className="block text-[14px] text-muted">{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[14px] text-muted">
              Depois você pode adicionar linhas apontando para qualquer tabela, pessoa ou saldo, somando ou
              subtraindo.
            </p>
          </div>
        ) : kind === "card" ? (
          <p className="text-[14px] text-muted">
            Depois de criar, defina o limite no rodapé do cartão. Nas tabelas de despesa aparece a coluna “Pagar com”:
            escolha o cartão e a despesa entra na fatura, descontando o limite em vez do saldo. Ao pagar a fatura, o
            valor pago sai das receitas.
          </p>
        ) : (
          <div>
            <span className="label">Modelos</span>
            <div className="flex flex-wrap gap-1.5">
              {BLOCK_PRESETS.filter((p) => p.kind === kind).map((p) => (
                <button
                  type="button"
                  key={p.name}
                  title={p.hint}
                  aria-pressed={preset === p.name}
                  className={`btn btn-sm ${preset === p.name ? "border-brand bg-brand-soft text-brand" : ""}`}
                  onClick={() => {
                    setPreset(p.name);
                    setName(who ? `${p.name} (${who.name})` : p.name);
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="block-name">
            Nome da tabela
          </label>
          <input
            id="block-name"
            className="field"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              kind === "total"
                ? models.find((m) => m.v === model)!.name
                : kind === "card"
                  ? "Ex.: Nubank, Itaú..."
                  : "Ex.: Mercado"
            }
          />
          {preset && (
            <p className="mt-1 text-[14px] text-muted">
              Vem com as colunas:{" "}
              {BLOCK_PRESETS.find((p) => p.name === preset)?.columns?.map((c) => c.name).join(", ") || "nenhuma extra"}
            </p>
          )}
        </div>

        {error && <p className="text-[15px] text-expense">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={busy}>
            Criar tabela
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Dono da tabela e origem do dinheiro                                 */
/* ------------------------------------------------------------------ */

export function RefSelect({
  id,
  value,
  groups,
  onChange,
  emptyLabel,
  className = "field",
  label,
}: {
  id?: string;
  value: string | null;
  groups: RefGroup[];
  onChange: (v: string | null) => void;
  emptyLabel: string;
  className?: string;
  label?: string;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      className={className}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{emptyLabel}</option>
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function BlockSettingsDialog({
  block,
  blocks,
  members,
  onClose,
  onSave,
}: {
  block: Block;
  blocks: Block[];
  members: Member[];
  onClose: () => void;
  onSave: (p: { memberId: string | null; source?: string | null; card?: boolean }) => void;
}) {
  const [memberId, setMemberId] = useState(block.memberId);
  const [source, setSource] = useState(block.source);
  const [card, setCard] = useState(block.card);
  const isExpense = block.kind === "expense";
  const charged = isExpense
    ? blocks.reduce((n, b) => n + b.entries.filter((e) => e.payWith === block.id).length, 0)
    : 0;
  const hasSource = block.kind === "expense" || block.kind === "savings";
  const groups = useMemo(() => refOptions(blocks, members, block.id), [blocks, members, block.id]);
  const def = refLabel(defaultSource({ memberId }, members), blocks, members);

  return (
    <Modal title={`Configurar “${block.name}”`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (block.card && !card && charged > 0) {
            const ok = window.confirm(
              `${charged} despesa(s) estão sendo pagas com este cartão e vão voltar a sair do saldo. Continuar?`,
            );
            if (!ok) return;
          }
          onSave({
            memberId,
            ...(hasSource ? { source } : {}),
            ...(isExpense && card !== block.card ? { card } : {}),
          });
          onClose();
        }}
      >
        <div>
          <label className="label" htmlFor="set-owner">
            De quem é a tabela?
          </label>
          <select
            id="set-owner"
            className="field"
            value={memberId ?? ""}
            onChange={(e) => setMemberId(e.target.value || null)}
          >
            <option value="">Conjunto (do casal)</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {!members.length && (
            <p className="mt-1 text-[14px] text-muted">Cadastre as pessoas em “Pessoas” no topo da planilha.</p>
          )}
        </div>
        {isExpense && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-grid px-3 py-2 hover:bg-head">
            <input
              type="checkbox"
              className="mt-1 accent-[#8a4fa3]"
              checked={card}
              onChange={(e) => setCard(e.target.checked)}
            />
            <span>
              <span className="block text-[15px] font-semibold">Esta tabela é um cartão de crédito</span>
              <span className="block text-[14px] text-muted">{CARD_META.hint}</span>
            </span>
          </label>
        )}
        {hasSource && (
          <div>
            <label className="label" htmlFor="set-source">
              {card ? "De onde sai o pagamento da fatura?" : "De onde sai o dinheiro?"}
            </label>
            <RefSelect id="set-source" value={source} groups={groups} onChange={setSource} emptyLabel={`Padrão: ${def}`} />
            <p className="mt-1 text-[14px] text-muted">
              A coluna “Saldo” começa com esse valor e vai descontando cada linha. Tabelas que usam a mesma origem
              continuam a conta uma da outra, na ordem da planilha. O limite em % também é calculado sobre ela.
            </p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary">Salvar</button>
        </div>
      </form>
    </Modal>
  );
}
