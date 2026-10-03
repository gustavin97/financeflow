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
      className="fixed inset-x-0 bottom-0 z-30 flex h-12 items-center gap-2 border-t border-line bg-white/90 px-2 backdrop-blur-md"
    >
      <div className="flex h-9 shrink-0 items-center overflow-hidden rounded-lg border border-line bg-white">
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
      <div className="flex h-9 min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto">
        {MONTHS_SHORT.map((label, i) => {
          const target = `${year}-${pad(i + 1)}`;
          const active = target === ym;
          const isNow = target === now;
          return (
            <Link
              key={target}
              href={`/planilha/${target}`}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-w-[52px] items-center justify-center rounded-lg px-3 text-[15px] transition-colors ${
                active
                  ? "bg-brand font-semibold text-white shadow-sm"
                  : "text-muted hover:bg-head hover:text-ink"
              }`}
            >
              {label}
              {isNow && !active && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand" title="Mês atual" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
