import { ArrowUpRight, BarChart3, Calculator, Link2, OctagonAlert, Repeat, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getSessionUser } from "@/lib/auth";

/** Prévia estática do resumo do casal (dados fictícios) para o hero. */
function SheetPreview() {
  const people = [
    ["Ana", "#2a78d6", "6.200,00", "1.310,40"],
    ["Bruno", "#eb6834", "4.800,00", "1.014,60"],
  ] as const;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-pop" aria-hidden="true">
      <div className="grid grid-cols-2 gap-px bg-grid">
        {[
          ["Receitas", "11.000,00", "#107c41"],
          ["Despesas", "7.575,00", "#c4361f"],
          ["Economias", "1.100,00", "#1d5fbf"],
          ["Sobra do mês", "2.325,00", "#107c41"],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-white px-4 py-4 sm:px-5">
            <p className="text-[15px] text-muted">{l}</p>
            <p className="mt-0.5 whitespace-nowrap text-[21px] font-semibold leading-tight tabular-nums sm:text-[28px]" style={{ color: c }}>
              R$ {v}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 border-t border-grid bg-[#fff7e6] px-5 py-3 text-[15px] font-medium text-[#9a5b00]">
        <TriangleAlert size={18} className="shrink-0" />
        “Lazer” já usou 85% do limite do mês
      </div>

      <div className="border-t border-grid">
        <div className="grid grid-cols-[1fr_auto] bg-head px-5 py-2.5 text-[14px] font-semibold text-[#4a5560]">
          <span>Por pessoa</span>
          <span>Sobra final</span>
        </div>
        {people.map(([n, c, inc, left]) => (
          <div key={n} className="grid grid-cols-[1fr_auto] items-center border-t border-grid px-5 py-3 text-[16px]">
            <span className="flex items-center gap-2.5">
              <span className="h-3 w-3" style={{ background: c }} />
              <span className="font-medium">{n}</span>
              <span className="hidden text-[14px] text-muted sm:inline">recebe R$ {inc}</span>
            </span>
            <span className="font-semibold tabular-nums text-income">R$ {left}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: Users, title: "Planilha do casal", text: "Tabelas de cada um e do conjunto, com a sobra de cada pessoa." },
  { icon: Link2, title: "Tabelas que se conversam", text: "O que entra vai sendo descontado pelas despesas, linha a linha." },
  { icon: Calculator, title: "Tabelas de total", text: "Some a renda do casal, junte as despesas e veja quanto sobra." },
  { icon: BarChart3, title: "Painel com gráficos", text: "Onde vocês gastam mais, o mês passado e o que vem pela frente." },
  { icon: OctagonAlert, title: "Avisos antes do vermelho", text: "Alerta de mês negativo, limite estourando e conta vencendo." },
  { icon: Repeat, title: "Todo mês sem recomeçar", text: "Copie o mês anterior: contas fixas e salários voltam prontos." },
];

export default async function Home() {
  const user = await getSessionUser();

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-grid bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo large />
          <nav className="flex items-center gap-2">
            {user ? (
              <Link href="/planilha" className="btn btn-primary h-11 px-5 text-[16px]">
                Abrir planilha
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost hidden h-11 px-4 text-[16px] sm:inline-flex">
                  Entrar
                </Link>
                <Link href="/cadastro" className="btn btn-primary h-11 px-5 text-[16px]">
                  Criar conta
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-grid">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.45]"
            style={{
              backgroundImage:
                "linear-gradient(#eef1f3 1px, transparent 1px), linear-gradient(90deg, #eef1f3 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              maskImage: "linear-gradient(to bottom, black, transparent 85%)",
              WebkitMaskImage: "linear-gradient(to bottom, black, transparent 85%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div>
              <p className="inline-flex items-center gap-2 border border-brand/25 bg-brand-soft px-3 py-1.5 text-[15px] font-semibold text-brand">
                <Users size={17} /> Controle financeiro a dois
              </p>
              <h1 className="mt-6 max-w-xl text-[38px] font-semibold leading-[1.08] tracking-tight sm:text-[54px]">
                As contas da casa numa planilha que faz as contas sozinha.
              </h1>
              <p className="mt-6 max-w-lg text-[19px] leading-relaxed text-muted">
                Cada um lança o que é seu, o que é do casal fica no conjunto, e vocês veem quanto sobra para cada
                pessoa.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href={user ? "/planilha" : "/cadastro"} className="btn btn-primary h-12 px-7 text-[17px]">
                  {user ? "Abrir planilha" : "Começar agora"}
                </Link>
                {!user && (
                  <Link href="/login" className="btn h-12 px-7 text-[17px]">
                    Já tenho conta
                  </Link>
                )}
              </div>
              <p className="mt-5 text-[15px] text-muted">Gratuito · uma conta para o casal</p>
            </div>
            <SheetPreview />
          </div>
        </section>

        <section className="bg-bench">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
            <h2 className="text-[30px] font-semibold leading-tight tracking-tight sm:text-[34px]">
              O que a planilha faz por vocês
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="panel px-6 py-7">
                  <span className="flex h-11 w-11 items-center justify-center bg-brand-soft text-brand">
                    <Icon size={22} />
                  </span>
                  <h3 className="mt-5 text-[20px] font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-[17px] leading-relaxed text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-line bg-brand-soft px-7 py-8">
            <div>
              <h2 className="text-[26px] font-semibold leading-tight tracking-tight">
                O próximo mês de vocês começa em um minuto.
              </h2>
              <p className="mt-2 text-[17px] text-muted">Crie a conta e preencha a primeira tabela.</p>
            </div>
            <Link href={user ? "/planilha" : "/cadastro"} className="btn btn-primary h-12 px-7 text-[17px]">
              {user ? "Abrir planilha" : "Criar conta"} <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-grid">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-5 py-6 text-[15px] text-muted">
          <span>Finance Flow, controle financeiro para casais e famílias.</span>
          {!user && (
            <Link href="/login" className="hover:text-ink hover:underline">
              Entrar
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}
