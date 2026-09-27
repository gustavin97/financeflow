import { ArrowUpRight, Link2, PiggyBank, Repeat } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getSessionUser } from "@/lib/auth";

/** Prévia estática da planilha (dados fictícios) para o hero. */
function SheetPreview() {
  const rows = [
    ["Aluguel", "1.850,00", "10/09", true],
    ["Energia", "187,40", "15/09", true],
    ["Internet", "119,90", "20/09", false],
    ["Condomínio", "420,00", "10/09", true],
  ] as const;
  return (
    <div className="border border-grid bg-white shadow-pop" aria-hidden="true">
      <div className="grid grid-cols-4 gap-px bg-grid">
        {[
          ["Receitas", "6.200,00", "#107c41"],
          ["Despesas", "4.180,30", "#c4361f"],
          ["Cofrinho", "900,00", "#1d5fbf"],
          ["Saldo do mês", "1.119,70", "#107c41"],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-white px-3 py-2.5">
            <p className="text-[11.5px] text-muted">{l}</p>
            <p className="text-[16px] font-semibold leading-tight sm:text-[18px]" style={{ color: c }}>
              {v}
            </p>
          </div>
        ))}
      </div>
      <div className="border-t border-grid" style={{ borderTop: "3px solid #c4361f" }}>
        <div className="flex h-9 items-center justify-between border-b border-grid px-3">
          <span className="text-[13px] font-semibold">Contas da casa</span>
          <span className="text-[13px] font-semibold">R$ 2.577,30</span>
        </div>
        <table className="sheet">
          <colgroup>
            <col style={{ width: 32 }} />
            <col />
            <col style={{ width: 96 }} />
            <col style={{ width: 66 }} />
            <col style={{ width: 96 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="gutter" />
              <th>Descrição</th>
              <th className="!text-right">Valor</th>
              <th>Venc.</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([d, v, dt, paid], i) => (
              <tr key={d}>
                <td className="gutter">{i + 1}</td>
                <td className="!px-2">{d}</td>
                <td className="!px-2 text-right">{v}</td>
                <td className="!px-2 text-[12px]">{dt}</td>
                <td className="!px-2 text-[12px]" style={{ color: paid ? "#c4361f" : "#5f6b76", fontWeight: paid ? 600 : 400 }}>
                  {paid ? "Pago" : "A pagar"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-grid bg-[#fafbfb] px-3 py-2">
        <div className="mb-1.5 flex justify-between text-[12px]">
          <span className="text-muted">
            Lazer: limite de <span className="font-semibold text-ink">R$ 620,00</span> (10% da renda)
          </span>
          <span className="font-semibold text-[#d9822b]">Restam R$ 122,10</span>
        </div>
        <div className="h-[6px] bg-[#e3e7eb]">
          <div className="h-full bg-[#d9822b]" style={{ width: "80%" }} />
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const user = await getSessionUser();

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-grid">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Logo />
          <nav className="flex items-center gap-2">
            {user ? (
              <Link href="/planilha" className="btn btn-primary">
                Abrir minha planilha
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
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-[1fr_1.05fr] lg:py-20">
          <div>
            <h1 className="max-w-xl text-[38px] font-semibold leading-[1.1] tracking-tight sm:text-[46px]">
              Uma planilha que já sabe fazer as contas do seu mês.
            </h1>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-muted">
              Lance o salário, as contas da casa, o cartão, as compras online e o lazer em tabelas
              separadas. O Finance Flow liga tudo: mostra o saldo, avisa quando um limite estoura e
              acompanha o cofrinho da sua próxima conquista.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={user ? "/planilha" : "/cadastro"} className="btn btn-primary btn-lg">
                {user ? "Abrir minha planilha" : "Começar agora"}
              </Link>
              {!user && (
                <Link href="/login" className="btn btn-lg">
                  Já tenho conta
                </Link>
              )}
            </div>
          </div>
          <SheetPreview />
        </section>

        <section className="border-y border-grid bg-bench">
          <div className="mx-auto grid max-w-6xl gap-px bg-grid px-0 md:grid-cols-3">
            {[
              {
                icon: <Link2 size={20} />,
                title: "Tabelas que se conversam",
                text: "O total de receitas define os limites em porcentagem. Cada despesa desconta do saldo e a barra de distribuição mostra para onde a renda foi.",
              },
              {
                icon: <PiggyBank size={20} />,
                title: "Cofrinho com metas",
                text: "Guarde um valor por mês para o apartamento, o carro ou a viagem. Veja o quanto já juntou e quando a meta deve ser atingida.",
              },
              {
                icon: <Repeat size={20} />,
                title: "Todo mês sem recomeçar",
                text: "Comece o mês novo copiando o anterior: salário e contas fixas voltam prontos, e o saldo que sobrou segue para o mês seguinte.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-white px-6 py-8">
                <span className="text-brand">{f.icon}</span>
                <h2 className="mt-3 text-[16px] font-semibold">{f.title}</h2>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex flex-wrap items-center justify-between gap-4 border border-grid bg-brand-soft px-6 py-6">
            <div>
              <h2 className="text-[20px] font-semibold tracking-tight">Seu próximo mês começa em um minuto.</h2>
              <p className="mt-1 text-[14px] text-muted">
                Crie a conta, escolha o modelo padrão e preencha a primeira tabela.
              </p>
            </div>
            <Link href={user ? "/planilha" : "/cadastro"} className="btn btn-primary btn-lg">
              {user ? "Abrir minha planilha" : "Criar conta"} <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-grid">
        <div className="mx-auto max-w-6xl px-5 py-5 text-[12.5px] text-muted">
          Finance Flow, controle financeiro para pessoas.
        </div>
      </footer>
    </div>
  );
}
