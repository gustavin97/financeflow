import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { MONTHS_SHORT, currentYm, splitYm } from "@/lib/dates";

/** Abas dos meses no rodapé, como as abas de uma pasta de trabalho do Excel. */
export function MonthTabs({ ym }: { ym: string }) {
  const { year, month } = splitYm(ym);
  const now = currentYm();
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <nav
      aria-label="Meses"
      className="fixed inset-x-0 bottom-0 z-30 flex h-11 items-stretch border-t border-grid bg-head"
    >
      <div className="flex shrink-0 items-center border-r border-grid bg-white">
        <Link
          href={`/planilha/${year - 1}-${pad(month)}`}
          className="flex h-full w-10 items-center justify-center text-muted hover:bg-head hover:text-ink"
          aria-label={`Ano ${year - 1}`}
        >
          <ChevronLeft size={17} />
        </Link>
        <span className="px-1 text-[15px] font-semibold">{year}</span>
        <Link
          href={`/planilha/${year + 1}-${pad(month)}`}
          className="flex h-full w-10 items-center justify-center text-muted hover:bg-head hover:text-ink"
          aria-label={`Ano ${year + 1}`}
        >
          <ChevronRight size={17} />
        </Link>
      </div>
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {MONTHS_SHORT.map((label, i) => {
          const target = `${year}-${pad(i + 1)}`;
          const active = target === ym;
          const isNow = target === now;
          return (
            <Link
              key={target}
              href={`/planilha/${target}`}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-w-[52px] items-center justify-center border-r border-grid px-3 text-[15px] transition-colors ${
                active
                  ? "bg-white font-semibold text-brand"
                  : "text-muted hover:bg-white hover:text-ink"
              }`}
            >
              {label}
              {isNow && !active && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 bg-brand" title="Mês atual" />}
              {active && <span className="absolute inset-x-0 top-0 h-[3px] bg-brand" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
