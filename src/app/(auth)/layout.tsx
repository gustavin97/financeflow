import { BarChart3, Check, OctagonAlert, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getSessionUser } from "@/lib/auth";

/** Prévia do resumo do casal (decorativa, dados fictícios). */
function CouplePreview() {
  const people = [
    { name: "Ana", color: "#2a78d6", income: "6.200,00", left: "1.310,40" },
    { name: "Bruno", color: "#eb6834", income: "4.800,00", left: "1.014,60" },
  ];
  return (
    <div className="w-full border border-white/15 bg-white/[0.04] text-[13px]" aria-hidden="true">
      <div className="grid grid-cols-[1fr_110px_110px] border-b border-white/15 bg-white/[0.06] text-[12px] font-semibold text-white/65">
        <span className="px-3 py-2">Por pessoa</span>
        <span className="border-l border-white/10 px-3 py-2 text-right">Receitas</span>
        <span className="border-l border-white/10 px-3 py-2 text-right">Sobra final</span>
      </div>
      {people.map((p) => (
        <div key={p.name} className="grid grid-cols-[1fr_110px_110px] border-b border-white/10 text-white/90">
          <span className="flex items-center gap-2 px-3 py-2">
            <span className="h-2.5 w-2.5" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="border-l border-white/10 px-3 py-2 text-right tabular-nums">{p.income}</span>
          <span className="border-l border-white/10 px-3 py-2 text-right font-medium tabular-nums text-[#7fd6a4]">
            {p.left}
          </span>
        </div>
      ))}
      <div className="grid grid-cols-[1fr_110px_110px] bg-white/[0.06] font-semibold text-white">
        <span className="px-3 py-2">Juntos</span>
        <span className="border-l border-white/10 px-3 py-2 text-right tabular-nums">11.000,00</span>
        <span className="border-l border-white/10 px-3 py-2 text-right tabular-nums text-[#7fd6a4]">2.325,00</span>
      </div>
      <div className="flex items-center gap-2 border-t border-white/15 bg-[#3a1d14]/70 px-3 py-2 text-[12.5px] text-[#f5b8a8]">
        <OctagonAlert size={14} className="shrink-0" />
        “Lazer” já usou 85% do limite do mês
      </div>
    </div>
  );
}

const POINTS = [
  { icon: Users, text: "Tabelas de cada um e do casal, com o saldo de cada pessoa" },
  { icon: BarChart3, text: "Painel com gráficos, comparação e projeção do próximo mês" },
  { icon: OctagonAlert, text: "Avisos antes de o mês entrar no vermelho" },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSessionUser()) redirect("/planilha");
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(440px,560px)]">
      <aside className="relative hidden overflow-hidden bg-[#0f2a1c] text-white lg:block">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative mx-auto flex h-full max-w-[560px] flex-col justify-between px-10 py-10">
          <Link href="/" className="self-start">
            <Logo light />
          </Link>
          <div className="space-y-8 py-10">
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[#7fd6a4]">
                Controle financeiro a dois
              </p>
              <h1 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-tight">
                As contas da casa numa planilha que faz as contas sozinha.
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-white/70">
                Cada um lança o que é seu, o que é do casal fica no conjunto, e o Finance Flow mostra quanto sobra
                para cada pessoa no fim do mês.
              </p>
            </div>
            <CouplePreview />
            <ul className="space-y-2.5">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-[14px] text-white/80">
                  <Icon size={16} className="mt-0.5 shrink-0 text-[#7fd6a4]" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-white/45">Seus dados ficam guardados só no servidor onde o Finance Flow roda.</p>
        </div>
      </aside>

      <main className="flex flex-col bg-white">
        {/* faixa da marca no celular, no lugar do painel lateral */}
        <div className="relative overflow-hidden bg-[#0f2a1c] px-5 py-5 text-white lg:hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <Link href="/" className="relative inline-block">
            <Logo light />
          </Link>
          <p className="relative mt-2 text-[13.5px] text-white/75">
            As contas da casa, a dois, numa planilha que faz as contas sozinha.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[380px]">
            {children}
            <ul className="mt-10 space-y-1.5 border-t border-grid pt-5 lg:hidden">
              {POINTS.map(({ text }) => (
                <li key={text} className="flex items-start gap-2 text-[13px] text-muted">
                  <Check size={14} className="mt-0.5 shrink-0 text-brand" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
