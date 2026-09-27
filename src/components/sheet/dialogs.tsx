"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { newColumnId } from "@/lib/client";
import { centsToInput, parseMoney } from "@/lib/money";
import type { Block, BudgetType, ColType, ExtraColumn } from "@/lib/types";
import { Modal } from "../ui/Modal";

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
          <ul className="divide-y divide-grid border border-grid">
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

        <div className="border border-dashed border-grid p-3">
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
