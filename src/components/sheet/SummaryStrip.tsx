import { worstLevel, type FinAlert } from "@/lib/alerts";
import type { MonthCalc, ScopeTotals } from "@/lib/calc";
import { SHARED_COLOR } from "@/lib/kinds";
import { fmtBRL, fmtNum, fmtPct } from "@/lib/money";
import type { MonthSummary } from "@/lib/summary";
import type { Carry, Member } from "@/lib/types";
import { HealthBadge } from "../AlertsPanel";

function tone(v: number) {
  if (v > 0) return "#107c41";
  if (v < 0) return "#c4361f";
  return "#1c2024";
}

function Cell({
  label,
  value,
  color,
  lines,
}: {
  label: string;
  value: number;
  color: string;
  lines: string[];
}) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[14.5px] font-medium text-muted">{label}</p>
      <p className="mt-0.5 text-[19px] sm:text-[27px] font-semibold leading-tight tracking-tight" style={{ color }}>
        {fmtBRL(value)}
      </p>
      <div className="mt-1 space-y-0.5">
        {lines.map((l) => (
          <p key={l} className="text-[14px] text-muted">
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}

export function SummaryStrip({ s, carry }: { s: MonthSummary; carry: Carry }) {
  return (
    <div
      className="grid grid-cols-2 kpis gap-3 lg:grid-cols-5"
      role="group"
      aria-label="Resumo do mês"
    >
      <Cell
        label="Receitas"
        value={s.incomeDone}
        color="#107c41"
        lines={[`Previsto: ${fmtBRL(s.income)}`, `A receber: ${fmtBRL(s.income - s.incomeDone)}`]}
      />
      <Cell
        label="Despesas"
        value={s.expenseDone}
        color="#c4361f"
        lines={[`Previsto: ${fmtBRL(s.expense)}`, `A pagar: ${fmtBRL(s.expense - s.expenseDone)}`]}
      />
      <Cell
        label="Economias"
        value={s.savings}
        color="#1d5fbf"
        lines={[
          `Guardado: ${fmtBRL(s.savingsDone)}`,
          s.income > 0 ? `${fmtPct(s.savingsRate, 1)} da renda` : "Sem receitas para comparar",
        ]}
      />
      <Cell
        label="Saldo do mês"
        value={s.balance}
        color={tone(s.balance)}
        lines={["Receitas − despesas − economias", `Realizado: ${fmtBRL(s.balanceRealized)}`]}
      />
      <Cell
        label="Saldo acumulado"
        value={s.accumulated}
        color={tone(s.accumulated)}
        lines={[`Meses anteriores: ${fmtBRL(carry.planned)}`, `Realizado: ${fmtBRL(s.accumulatedRealized)}`]}
      />
    </div>
  );
}

/**
 * Resumo por pessoa. As contas do conjunto são divididas na proporção da renda
 * de cada um, para mostrar quanto realmente sobra para cada pessoa.
 */
export function PeopleTable({ members, calc, alerts }: { members: Member[]; calc: MonthCalc; alerts: FinAlert[] }) {
  // saúde de cada um: o pior sinalizador dele
  const status = (scope: string) => {
    const mine = alerts.filter((a) => a.scope === scope);
    return { level: worstLevel(mine), top: mine[0]?.title ?? "" };
  };
  if (!members.length) return null;
  // receitas só contam depois de recebidas, e despesas depois de pagas
  const received = (s: ScopeTotals) => ({
    ...s,
    income: s.incomeDone,
    expense: s.expenseDone,
    balance: s.incomeDone - s.expenseDone - s.savings,
  });
  const shared = received(calc.scopes.get("shared")!);
  const all = received(calc.scopes.get("all")!);
  const peopleIncome = members.reduce((s, m) => s + (calc.scopes.get(m.id)?.incomeDone ?? 0), 0);
  const sharedOut = shared.expense + shared.savings - shared.income;

  const rows = members.map((m) => {
    const s = received(calc.scopes.get(m.id)!);
    const ratio = peopleIncome > 0 ? s.income / peopleIncome : 1 / members.length;
    const part = Math.round(sharedOut * ratio);
    return { id: m.id, name: m.name, color: m.color, s, ratio, part, final: s.balance - part };
  });

  return (
    <div className="overflow-x-auto panel">
      <table className="sheet" style={{ minWidth: 1090 }}>
        <thead>
          <tr>
            <th style={{ width: 220 }}>Por pessoa</th>
            <th className="!text-right">Receitas</th>
            <th className="!text-right">Despesas próprias</th>
            <th className="!text-right">Economias</th>
            <th className="!text-right">Saldo próprio</th>
            <th className="!text-right" title="Despesas e economias do conjunto divididas pela proporção da renda">
              Parte no conjunto
            </th>
            <th className="!text-right">Sobra final</th>
            <th style={{ width: 130 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="!px-2">
                <span className="flex items-center gap-2 font-medium">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                  {r.name}
                  <span className="text-[13.5px] font-normal text-muted">{fmtPct(r.ratio)} da renda</span>
                </span>
              </td>
              <td className="!px-2 text-right">{fmtNum(r.s.income)}</td>
              <td className="!px-2 text-right">{fmtNum(r.s.expense)}</td>
              <td className="!px-2 text-right">{fmtNum(r.s.savings)}</td>
              <td className="!px-2 text-right" style={{ color: tone(r.s.balance) }}>
                {fmtNum(r.s.balance)}
              </td>
              <td className="!px-2 text-right text-muted">{r.part ? fmtNum(-r.part) : ""}</td>
              <td className="!px-2 text-right font-semibold" style={{ color: tone(r.final) }}>
                {fmtNum(r.final)}
              </td>
              <td className="!px-2" title={status(r.id).top}>
                <HealthBadge level={status(r.id).level} />
              </td>
            </tr>
          ))}
          {shared.income + shared.expense + shared.savings > 0 && (
            <tr>
              <td className="!px-2">
                <span className="flex items-center gap-2 font-medium">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SHARED_COLOR }} />
                  Conjunto
                </span>
              </td>
              <td className="!px-2 text-right">{fmtNum(shared.income)}</td>
              <td className="!px-2 text-right">{fmtNum(shared.expense)}</td>
              <td className="!px-2 text-right">{fmtNum(shared.savings)}</td>
              <td className="!px-2 text-right" style={{ color: tone(shared.balance) }}>
                {fmtNum(shared.balance)}
              </td>
              <td className="!px-2 text-right text-muted">{sharedOut ? fmtNum(sharedOut) : ""}</td>
              <td className="!px-2 text-right text-faint">dividido</td>
              <td className="!px-2" title={status("shared").top}>
                <HealthBadge level={status("shared").level} />
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td>Juntos</td>
            <td className="text-right">{fmtNum(all.income)}</td>
            <td className="text-right">{fmtNum(all.expense)}</td>
            <td className="text-right">{fmtNum(all.savings)}</td>
            <td className="text-right" style={{ color: tone(all.balance) }}>
              {fmtNum(all.balance)}
            </td>
            <td />
            <td className="text-right" style={{ color: tone(all.balance) }}>
              {fmtNum(all.balance)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
