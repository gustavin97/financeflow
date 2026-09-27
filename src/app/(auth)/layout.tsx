import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getSessionUser } from "@/lib/auth";

/** Miniatura de planilha usada no painel lateral (decorativa, dados fictícios). */
function MiniSheet() {
  const rows = [
    ["Salário", "6.200,00", "in"],
    ["Aluguel", "1.850,00", "out"],
    ["Cartão de crédito", "1.240,30", "out"],
    ["Cinema e jantar", "180,00", "out"],
    ["Cofrinho: apartamento", "900,00", "sv"],
  ] as const;
  const color = { in: "#7fd6a4", out: "#f0a08f", sv: "#8db7f2" };
  return (
    <div className="w-full max-w-[420px] border border-white/15 bg-white/[0.04]" aria-hidden="true">
      <div className="grid grid-cols-[28px_1fr_110px] border-b border-white/15 bg-white/[0.06] text-[12px] font-semibold text-white/70">
        <span className="border-r border-white/10 py-2" />
        <span className="border-r border-white/10 px-3 py-2">Descrição</span>
        <span className="px-3 py-2 text-right">Valor</span>
      </div>
      {rows.map(([d, v, k], i) => (
        <div
          key={d}
          className="grid grid-cols-[28px_1fr_110px] border-b border-white/10 text-[13px] text-white/90"
        >
          <span className="border-r border-white/10 py-2 text-center text-[11px] text-white/40">
            {i + 1}
          </span>
          <span className="border-r border-white/10 px-3 py-2">{d}</span>
          <span className="px-3 py-2 text-right font-medium" style={{ color: color[k] }}>
            {v}
          </span>
        </div>
      ))}
      <div className="grid grid-cols-[28px_1fr_110px] bg-white/[0.06] text-[13px] font-semibold text-white">
        <span className="border-r border-white/10 py-2" />
        <span className="border-r border-white/10 px-3 py-2">Sobra do mês</span>
        <span className="px-3 py-2 text-right text-[#7fd6a4]">2.029,70</span>
      </div>
    </div>
  );
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSessionUser()) redirect("/planilha");
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(420px,520px)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0f2a1c] p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <Link href="/" className="relative">
          <Logo light />
        </Link>
        <div className="relative space-y-8">
          <div className="max-w-md">
            <h1 className="text-[34px] font-semibold leading-[1.15] tracking-tight">
              Tudo o que entra e sai, numa planilha que já faz as contas por você.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-white/70">
              Cada tabela alimenta as outras: o salário define os limites, as contas descontam do
              saldo e o cofrinho mostra quanto falta para a sua meta.
            </p>
          </div>
          <MiniSheet />
        </div>
        <p className="relative text-xs text-white/45">Finance Flow, controle financeiro pessoal.</p>
      </aside>
      <main className="flex items-center justify-center bg-white px-5 py-10">
        <div className="w-full max-w-[380px]">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <Logo />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
