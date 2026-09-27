import { BarChart3, Check, OctagonAlert, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getSessionUser } from "@/lib/auth";

/** Prévia do resumo do casal (decorativa, dados fictícios). */
function CouplePreview() {
  const people = [
    { name: "Ana", color: "#2a78d6", left: "1.310,40" },
    { name: "Bruno", color: "#eb6834", left: "1.014,60" },
  ];
  return (
    <div className="w-full border border-white/15 bg-white/[0.04] text-[16px]" aria-hidden="true">
      <div className="flex justify-between border-b border-white/15 bg-white/[0.06] px-4 py-2.5 text-[14px] font-semibold text-white/65">
        <span>Sobra no fim do mês</span>
      </div>
      {people.map((p) => (
        <div key={p.name} className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white/90">
          <span className="flex items-center gap-2.5">
            <span className="h-3 w-3" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold tabular-nums text-[#7fd6a4]">R$ {p.left}</span>
        </div>
      ))}
      <div className="flex items-center justify-between bg-white/[0.06] px-4 py-3 font-semibold text-white">
        <span>Juntos</span>
        <span className="tabular-nums text-[#7fd6a4]">R$ 2.325,00</span>
      </div>
    </div>
  );
}

const POINTS = [
  { icon: Users, text: "Tabelas de cada um e do casal" },
  { icon: BarChart3, text: "Gráficos e projeção do próximo mês" },
  { icon: OctagonAlert, text: "Avisos antes do vermelho" },
];

const GRID = {
  backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
};

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSessionUser()) redirect("/planilha");
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(460px,600px)]">
      <aside className="relative hidden overflow-hidden bg-[#0f2a1c] text-white lg:block">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ ...GRID, backgroundSize: "44px 44px" }} />
        <div className="relative mx-auto flex h-full max-w-[540px] flex-col justify-between px-10 py-10">
          <Link href="/" className="self-start">
            <Logo light large />
          </Link>
          <div className="space-y-10 py-10">
            <div>
              <p className="text-[14px] font-semibold uppercase tracking-[0.12em] text-[#7fd6a4]">
                Controle financeiro a dois
              </p>
              <h1 className="mt-4 text-[40px] font-semibold leading-[1.12] tracking-tight">
                As contas da casa numa planilha que faz as contas sozinha.
              </h1>
            </div>
            <CouplePreview />
            <ul className="space-y-4">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-[17px] text-white/85">
                  <Icon size={20} className="shrink-0 text-[#7fd6a4]" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[14px] text-white/50">Seus dados ficam guardados só no servidor onde o Finance Flow roda.</p>
        </div>
      </aside>

      <main className="flex flex-col bg-white">
        {/* faixa da marca no celular, no lugar do painel lateral */}
        <div className="relative overflow-hidden bg-[#0f2a1c] px-5 py-6 text-white lg:hidden">
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ ...GRID, backgroundSize: "32px 32px" }} />
          <Link href="/" className="relative inline-block">
            <Logo light large />
          </Link>
          <p className="relative mt-3 text-[17px] leading-snug text-white/85">
            As contas da casa, a dois, numa planilha que faz as contas sozinha.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-10">
          <div className="w-full max-w-[420px]">
            {children}
            <ul className="mt-12 space-y-3 border-t border-grid pt-6 lg:hidden">
              {POINTS.map(({ text }) => (
                <li key={text} className="flex items-center gap-2.5 text-[16px] text-muted">
                  <Check size={18} className="shrink-0 text-brand" />
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
