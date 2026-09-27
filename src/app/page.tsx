import { ArrowUpRight, BarChart3, Calculator, Link2, OctagonAlert, Repeat, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getSessionUser } from "@/lib/auth";

/** Prévia estática da planilha do casal (dados fictícios) para o hero. */
function SheetPreview() {
  const rows = [
    ["Aluguel", "2.850,00", "8.150,00"],
    ["Condomínio", "620,00", "7.530,00"],
    ["Energia", "247,40", "7.282,60"],
    ["Internet", "119,90", "7.162,70"],
  ] as const;
  const people = [
    ["Ana", "#2a78d6", "6.200,00", "1.310,40"],
    ["Bruno", "#eb6834", "4.800,00", "1.014,60"],
  ] as const;
  return (
    <div className="border border-grid bg-white shadow-pop" aria-hidden="true">
      <div className="grid grid-cols-2 gap-px bg-grid sm:grid-cols-4">
        {[
          ["Receitas", "11.000,00", "#107c41"],
          ["Despesas", "7.575,00", "#c4361f"],
          ["Economias", "1.100,00", "#1d5fbf"],
          ["Sobra do mês", "2.325,00", "#107c41"],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-white px-3 py-2.5">
            <p className="text-[11.5px] text-muted">{l}</p>
            <p className="text-[16px] font-semibold leading-tight sm:text-[18px]" style={{ color: c }}>
              {v}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-grid bg-[#fff7e6] px-3 py-1.5 text-[12px] font-medium text-[#9a5b00]">
        <TriangleAlert size={13} className="shrink-0" />
        “Lazer” já usou 85% do limite do mês
      </div>

      <table className="sheet border-t border-grid">
        <colgroup>
          <col />
          <col style={{ width: 92 }} />
          <col style={{ width: 92 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Por pessoa</th>
            <th className="!text-right">Receitas</th>
            <th className="!text-right">Sobra final</th>
          </tr>
        </thead>
        <tbody>
          {people.map(([n, c, inc, left]) => (
            <tr key={n}>
              <td className="!px-2">
                <span className="flex items-center gap-2 font-medium">
                  <span className="h-2.5 w-2.5" style={{ background: c }} />
                  {n}
                </span>
              </td>
              <td className="!px-2 text-right">{inc}</td>
              <td className="!px-2 text-right font-semibold text-income">{left}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: "3px solid #c4361f" }}>
        <div className="flex h-9 items-center justify-between border-b border-grid px-3">
          <span className="text-[13px] font-semibold">Contas da casa</span>
          <span className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[12px] text-muted sm:flex">
              <span className="h-2 w-2 bg-[#6b7280]" /> Conjunto
            </span>
            <span className="text-[13px] font-semibold">R$ 3.837,30</span>
          </span>
        </div>
        <table className="sheet">
          <colgroup>
            <col style={{ width: 32 }} />
            <col />
            <col style={{ width: 92 }} />
            <col style={{ width: 92 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="gutter" />
              <th>Descrição</th>
              <th className="!text-right">Valor</th>
              <th className="!text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([d, v, s], i) => (
              <tr key={d}>
                <td className="gutter">{i + 1}</td>
                <td className="!px-2">{d}</td>
                <td className="!px-2 text-right">{v}</td>
                <td className="bg-[#fafbfb] !px-2 text-right text-muted">{s}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between border-t border-grid bg-[#fafbfb] px-3 py-1.5 text-[12px]">
          <span className="text-muted">
            Sai de <span className="font-semibold text-ink">Todas as receitas</span>
          </span>
          <span className="font-semibold text-income">Sobram R$ 7.162,70</span>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: Users,
    title: "Planilha do casal",
    text: "Cada tabela é de uma pessoa ou do conjunto. O sistema divide as contas da casa pela renda de cada um e mostra quanto sobra para cada pessoa.",
  },
  {
    icon: Link2,
    title: "Tabelas que se conversam",
    text: "A entrada de dinheiro alimenta as despesas: a coluna Saldo começa com o que entrou e vai descontando linha a linha, de uma tabela para a outra.",
  },
  {
    icon: Calculator,
    title: "Tabelas de total",
    text: "Some e subtraia qualquer tabela, pessoa ou saldo: renda do casal, despesas juntas, quanto sobra. Tudo se atualiza sozinho.",
  },
  {
    icon: BarChart3,
    title: "Painel com gráficos",
    text: "Veja onde vocês gastam mais, por tabela, pessoa ou pelas colunas que criarem, compare com o mês anterior e veja quanto dá para guardar no próximo.",
  },
  {
    icon: OctagonAlert,
    title: "Avisos antes do vermelho",
    text: "O Finance Flow avisa quando o mês vai fechar negativo, quando um limite está perto de estourar e quando uma conta está para vencer.",
  },
  {
    icon: Repeat,
    title: "Todo mês sem recomeçar",
    text: "Comece o mês novo copiando o anterior: salários, contas fixas e totais voltam prontos, e o saldo que sobrou segue para o mês seguinte.",
  },
];

export default async function Home() {
  const user = await getSessionUser();

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-grid bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="flex items-center gap-2">
            {user ? (
              <Link href="/planilha" className="btn btn-primary">
                Abrir planilha
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost">
                  Entrar
                </Link>
                <Link href="/cadastro" className="btn btn-primary">
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
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1fr_1.05fr] lg:py-20">
            <div>
              <p className="inline-flex items-center gap-2 border border-brand/25 bg-brand-soft px-2.5 py-1 text-[12.5px] font-semibold text-brand">
                <Users size={14} /> Controle financeiro a dois
              </p>
              <h1 className="mt-5 max-w-xl text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[46px]">
                As contas da casa numa planilha que faz as contas sozinha.
              </h1>
              <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-muted">
                Cada um lança o salário e os próprios gastos, o que é do casal fica no conjunto. O Finance Flow junta
                tudo, mostra quanto sobra para cada pessoa e avisa antes de o mês entrar no vermelho.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={user ? "/planilha" : "/cadastro"} className="btn btn-primary btn-lg">
                  {user ? "Abrir planilha" : "Começar agora"}
                </Link>
                {!user && (
                  <Link href="/login" className="btn btn-lg">
                    Já tenho conta
                  </Link>
                )}
              </div>
              <p className="mt-4 text-[12.5px] text-faint">Gratuito · uma conta para o casal · seus dados ficam com vocês</p>
            </div>
            <SheetPreview />
          </div>
        </section>

        <section className="bg-bench">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-[24px] font-semibold tracking-tight">Tudo o que a planilha de vocês faz sozinha</h2>
            <p className="mt-1.5 max-w-2xl text-[14.5px] text-muted">
              O jeito de uma planilha, com as contas, os gráficos e os avisos que ninguém tem paciência de montar.
            </p>
            <div className="mt-8 grid gap-px border border-grid bg-grid shadow-sheet sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="bg-white px-6 py-7">
                  <span className="flex h-9 w-9 items-center justify-center bg-brand-soft text-brand">
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-4 text-[16px] font-semibold">{title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex flex-wrap items-center justify-between gap-4 border border-grid bg-brand-soft px-6 py-6">
            <div>
              <h2 className="text-[20px] font-semibold tracking-tight">O próximo mês de vocês começa em um minuto.</h2>
              <p className="mt-1 text-[14px] text-muted">
                Crie a conta, cadastre quem é quem e preencha a primeira tabela.
              </p>
            </div>
            <Link href={user ? "/planilha" : "/cadastro"} className="btn btn-primary btn-lg">
              {user ? "Abrir planilha" : "Criar conta"} <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-grid">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-5 py-5 text-[12.5px] text-muted">
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
