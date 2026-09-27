"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MONTHS_LONG, MONTHS_SHORT } from "@/lib/dates";
import { api, errMsg } from "@/lib/client";
import { EXPENSE_PALETTE, KIND_META } from "@/lib/kinds";
import { fmtBRL, fmtNum, fmtPct } from "@/lib/money";
import type { AnnualPayload } from "@/lib/types";

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function niceMax(v: number) {
  if (v <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

export default function AnnualPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<AnnualPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    api<AnnualPayload>(`/api/annual?year=${year}`)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(errMsg(e)));
    return () => {
      alive = false;
    };
  }, [year]);

  const rows = useMemo(() => {
    if (!data) return [];
    let acc = data.carryIn;
    return data.months.map((m) => {
      const balance = m.income - m.expense - m.savings;
      acc += balance;
      return { ...m, balance, acc, empty: m.income + m.expense + m.savings === 0 };
    });
  }, [data]);

  const tot = rows.reduce(
    (t, r) => ({ income: t.income + r.income, expense: t.expense + r.expense, savings: t.savings + r.savings }),
    { income: 0, expense: 0, savings: 0 },
  );
  const totBalance = tot.income - tot.expense - tot.savings;

  const spendCats = (data?.categories ?? []).filter((c) => c.kind !== "income" && c.total > 0);
  const spendTotal = spendCats.reduce((s, c) => s + c.total, 0);

  return (
    <div className="mx-auto max-w-[1200px] px-3 pb-10 pt-4 sm:px-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Visão anual</h1>
          <p className="mt-0.5 text-[13px] text-muted">Os 12 meses lado a lado, com o saldo acumulado ao longo do ano.</p>
        </div>
        <div className="flex items-center border border-grid bg-white">
          <button className="flex h-9 w-9 items-center justify-center text-muted hover:bg-head hover:text-ink" onClick={() => setYear(year - 1)} aria-label="Ano anterior">
            <ChevronLeft size={17} />
          </button>
          <span className="min-w-[70px] border-x border-grid text-center text-[15px] font-semibold leading-9">{year}</span>
          <button className="flex h-9 w-9 items-center justify-center text-muted hover:bg-head hover:text-ink" onClick={() => setYear(year + 1)} aria-label="Próximo ano">
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 border border-expense/30 bg-red-50 px-3 py-2 text-[13px] text-expense">
          {error}
        </p>
      )}
      {!data && !error && <div className="h-72 border border-grid bg-white" aria-busy="true" />}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-px border border-grid bg-grid shadow-sheet lg:grid-cols-4">
            {[
              { l: "Receitas no ano", v: tot.income, c: "#107c41" },
              { l: "Despesas no ano", v: tot.expense, c: "#c4361f" },
              { l: "Guardado no cofrinho", v: tot.savings, c: "#1d5fbf" },
              { l: "Sobra no ano", v: totBalance, c: totBalance < 0 ? "#c4361f" : "#107c41" },
            ].map((c) => (
              <div key={c.l} className="bg-white px-4 py-3">
                <p className="text-[12.5px] font-medium text-muted">{c.l}</p>
                <p className="mt-0.5 text-[23px] font-semibold leading-tight" style={{ color: c.c }}>
                  {fmtBRL(c.v)}
                </p>
              </div>
            ))}
          </div>

          <div className="border border-grid bg-white p-4 shadow-sheet">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[13px] font-semibold">Mês a mês</h2>
              <ul className="flex gap-4 text-[12px] text-muted">
                {[
                  ["Receitas", "#107c41"],
                  ["Despesas", "#c4361f"],
                  ["Cofrinho", "#1d5fbf"],
                ].map(([l, c]) => (
                  <li key={l} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5" style={{ background: c }} />
                    {l}
                  </li>
                ))}
              </ul>
            </div>
            <BarChart rows={rows} />
          </div>

          <div className="overflow-x-auto border border-grid bg-white shadow-sheet">
            <table className="sheet" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th className="gutter" style={{ width: 36 }} />
                  <th>Mês</th>
                  <th className="!text-right">Receitas</th>
                  <th className="!text-right">Despesas</th>
                  <th className="!text-right">Cofrinho</th>
                  <th className="!text-right">Saldo do mês</th>
                  <th className="!text-right">Saldo acumulado</th>
                  <th className="!text-right">Poupança</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.ym} className={r.empty ? "text-faint" : "hover:bg-[#f6faf7]"}>
                    <td className="gutter">{i + 1}</td>
                    <td className="!px-2">
                      <Link href={`/planilha/${r.ym}`} className="font-medium text-brand hover:underline">
                        {MONTHS_LONG[i].replace(/^./, (c) => c.toUpperCase())}
                      </Link>
                    </td>
                    <td className="!px-2 text-right">{r.empty ? "" : fmtNum(r.income)}</td>
                    <td className="!px-2 text-right">{r.empty ? "" : fmtNum(r.expense)}</td>
                    <td className="!px-2 text-right">{r.empty ? "" : fmtNum(r.savings)}</td>
                    <td className="!px-2 text-right font-semibold" style={{ color: r.empty ? undefined : r.balance < 0 ? "#c4361f" : "#107c41" }}>
                      {r.empty ? "" : fmtNum(r.balance)}
                    </td>
                    <td className="!px-2 text-right">{r.empty && r.acc === 0 ? "" : fmtNum(r.acc)}</td>
                    <td className="!px-2 text-right">{!r.empty && r.income > 0 ? fmtPct(r.savings / r.income, 1) : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="gutter" />
                  <td>Total do ano</td>
                  <td className="text-right">{fmtNum(tot.income)}</td>
                  <td className="text-right">{fmtNum(tot.expense)}</td>
                  <td className="text-right">{fmtNum(tot.savings)}</td>
                  <td className="text-right" style={{ color: totBalance < 0 ? "#c4361f" : "#107c41" }}>
                    {fmtNum(totBalance)}
                  </td>
                  <td className="text-right">{fmtNum(rows[rows.length - 1]?.acc ?? 0)}</td>
                  <td className="text-right">{tot.income > 0 ? fmtPct(tot.savings / tot.income, 1) : ""}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {spendCats.length > 0 && (
            <div className="border border-grid bg-white p-4 shadow-sheet">
              <h2 className="mb-3 text-[13px] font-semibold">Onde o dinheiro foi em {year}</h2>
              <ul className="space-y-2.5">
                {spendCats.map((c, i) => (
                  <li key={c.name + c.kind} className="grid grid-cols-[150px_1fr_130px] items-center gap-3 text-[13px] sm:grid-cols-[200px_1fr_150px]">
                    <span className="truncate">
                      {c.name}
                      {c.kind === "savings" && c.name.trim().toLowerCase() !== KIND_META.savings.label.toLowerCase() && <span className="ml-1.5 text-[11px] text-muted">({KIND_META.savings.label})</span>}
                    </span>
                    <div className="h-[10px] bg-[#e3e7eb]">
                      <div
                        className="h-full"
                        style={{
                          width: `${(c.total / spendCats[0].total) * 100}%`,
                          background: c.kind === "savings" ? KIND_META.savings.color : EXPENSE_PALETTE[i % EXPENSE_PALETTE.length],
                        }}
                      />
                    </div>
                    <span className="text-right">
                      <span className="font-semibold">{fmtBRL(c.total)}</span>
                      <span className="ml-2 text-[12px] text-muted">{fmtPct(c.total / spendTotal)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BarChart({ rows }: { rows: { ym: string; income: number; expense: number; savings: number }[] }) {
  const W = 760;
  const H = 240;
  const padL = 52;
  const padR = 8;
  const padT = 10;
  const padB = 26;
  const max = niceMax(Math.max(...rows.flatMap((r) => [r.income, r.expense, r.savings]), 1));
  const plotH = H - padT - padB;
  const groupW = (W - padL - padR) / 12;
  const barW = Math.min(16, groupW * 0.24);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[560px]" role="img" aria-label="Receitas, despesas e cofrinho por mês">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e3e7eb" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5f6b76">
              {compact.format(t / 100)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = padL + groupW * i + groupW / 2;
          const bars = [
            { v: r.income, c: "#107c41", l: "Receitas" },
            { v: r.expense, c: "#c4361f", l: "Despesas" },
            { v: r.savings, c: "#1d5fbf", l: "Cofrinho" },
          ];
          return (
            <g key={r.ym}>
              {bars.map((b, j) => (
                <rect key={b.l} x={cx - barW * 1.5 - 1 + j * (barW + 1)} y={y(b.v)} width={barW} height={Math.max(0, padT + plotH - y(b.v))} fill={b.c}>
                  <title>{`${MONTHS_SHORT[i]}: ${b.l} ${fmtBRL(b.v)}`}</title>
                </rect>
              ))}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="11.5" fill="#5f6b76">
                {MONTHS_SHORT[i]}
              </text>
            </g>
          );
        })}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="#9aa3ab" />
      </svg>
    </div>
  );
}
