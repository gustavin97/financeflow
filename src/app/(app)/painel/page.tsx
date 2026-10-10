"use client";

import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ScopedAlerts } from "@/components/AlertsPanel";
import { monthAlerts } from "@/lib/alerts";
import { buildCalc } from "@/lib/calc";
import { api, errMsg } from "@/lib/client";
import { addMonths, currentYm, ymLabel, ymShort } from "@/lib/dates";
import {
  compareGroups,
  groupOptions,
  monthSeries,
  project,
  spendByGroup,
  type CompareRow,
  type MonthPoint,
} from "@/lib/insights";
import { SHARED_COLOR } from "@/lib/kinds";
import { fmtBRL, fmtPct } from "@/lib/money";
import type { DashboardPayload } from "@/lib/types";

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

// cores: as mesmas da planilha para receita/despesa/economia; azul para "este mês"
const C = {
  income: "#107c41",
  expense: "#c4361f",
  savings: "#1d5fbf",
  current: "#2a78d6",
  previous: "#b7c3cf",
  grid: "#e3e7eb",
  axis: "#9aa3ab",
  text: "#5f6b76",
};

export default function DashboardPage() {
  const [ym, setYm] = useState(currentYm());
  const [who, setWho] = useState("all");
  const [groupBy, setGroupBy] = useState("block");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    api<DashboardPayload>(`/api/dashboard?ym=${ym}`)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(errMsg(e)));
    return () => {
      alive = false;
    };
  }, [ym]);

  const members = data?.members ?? [];
  const scope = who === "shared" || members.some((m) => m.id === who) ? who : "all";
  const cur = data?.months.find((m) => m.ym === ym) ?? null;
  const prevYm = addMonths(ym, -1);
  const prev = data?.months.find((m) => m.ym === prevYm) ?? null;

  const series = useMemo(
    () => (data ? monthSeries(data.months, data.members, data.carry, scope) : []),
    [data, scope],
  );
  const point = series.find((p) => p.ym === ym) ?? null;
  const prevPoint = series.find((p) => p.ym === prevYm) ?? null;
  const projection = useMemo(() => project(series), [series]);
  const nextPoint = useMemo(
    () => (data?.next ? monthSeries([data.next], data.members, data.carry, scope)[0] : null),
    [data, scope],
  );

  const options = useMemo(
    () => groupOptions([cur?.blocks ?? [], prev?.blocks ?? []], members),
    [cur, prev, members],
  );
  const group = options.some((o) => o.value === groupBy) ? groupBy : "block";
  const rows = useMemo(() => {
    if (!cur) return [];
    return compareGroups(
      spendByGroup(cur.blocks, members, group, scope),
      prev ? spendByGroup(prev.blocks, members, group, scope) : null,
    );
  }, [cur, prev, members, group, scope]);

  const alerts = useMemo(() => {
    if (!data || !cur) return [];
    const calc = buildCalc(cur.blocks, data.members, data.carry);
    const prevAll = prev ? buildCalc(prev.blocks, data.members, data.carry).scopes.get("all")!.expense : null;
    return monthAlerts({ ym, blocks: cur.blocks, members: data.members, carry: data.carry, calc, prevExpense: prevAll });
  }, [data, cur, prev, ym]);

  const groupLabel = options.find((o) => o.value === group)?.label ?? "Tabela";

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pb-14 pt-5">
      {/* ---------- filtros: uma linha acima dos gráficos ---------- */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-2 text-[26px] font-semibold tracking-tight">Painel</h1>
        <div className="flex items-center overflow-hidden rounded-xl border border-line bg-white shadow-sheet">
          <button
            className="flex h-11 w-11 items-center justify-center text-muted hover:bg-head hover:text-ink"
            onClick={() => setYm(addMonths(ym, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={19} />
          </button>
          <span className="min-w-[190px] border-x border-grid px-3 text-center text-[17px] font-semibold leading-[44px]">
            {cap(ymLabel(ym))}
          </span>
          <button
            className="flex h-11 w-11 items-center justify-center text-muted hover:bg-head hover:text-ink"
            onClick={() => setYm(addMonths(ym, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight size={19} />
          </button>
        </div>
        {members.length > 0 && (
          <div className="seg" role="tablist" aria-label="Ver dados de">
            {[
              { id: "all", name: "Casal", color: null as string | null },
              ...members.map((m) => ({ id: m.id, name: m.name, color: m.color })),
              { id: "shared", name: "Conjunto", color: SHARED_COLOR },
            ].map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={scope === t.id}
                onClick={() => setWho(t.id)}
                className="seg-item"
              >
                {t.color && <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />}
                {t.name}
              </button>
            ))}
          </div>
        )}
        <label className="ml-auto flex items-center gap-2 text-[15px] text-muted">
          Agrupar gastos por
          <select className="field h-11 w-auto min-w-[160px]" value={group} onChange={(e) => setGroupBy(e.target.value)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="mb-4 border border-expense/30 bg-red-50 px-3 py-2 text-[15px] text-expense">
          {error}
        </p>
      )}
      {!data && !error && <div className="skeleton h-80 rounded-xl border border-line bg-white" aria-busy="true" />}

      {data && !cur && (
        <div className="panel px-5 py-8 text-center">
          <p className="text-[16px] font-semibold">{cap(ymLabel(ym))} ainda não foi iniciado.</p>
          <p className="mt-1 text-[15px] text-muted">Abra a planilha do mês para lançar receitas e despesas.</p>
          <Link href={`/planilha/${ym}`} className="btn btn-primary mt-4">
            Abrir planilha
          </Link>
        </div>
      )}

      {data && cur && point && (
        <div className="space-y-4">
          <Kpis point={point} prev={prevPoint} prevYm={prevYm} />
          <ScopedAlerts alerts={alerts} members={data.members} filter={scope} max={4} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card
              title="Onde estamos gastando mais"
              subtitle={`Despesas de ${ymLabel(ym)} por ${groupLabel.toLowerCase()}`}
            >
              <Ranking rows={rows} />
            </Card>
            <Card
              title={`Comparação com ${ymLabel(prevYm)}`}
              subtitle={prev ? `Mesmo agrupamento: ${groupLabel.toLowerCase()}` : "Sem dados do mês anterior para comparar"}
              legend={
                prev
                  ? [
                      { label: cap(ymShort(ym)), color: C.current },
                      { label: cap(ymShort(prevYm)), color: C.previous },
                    ]
                  : undefined
              }
            >
              {prev ? <Compare rows={rows} /> : <Empty text="Lance o mês anterior para ver a comparação." />}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Card
              title="Evolução mês a mês"
              subtitle={projection ? "Últimos meses e a projeção do próximo (tracejado)" : "Últimos meses"}
              legend={[
                { label: "Receitas", color: C.income },
                { label: "Despesas", color: C.expense },
                { label: "Economias", color: C.savings },
              ]}
            >
              <Evolution series={series} projection={projection} nextYm={addMonths(ym, 1)} />
            </Card>
            <Card title={`Projeção para ${ymLabel(addMonths(ym, 1))}`} subtitle="Quanto dá para economizar no próximo mês">
              <ProjectionPanel projection={projection} point={point} next={nextPoint} nextYm={addMonths(ym, 1)} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Card({
  title,
  subtitle,
  legend,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: { label: string; color: string }[];
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 panel-open p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold">{title}</h2>
          {subtitle && <p className="text-[14.5px] text-muted">{subtitle}</p>}
        </div>
        {legend && (
          <ul className="flex flex-wrap gap-3 text-[14px] text-muted">
            {legend.map((l) => (
              <li key={l.label} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5" style={{ background: l.color }} />
                {l.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ text }: { text: string }) => <p className="py-6 text-center text-[15px] text-muted">{text}</p>;

/** Variação em relação ao mês anterior. `goodWhenUp` define a cor. */
function Delta({ now, before, goodWhenUp }: { now: number; before: number | null; goodWhenUp: boolean }) {
  if (before === null || (before === 0 && now === 0)) return <span className="text-faint">sem comparação</span>;
  if (before === 0) return <span className="text-muted">novo</span>;
  const d = (now - before) / Math.abs(before);
  if (Math.abs(d) < 0.005)
    return (
      <span className="inline-flex items-center gap-0.5 text-muted">
        <Minus size={14} /> igual
      </span>
    );
  const up = now > before;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: good ? "#107c41" : "#c4361f" }}>
      <Icon size={15} aria-hidden />
      {up ? "+" : "−"}
      {fmtPct(Math.abs(d), Math.abs(d) < 0.1 ? 1 : 0)}
    </span>
  );
}

function Kpis({ point, prev, prevYm }: { point: MonthPoint; prev: MonthPoint | null; prevYm: string }) {
  const tiles = [
    { label: "Receitas", v: point.income, p: prev?.income ?? null, color: C.income, goodUp: true },
    { label: "Despesas", v: point.expense, p: prev?.expense ?? null, color: C.expense, goodUp: false },
    { label: "Economias", v: point.savings, p: prev?.savings ?? null, color: C.savings, goodUp: true },
    {
      label: "Sobra do mês",
      v: point.balance,
      p: prev?.balance ?? null,
      color: point.balance < 0 ? C.expense : C.income,
      goodUp: true,
    },
  ];
  return (
    <div className="grid grid-cols-2 kpis gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="bg-white px-4 py-3">
          <p className="text-[14.5px] font-medium text-muted">{t.label}</p>
          <p className="mt-0.5 text-[19px] sm:text-[27px] font-semibold leading-tight tracking-tight" style={{ color: t.color }}>
            {fmtBRL(t.v)}
          </p>
          <p className="mt-1 text-[14px] text-muted">
            <Delta now={t.v} before={t.p} goodWhenUp={t.goodUp} /> <span className="text-faint">vs {ymShort(prevYm)}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------- ranking ---------------------------- */
function Ranking({ rows }: { rows: CompareRow[] }) {
  const list = rows.filter((r) => r.current > 0);
  if (!list.length) return <Empty text="Nenhuma despesa lançada neste mês." />;
  const total = list.reduce((s, r) => s + r.current, 0);
  const max = Math.max(...list.map((r) => r.current));
  return (
    <ul className="space-y-2.5">
      {list.map((r) => (
        <li
          key={r.key}
          className="text-[15px]"
          title={`${r.label}: ${fmtBRL(r.current)} (${fmtPct(r.current / total, 1)} das despesas)`}
        >
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate">{r.label}</span>
            <span className="whitespace-nowrap tabular-nums">
              <span className="font-semibold">{fmtBRL(r.current)}</span>
              <span className="ml-2 inline-block w-[36px] text-right text-[14px] text-muted">{fmtPct(r.current / total)}</span>
            </span>
          </div>
          <div className="h-[10px]">
            <div
              className="h-full rounded-r-[3px]"
              style={{ width: `${Math.max(1, (r.current / max) * 100)}%`, background: C.current }}
            />
          </div>
        </li>
      ))}
      <li className="flex justify-between border-t border-grid pt-2 text-[15px] font-semibold">
        <span>Total</span>
        <span className="tabular-nums">
          {fmtBRL(total)}
          <span className="ml-2 inline-block w-[36px]" />
        </span>
      </li>
    </ul>
  );
}

/* ---------------------------- comparação ---------------------------- */
function Compare({ rows }: { rows: CompareRow[] }) {
  if (!rows.length) return <Empty text="Nenhuma despesa nos dois meses." />;
  const max = Math.max(...rows.flatMap((r) => [r.current, r.previous]), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.key}
          className="text-[15px]"
          title={`${r.label}: ${fmtBRL(r.current)} agora, ${fmtBRL(r.previous)} antes`}
        >
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate">{r.label}</span>
            <span className="whitespace-nowrap text-[14px] tabular-nums">
              <span className="font-semibold text-ink">{fmtBRL(r.current)}</span>
              <span className="ml-1.5 text-muted">antes {fmtBRL(r.previous)}</span>
              <span className="ml-2">
                <Delta now={r.current} before={r.previous} goodWhenUp={false} />
              </span>
            </span>
          </div>
          <div className="space-y-[2px]">
            <div className="h-[10px]">
              <div className="h-full rounded-r-[3px]" style={{ width: `${(r.current / max) * 100}%`, background: C.current }} />
            </div>
            <div className="h-[10px]">
              <div className="h-full rounded-r-[3px]" style={{ width: `${(r.previous / max) * 100}%`, background: C.previous }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------- evolução ---------------------------- */
function niceMax(v: number) {
  if (v <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

function Evolution({
  series,
  projection,
  nextYm,
}: {
  series: MonthPoint[];
  projection: ReturnType<typeof project>;
  nextYm: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const groups = [
    ...series.map((p) => ({ ym: p.ym, income: p.income, expense: p.expense, savings: p.savings, projected: false })),
    ...(projection
      ? [{ ym: nextYm, income: projection.income, expense: projection.expense, savings: projection.savings, projected: true }]
      : []),
  ];
  if (!groups.length) return <Empty text="Sem meses lançados ainda." />;

  const W = 900;
  const H = 280;
  const padL = 66;
  const padR = 8;
  const padT = 10;
  const padB = 26;
  const max = niceMax(Math.max(...groups.flatMap((g) => [g.income, g.expense, g.savings]), 1));
  const plotH = H - padT - padB;
  const groupW = (W - padL - padR) / Math.max(groups.length, 4);
  const barW = Math.min(20, (groupW * 0.7) / 3);
  const y = (v: number) => padT + plotH - (Math.max(0, v) / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const h = hover !== null ? groups[hover] : null;

  return (
    <div className="relative overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[760px]" role="img" aria-label="Receitas, despesas e economias por mês">
        <defs>
          <pattern id="proj" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
            <rect width="5" height="5" fill="white" />
            <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="3" />
          </pattern>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={C.grid} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="13" fill={C.text}>
              {compact.format(t / 100)}
            </text>
          </g>
        ))}
        {groups.map((g, i) => {
          const cx = padL + groupW * i + groupW / 2;
          const bars = [
            { v: g.income, c: C.income },
            { v: g.expense, c: C.expense },
            { v: g.savings, c: C.savings },
          ];
          return (
            <g key={g.ym}>
              {hover === i && <rect x={cx - groupW / 2} y={padT} width={groupW} height={plotH} fill="#f1f3f5" />}
              {bars.map((b, j) => {
                const x = cx - (barW * 3 + 4) / 2 + j * (barW + 2);
                const top = y(b.v);
                const hgt = Math.max(0, padT + plotH - top);
                return (
                  <g key={j} style={{ color: b.c }}>
                    <path
                      d={roundedTop(x, top, barW, hgt, 3)}
                      fill={g.projected ? "url(#proj)" : b.c}
                      stroke={g.projected ? b.c : "none"}
                      strokeDasharray={g.projected ? "3 2" : undefined}
                    />
                  </g>
                );
              })}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="13.5" fill={g.projected ? C.text : C.text} fontStyle={g.projected ? "italic" : undefined}>
                {ymShort(g.ym)}
                {g.projected ? "*" : ""}
              </text>
              <rect
                x={cx - groupW / 2}
                y={padT}
                width={groupW}
                height={plotH + padB}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke={C.axis} />
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[170px] rounded-lg border border-line bg-white px-3 py-2 text-[14px] shadow-pop"
          style={{
            left: `${((padL + groupW * hover + groupW / 2) / W) * 100}%`,
            transform: hover > groups.length / 2 ? "translateX(-105%)" : "translateX(5%)",
          }}
        >
          <p className="mb-1 font-semibold text-ink">
            {cap(ymLabel(h.ym))}
            {h.projected && <span className="ml-1 font-normal text-muted">(projeção)</span>}
          </p>
          {[
            ["Receitas", h.income, C.income],
            ["Despesas", h.expense, C.expense],
            ["Economias", h.savings, C.savings],
          ].map(([l, v, c]) => (
            <p key={l as string} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-2 w-2" style={{ background: c as string }} />
                {l}
              </span>
              <span className="font-medium tabular-nums text-ink">{fmtBRL(v as number)}</span>
            </p>
          ))}
          <p className="mt-1 flex justify-between gap-3 border-t border-grid pt-1">
            <span className="text-muted">Sobra</span>
            <span className="font-semibold tabular-nums text-ink">{fmtBRL(h.income - h.expense - h.savings)}</span>
          </p>
        </div>
      )}
    </div>
  );
}

/** Barra com o topo arredondado e a base reta. */
function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/* ---------------------------- projeção ---------------------------- */
function ProjectionPanel({
  projection: p,
  point,
  next,
  nextYm,
}: {
  projection: ReturnType<typeof project>;
  point: MonthPoint;
  next: MonthPoint | null;
  nextYm: string;
}) {
  if (!p) return <Empty text="Lance pelo menos um mês para projetar o próximo." />;
  const suggested = Math.max(0, Math.round((p.canSave * 0.8) / 100) * 100);
  const lines: [string, number][] = [
    ["Receita prevista", p.income],
    ["Despesa prevista", -p.expense],
  ];
  return (
    <div className="space-y-3 text-[15px]">
      <div className="border border-grid">
        {lines.map(([l, v]) => (
          <div key={l} className="flex justify-between border-b border-grid px-3 py-1.5">
            <span className="text-muted">{l}</span>
            <span className="tabular-nums">{fmtBRL(v)}</span>
          </div>
        ))}
        <div className="flex justify-between bg-head px-3 py-2 font-semibold">
          <span>Dá para economizar</span>
          <span className="tabular-nums" style={{ color: p.canSave < 0 ? "#c4361f" : "#107c41" }}>
            {fmtBRL(p.canSave)}
          </span>
        </div>
      </div>

      {p.canSave > 0 ? (
        <p>
          Guardando <span className="font-semibold">{fmtBRL(suggested)}</span> (80% da sobra prevista) ainda fica uma
          folga de {fmtBRL(p.canSave - suggested)} para imprevistos.
          {point.savings > 0 && (
            <>
              {" "}
              Em {ymLabel(point.ym)} vocês guardaram {fmtBRL(point.savings)}
              {suggested > point.savings ? `: dá para guardar ${fmtBRL(suggested - point.savings)} a mais.` : "."}
            </>
          )}
        </p>
      ) : (
        <p className="font-medium text-expense">
          No ritmo atual, as despesas passam da renda. Reduzir {fmtBRL(-p.canSave)} nas despesas equilibra o próximo mês.
        </p>
      )}

      {p.expenseTrend !== null && Math.abs(p.expenseTrend) >= 0.02 && (
        <p className="text-muted">
          As despesas estão {p.expenseTrend > 0 ? "subindo" : "caindo"} em média{" "}
          <span className="font-semibold" style={{ color: p.expenseTrend > 0 ? "#c4361f" : "#107c41" }}>
            {fmtPct(Math.abs(p.expenseTrend), 1)} por mês
          </span>
          .
        </p>
      )}

      {next && next.income + next.expense > 0 && (
        <p className="border-l-2 border-grid pl-2 text-muted">
          Já lançado em {ymLabel(nextYm)}: receitas {fmtBRL(next.income)}, despesas {fmtBRL(next.expense)}, sobra{" "}
          <span className="font-semibold text-ink">{fmtBRL(next.income - next.expense)}</span>.
        </p>
      )}

      <p className="text-[14px] text-faint">
        * Média ponderada de {p.basedOn.map(ymShort).join(", ")} (o mês mais recente pesa mais).
      </p>
    </div>
  );
}
