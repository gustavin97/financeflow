import { EXPENSE_PALETTE, KIND_META } from "@/lib/kinds";
import { fmtBRL, fmtPct } from "@/lib/money";
import { blockTotals } from "@/lib/summary";
import type { Block } from "@/lib/types";

/** Mostra para onde vai a renda do mês: cada tabela vira um trecho da barra. */
export function DistributionBar({ blocks, income }: { blocks: Block[]; income: number }) {
  let expenseIdx = 0;
  const segments = blocks
    .filter((b) => b.kind === "expense" || b.kind === "savings")
    .map((b) => ({
      id: b.id,
      name: b.name,
      value: blockTotals(b).total,
      color: b.kind === "savings" ? KIND_META.savings.color : EXPENSE_PALETTE[expenseIdx++ % EXPENSE_PALETTE.length],
    }))
    .filter((s) => s.value > 0);

  const out = segments.reduce((s, x) => s + x.value, 0);

  if (income <= 0) {
    return (
      <div className="border border-grid bg-white px-4 py-3 text-[13px] text-muted shadow-sheet">
        Preencha a tabela de receitas para ver como sua renda se divide entre as despesas e as economias.
      </div>
    );
  }

  const base = Math.max(income, out);
  const free = income - out;

  return (
    <div className="border border-grid bg-white px-4 py-3 shadow-sheet">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold">Para onde vai a renda do mês</h2>
        <p className="text-[12.5px]" style={{ color: free >= 0 ? "#107c41" : "#c4361f" }}>
          {free >= 0
            ? `Sobram ${fmtBRL(free)} (${fmtPct(free / income, 1)} da renda)`
            : `Faltam ${fmtBRL(-free)}: as saídas passam da renda em ${fmtPct(-free / income, 1)}`}
        </p>
      </div>
      <div className="flex h-[14px] w-full overflow-hidden bg-[#e3e7eb]" role="img" aria-label="Distribuição da renda">
        {segments.map((s) => (
          <div
            key={s.id}
            title={`${s.name}: ${fmtBRL(s.value)} (${fmtPct(s.value / income, 1)} da renda)`}
            style={{ width: `${(s.value / base) * 100}%`, background: s.color }}
            className="border-r border-white last:border-r-0"
          />
        ))}
        {free > 0 && (
          <div
            title={`Sobra: ${fmtBRL(free)}`}
            style={{ width: `${(free / base) * 100}%`, background: "#bfe3cd" }}
          />
        )}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
        {segments.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5 text-[12px] text-muted">
            <span className="h-2.5 w-2.5" style={{ background: s.color }} />
            {s.name}
            <span className="font-semibold text-ink">{fmtPct(s.value / income, 1)}</span>
          </li>
        ))}
        {free > 0 && (
          <li className="flex items-center gap-1.5 text-[12px] text-muted">
            <span className="h-2.5 w-2.5" style={{ background: "#bfe3cd" }} />
            Sobra
            <span className="font-semibold text-ink">{fmtPct(free / income, 1)}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
