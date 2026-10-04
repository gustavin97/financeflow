"use client";

import { PiggyBank } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MONTHS_LONG } from "@/lib/dates";
import { fmtBRL } from "@/lib/money";
import type { GoalLite, SurplusInfo } from "@/lib/types";

type Action = { action: "save"; goalId: string | null; pct: number } | { action: "skip" | "undo" | "dismiss" };

/** No mês atual: o mês anterior fechou no azul. Guardar a sobra no cofrinho? */
export function SurplusBanner({
  info,
  goals,
  onAction,
}: {
  info: SurplusInfo;
  goals: GoalLite[];
  onAction: (a: Action) => Promise<void>;
}) {
  const [goalId, setGoalId] = useState(info.goalId ?? "");
  const [pctText, setPctText] = useState(String(info.pct));
  const [busy, setBusy] = useState(false);
  const month = MONTHS_LONG[Number(info.ym.slice(5)) - 1];
  const Month = month.replace(/^./, (c) => c.toUpperCase());

  const pct = Number(pctText);
  const pctOk = Number.isInteger(pct) && pct >= 1 && pct <= 100;
  const value = pctOk ? Math.round((info.amount * pct) / 100) : 0;

  const run = async (a: Action) => {
    setBusy(true);
    await onAction(a);
    setBusy(false);
  };

  const box = "flex flex-wrap items-center gap-x-3 gap-y-2 border border-savings/30 bg-[#eaf1fb] px-4 py-2.5 text-[15px]";

  if (info.state === "saved") {
    const goal = goals.find((g) => g.id === info.goalId);
    return (
      <div role="status" className={box}>
        <PiggyBank size={19} className="shrink-0 text-savings" />
        <span className="flex-1">
          <strong className="font-semibold">{fmtBRL(info.amount)} da sobra de {month}</strong> foi para o cofrinho
          {goal ? <> (meta {goal.name})</> : null}. A linha está no cofrinho de {month}.
        </span>
        <button className="btn btn-sm" disabled={busy} onClick={() => run({ action: "undo" })}>
          Desfazer
        </button>
        <button className="btn btn-sm" disabled={busy} onClick={() => run({ action: "dismiss" })}>
          Entendi
        </button>
      </div>
    );
  }

  return (
    <div role="region" aria-label={`Sobra de ${month}`} className={box}>
      <PiggyBank size={19} className="shrink-0 text-savings" />
      <span className="min-w-[220px] flex-1">
        <strong className="font-semibold">
          {Month} fechou com {fmtBRL(info.amount)} sobrando.
        </strong>{" "}
        Guardar no cofrinho?{" "}
        <Link href="/conta#sobra" className="text-savings underline-offset-2 hover:underline">
          Guardar sempre sozinho
        </Link>
      </span>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (pctOk) run({ action: "save", goalId: goalId || null, pct });
        }}
      >
        <select
          aria-label="Meta"
          className="h-8 rounded-md border border-line bg-white px-2 text-[14.5px]"
          value={goalId}
          onChange={(e) => setGoalId(e.target.value)}
        >
          <option value="">Sem meta</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[14.5px]">
          <input
            aria-label="Porcentagem da sobra"
            className="h-8 w-14 rounded-md border border-line bg-white px-2 text-right tabular-nums"
            inputMode="numeric"
            value={pctText}
            onChange={(e) => setPctText(e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
          %
        </label>
        <button className="btn btn-sm btn-primary" disabled={busy || !pctOk}>
          Guardar {pctOk ? fmtBRL(value) : ""}
        </button>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run({ action: "skip" })}>
          Agora não
        </button>
      </form>
    </div>
  );
}
