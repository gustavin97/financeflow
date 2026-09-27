"use client";

import { ChevronDown, ChevronRight, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { addMonths, currentYm, diffMonths, isYm, ymLabel, ymShort } from "@/lib/dates";
import { api, errMsg } from "@/lib/client";
import { GOAL_COLORS } from "@/lib/kinds";
import { centsToInput, fmtBRL, fmtNum, fmtPct, parseMoney } from "@/lib/money";
import type { GoalStat } from "@/lib/types";

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

function projection(g: GoalStat, now: string) {
  const remaining = Math.max(0, g.targetAmount - g.saved);
  if (g.targetAmount <= 0) return { remaining, forecast: "Defina um valor", needed: null as number | null };
  if (remaining === 0) return { remaining, forecast: "Meta atingida", needed: null };
  let needed: number | null = null;
  if (g.targetMonth && isYm(g.targetMonth)) {
    const left = diffMonths(now, g.targetMonth) + 1; // inclui o mês atual
    needed = left > 0 ? Math.ceil(remaining / left) : remaining;
  }
  if (g.monthlyAvg <= 0) return { remaining, forecast: "Sem aportes ainda", needed };
  const months = Math.ceil(remaining / g.monthlyAvg);
  return { remaining, forecast: cap(ymLabel(addMonths(now, months))), needed };
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<GoalStat | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const now = currentYm();

  const load = useCallback(async () => {
    try {
      setGoals(await api<GoalStat[]>("/api/goals"));
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const totals = (goals ?? []).reduce(
    (t, g) => ({
      saved: t.saved + g.saved,
      planned: t.planned + g.planned,
      target: t.target + g.targetAmount,
    }),
    { saved: 0, planned: 0, target: 0 },
  );

  async function remove(g: GoalStat) {
    if (!window.confirm(`Excluir a meta “${g.name}”? Os aportes continuam nas planilhas, mas ficam sem meta.`))
      return;
    try {
      await api(`/api/goals/${g.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pb-12 pt-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Cofrinho</h1>
          <p className="mt-0.5 max-w-xl text-[15px] text-muted">
            Metas de longo prazo. Cada linha das tabelas de cofrinho, na planilha mensal, aponta para
            uma meta e soma aqui automaticamente.
          </p>
        </div>
        <button className="btn btn-primary h-11" onClick={() => setEditing("new")}>
          <Plus size={17} /> Nova meta
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 border border-expense/30 bg-red-50 px-3 py-2 text-[15px] text-expense">
          {error}
        </p>
      )}

      {goals === null && !error && <div className="h-40 border border-grid bg-white" aria-busy="true" />}

      {goals && goals.length === 0 && (
        <div className="border border-grid bg-white px-6 py-12 text-center shadow-sheet">
          <PiggyBank className="mx-auto text-brand" size={30} />
          <h2 className="mt-3 text-[18px] font-semibold">Qual é a sua primeira meta?</h2>
          <p className="mx-auto mt-1 max-w-md text-[15px] text-muted">
            Apartamento, carro, viagem ou reserva de emergência. Defina o valor e acompanhe quanto já
            foi guardado mês a mês.
          </p>
          <button className="btn btn-primary mt-5 h-11" onClick={() => setEditing("new")}>
            <Plus size={17} /> Criar meta
          </button>
        </div>
      )}

      {goals && goals.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-px border border-grid bg-grid shadow-sheet lg:grid-cols-4">
            {[
              { l: "Guardado até agora", v: fmtBRL(totals.saved), c: "#1d5fbf" },
              { l: "Previsto nas planilhas", v: fmtBRL(totals.planned), c: "#1c2024" },
              { l: "Soma das metas", v: fmtBRL(totals.target), c: "#1c2024" },
              {
                l: "Progresso geral",
                v: totals.target > 0 ? fmtPct(Math.min(1, totals.saved / totals.target), 1) : "0%",
                c: "#107c41",
              },
            ].map((c) => (
              <div key={c.l} className="bg-white px-4 py-3">
                <p className="text-[14.5px] font-medium text-muted">{c.l}</p>
                <p className="mt-0.5 text-[21px] sm:text-[27px] font-semibold leading-tight" style={{ color: c.c }}>
                  {c.v}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto border border-grid bg-white shadow-sheet">
            <table className="sheet" style={{ minWidth: 980 }}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 76 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="gutter" />
                  <th>Meta</th>
                  <th className="!text-right">Valor da meta</th>
                  <th className="!text-right">Guardado</th>
                  <th className="!text-right">Previsto</th>
                  <th className="!text-right">Falta</th>
                  <th>Progresso</th>
                  <th className="!text-right">Ritmo por mês</th>
                  <th>Chega em</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {goals.map((g) => {
                  const p = projection(g, now);
                  const pct = g.targetAmount > 0 ? Math.min(1, g.saved / g.targetAmount) : 0;
                  const isOpen = open === g.id;
                  return (
                    <Fragment key={g.id}>
                      <tr className="hover:bg-[#f6faf7]">
                        <td className="gutter">
                          <button
                            className="flex h-10 w-full items-center justify-center text-muted hover:text-ink"
                            onClick={() => setOpen(isOpen ? null : g.id)}
                            aria-expanded={isOpen}
                            aria-label={`Ver aportes de ${g.name}`}
                          >
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td className="!px-2 font-semibold">
                          <span className="mr-2 inline-block h-2.5 w-2.5" style={{ background: g.color }} />
                          {g.name}
                        </td>
                        <td className="!px-2 text-right">{fmtNum(g.targetAmount)}</td>
                        <td className="!px-2 text-right font-semibold" style={{ color: "#1d5fbf" }}>
                          {fmtNum(g.saved)}
                        </td>
                        <td className="!px-2 text-right text-muted">{fmtNum(g.planned)}</td>
                        <td className="!px-2 text-right">{fmtNum(p.remaining)}</td>
                        <td className="!px-2">
                          <div className="flex items-center gap-2">
                            <div className="h-[8px] flex-1 bg-[#e3e7eb]" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso de ${g.name}`}>
                              <div className="h-full" style={{ width: `${pct * 100}%`, background: g.color }} />
                            </div>
                            <span className="w-11 text-right text-[14px] font-semibold">{fmtPct(pct)}</span>
                          </div>
                        </td>
                        <td className="!px-2 text-right">{g.monthlyAvg ? fmtNum(g.monthlyAvg) : <span className="text-faint">0,00</span>}</td>
                        <td className="!px-2">
                          <span className={p.forecast === "Meta atingida" ? "font-semibold text-brand" : ""}>{p.forecast}</span>
                          {g.targetMonth && isYm(g.targetMonth) && p.remaining > 0 && (
                            <span className="block text-[13px] leading-tight text-muted">
                              Prazo: {ymShort(g.targetMonth)}
                              {p.needed ? `, precisa de ${fmtBRL(p.needed)}/mês` : ""}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex justify-end">
                            <button className="btn btn-ghost h-10 w-10 px-0" onClick={() => setEditing(g)} aria-label={`Editar ${g.name}`}>
                              <Pencil size={16} />
                            </button>
                            <button className="btn btn-ghost h-10 w-10 px-0 text-expense" onClick={() => remove(g)} aria-label={`Excluir ${g.name}`}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td className="gutter" />
                          <td colSpan={8} className="!bg-[#fafbfb] !p-3">
                            {g.history.length === 0 ? (
                              <p className="text-[15px] text-muted">
                                Nenhum aporte ainda. Na planilha do mês, escolha esta meta na coluna “Meta” de uma
                                tabela de cofrinho.
                              </p>
                            ) : (
                              <table className="w-full max-w-md text-[15px]">
                                <thead>
                                  <tr className="text-left text-[14px] text-muted">
                                    <th className="py-1 font-medium">Mês</th>
                                    <th className="py-1 text-right font-medium">Aporte</th>
                                    <th className="py-1 text-right font-medium">Já guardado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...g.history].reverse().map((h) => (
                                    <tr key={h.ym} className="border-t border-grid">
                                      <td className="py-1">
                                        <Link className="text-brand hover:underline" href={`/planilha/${h.ym}`}>
                                          {cap(ymLabel(h.ym))}
                                        </Link>
                                      </td>
                                      <td className="py-1 text-right">{fmtNum(h.total)}</td>
                                      <td className="py-1 text-right">{fmtNum(h.done)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                          <td />
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[14.5px] text-muted">
            O ritmo por mês é a média dos últimos três meses com aportes. “Guardado” conta só o que foi
            marcado como guardado; “Previsto” ainda está pendente.
          </p>
        </div>
      )}

      {editing && (
        <GoalDialog
          goal={editing === "new" ? null : editing}
          colorIndex={goals?.length ?? 0}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function GoalDialog({
  goal,
  colorIndex,
  onClose,
  onSaved,
}: {
  goal: GoalStat | null;
  colorIndex: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [amount, setAmount] = useState(goal ? centsToInput(goal.targetAmount) : "");
  const [month, setMonth] = useState(goal?.targetMonth ?? "");
  const [color, setColor] = useState(goal?.color ?? GOAL_COLORS[colorIndex % GOAL_COLORS.length]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Dê um nome à meta.");
    const cents = parseMoney(amount);
    if (cents === null || cents <= 0) return setError("Informe o valor da meta.");
    if (month && !isYm(month)) return setError("Use o formato AAAA-MM para o prazo.");
    setBusy(true);
    try {
      const body = { name: name.trim(), targetAmount: cents, targetMonth: month || null, color };
      if (goal) await api(`/api/goals/${goal.id}`, { method: "PATCH", body });
      else await api("/api/goals", { body });
      onSaved();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={goal ? "Editar meta" : "Nova meta"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="goal-name">
            Nome
          </label>
          <input id="goal-name" className="field" autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Entrada do apartamento" />
          {!goal && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["Apartamento", "Carro", "Casa", "Viagem", "Reserva de emergência"].map((s) => (
                <button type="button" key={s} className="btn btn-sm" onClick={() => setName(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="goal-amount">
              Valor da meta (R$)
            </label>
            <input id="goal-amount" className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="80.000,00" />
          </div>
          <div>
            <label className="label" htmlFor="goal-month">
              Prazo (opcional)
            </label>
            <input id="goal-month" type="month" className="field" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="AAAA-MM" />
          </div>
        </div>
        <div>
          <span className="label">Cor</span>
          <div className="flex gap-2">
            {GOAL_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={color === c}
                className={`h-6 w-6 border-2 ${color === c ? "border-ink" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-[15px] text-expense">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {goal ? "Salvar meta" : "Criar meta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
