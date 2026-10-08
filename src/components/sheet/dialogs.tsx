"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { errMsg, newColumnId } from "@/lib/client";
import { addMonths, monthRange, todayIso, ymShort } from "@/lib/dates";
import { centsToInput, fmtBRL, parseMoney } from "@/lib/money";
import type { Block, BudgetType, ColType, ExtraColumn } from "@/lib/types";
import { Modal } from "../ui/Modal";
import { DateInput } from "./cells";
import type { NewInstallment } from "./useMonth";

/* ------------------------------------------------------------------ */
/* Limite / meta do mês                                                */
/* ------------------------------------------------------------------ */
export function BudgetDialog({
  block,
  onClose,
  onSave,
}: {
  block: Block;
  onClose: () => void;
  onSave: (type: BudgetType, value: number) => void;
}) {
  const isSavings = block.kind === "savings";
  const [type, setType] = useState<BudgetType>(block.budgetType);
  const [text, setText] = useState(
    block.budgetType === "amount"
      ? centsToInput(block.budgetValue)
      : block.budgetType === "percent"
        ? String(block.budgetValue).replace(".", ",")
        : "",
  );
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (type === "none") {
      onSave("none", 0);
      onClose();
      return;
    }
    if (type === "amount") {
      const cents = parseMoney(text);
      if (cents === null || cents <= 0) return setError("Informe um valor maior que zero.");
      onSave("amount", cents);
    } else {
      const n = Number(text.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0 || n > 1000)
        return setError("Informe uma porcentagem entre 0 e 1000.");
      onSave("percent", n);
    }
    onClose();
  }

  const options: { v: BudgetType; label: string; hint: string }[] = [
    { v: "none", label: "Sem limite", hint: "A tabela não é comparada com nada." },
    { v: "amount", label: "Valor fixo", hint: "Ex.: R$ 500,00 por mês." },
    { v: "percent", label: "% da renda", hint: "Calculado sobre o dinheiro de onde a tabela sai (por padrão, as receitas do dono)." },
  ];

  return (
    <Modal title={isSavings ? `Meta do mês para “${block.name}”` : `Limite de “${block.name}”`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2">
          {options.map((o) => (
            <label
              key={o.v}
              className={`flex cursor-pointer items-start gap-3 border px-3 py-2 ${
                type === o.v ? "border-brand bg-brand-soft" : "border-grid hover:bg-head"
              }`}
            >
              <input
                type="radio"
                name="budget"
                className="mt-1 accent-[#107c41]"
                checked={type === o.v}
                onChange={() => {
                  setType(o.v);
                  setError(null);
                }}
              />
              <span>
                <span className="block text-[15px] font-semibold">{o.label}</span>
                <span className="block text-[14px] text-muted">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {type !== "none" && (
          <div>
            <label className="label" htmlFor="budget-value">
              {type === "amount" ? "Valor (R$)" : "Porcentagem da renda (%)"}
            </label>
            <input
              id="budget-value"
              className="field"
              inputMode="decimal"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={type === "amount" ? "500,00" : "10"}
            />
          </div>
        )}
        {error && <p className="text-[15px] text-expense">{error}</p>}
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

/* ------------------------------------------------------------------ */
/* Colunas extras                                                      */
/* ------------------------------------------------------------------ */
const TYPE_LABEL: Record<ColType, string> = {
  text: "Texto",
  number: "Número",
  currency: "Valor em R$",
  date: "Data",
};

export function ColumnsDialog({
  block,
  onClose,
  onSave,
}: {
  block: Block;
  onClose: () => void;
  onSave: (columns: ExtraColumn[]) => void;
}) {
  const [cols, setCols] = useState<ExtraColumn[]>(block.columns);
  const [name, setName] = useState("");
  const [type, setType] = useState<ColType>("text");
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (!name.trim()) return setError("Dê um nome à coluna.");
    if (cols.length >= 12) return setError("No máximo 12 colunas extras por tabela.");
    setCols([...cols, { id: newColumnId(), name: name.trim(), type }]);
    setName("");
    setError(null);
  }

  return (
    <Modal title={`Colunas de “${block.name}”`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-[15px] text-muted">
          Além de descrição, valor, data e status, você pode criar colunas próprias, como loja,
          parcela ou categoria. Colunas numéricas ganham soma no rodapé.
        </p>

        {cols.length > 0 && (
          <ul className="divide-y divide-grid overflow-hidden rounded-lg border border-line">
            {cols.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-2 py-1.5">
                <input
                  className="field h-10 flex-1"
                  value={c.name}
                  maxLength={40}
                  aria-label="Nome da coluna"
                  onChange={(e) =>
                    setCols(cols.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))
                  }
                />
                <span className="w-[92px] shrink-0 text-[14px] text-muted">{TYPE_LABEL[c.type]}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm h-10 w-10 px-0 text-expense"
                  aria-label={`Excluir coluna ${c.name}`}
                  onClick={() => setCols(cols.filter((x) => x.id !== c.id))}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-lg border border-dashed border-grid p-3">
          <span className="label">Nova coluna</span>
          <div className="flex gap-2">
            <input
              className="field flex-1"
              placeholder="Nome da coluna"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <select
              className="field w-[130px]"
              value={type}
              onChange={(e) => setType(e.target.value as ColType)}
              aria-label="Tipo da coluna"
            >
              {(Object.keys(TYPE_LABEL) as ColType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <button type="button" className="btn h-11" onClick={add}>
              <Plus size={16} /> Adicionar
            </button>
          </div>
        </div>

        {error && <p className="text-[15px] text-expense">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (cols.some((c) => !c.name.trim())) return setError("Toda coluna precisa de um nome.");
              onSave(cols.map((c) => ({ ...c, name: c.name.trim() })));
              onClose();
            }}
          >
            Salvar colunas
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Compra parcelada                                                    */
/* ------------------------------------------------------------------ */
export function InstallmentDialog({
  block,
  ym,
  cards,
  onClose,
  onSave,
}: {
  block: Block;
  ym: string;
  /** cartões do mês para "Pagar com" (vazio quando a tabela já é um cartão) */
  cards: Block[];
  onClose: () => void;
  onSave: (input: NewInstallment) => Promise<void>;
}) {
  const range = monthRange(ym);
  const today = todayIso();
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"total" | "each">("total");
  const [valueText, setValueText] = useState("");
  const [countText, setCountText] = useState("12");
  const [currentText, setCurrentText] = useState("1");
  const [date, setDate] = useState(today >= range.min && today <= range.max ? today : "");
  const [payWith, setPayWith] = useState(cards[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const value = parseMoney(valueText);
  const count = Number(countText);
  const current = Number(currentText);
  const validCount = Number.isInteger(count) && count >= 2 && count <= 72;
  const validCurrent = validCount && Number.isInteger(current) && current >= 1 && current <= count;
  const total = value && value > 0 && validCount ? (mode === "total" ? value : value * count) : null;
  const each = total ? Math.floor(total / count) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return setError("Descreva a compra.");
    if (!validCount) return setError("Informe de 2 a 72 parcelas.");
    if (!total) return setError("Informe o valor da compra.");
    if (!validCurrent) return setError(`A parcela deste mês vai de 1 a ${count}.`);
    setSaving(true);
    setError(null);
    try {
      await onSave({
        description: description.trim(),
        total,
        count,
        currentNo: current,
        date: date || null,
        payWith: payWith || null,
      });
      onClose();
    } catch (err) {
      setError(errMsg(err));
      setSaving(false);
    }
  }

  const modes = [
    { v: "total", label: "Valor total" },
    { v: "each", label: "Valor da parcela" },
  ] as const;

  return (
    <Modal title={`Compra parcelada em “${block.name}”`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="inst-desc">
            Descrição
          </label>
          <input
            id="inst-desc"
            className="field"
            autoFocus
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Geladeira"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {modes.map((o) => (
            <label
              key={o.v}
              className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-[15px] ${
                mode === o.v ? "border-brand bg-brand-soft font-semibold" : "border-grid hover:bg-head"
              }`}
            >
              <input
                type="radio"
                name="inst-mode"
                className="accent-[#107c41]"
                checked={mode === o.v}
                onChange={() => setMode(o.v)}
              />
              {o.label}
            </label>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="inst-value">
              {mode === "total" ? "Total (R$)" : "Parcela (R$)"}
            </label>
            <input
              id="inst-value"
              className="field"
              inputMode="decimal"
              value={valueText}
              onChange={(e) => setValueText(e.target.value)}
              placeholder={mode === "total" ? "2.400,00" : "200,00"}
            />
          </div>
          <div>
            <label className="label" htmlFor="inst-count">
              Parcelas
            </label>
            <input
              id="inst-count"
              className="field"
              inputMode="numeric"
              value={countText}
              onChange={(e) => setCountText(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div>
            <label
              className="label"
              htmlFor="inst-current"
              title="Para compras feitas antes: em qual parcela ela está neste mês"
            >
              Parcela deste mês
            </label>
            <input
              id="inst-current"
              className="field"
              inputMode="numeric"
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>

        <div className={`grid gap-3 ${cards.length ? "grid-cols-2" : ""}`}>
          <div>
            <label className="label" htmlFor="inst-date">
              Data da compra
            </label>
            <DateInput
              id="inst-date"
              className="field"
              min={range.min}
              max={range.max}
              value={date || null}
              onCommit={(v) => setDate(v ?? "")}
            />
          </div>
          {cards.length > 0 && (
            <div>
              <label className="label" htmlFor="inst-pay">
                Pagar com
              </label>
              <select id="inst-pay" className="field" value={payWith} onChange={(e) => setPayWith(e.target.value)}>
                <option value="">Saldo</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <p className="rounded-lg bg-head px-3 py-2 text-[15px] text-muted">
          {total && validCurrent ? (
            <>
              <span className="font-semibold text-ink">
                {count}x de {fmtBRL(each)}
              </span>
              {total !== each * count && ` (a 1ª de ${fmtBRL(total - each * (count - 1))})`} · total {fmtBRL(total)}
              <br />
              Parcelas {current} a {count}, de {ymShort(ym)} a {ymShort(addMonths(ym, count - current))}. Cada uma
              entra em “{block.name}” no mês dela.
            </>
          ) : (
            "Preencha o valor e as parcelas para ver como fica."
          )}
        </p>

        {error && <p className="text-[15px] text-expense">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Lançando..." : "Lançar parcelas"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
