"use client";

import { Copy, LayoutTemplate, Square } from "lucide-react";
import { useState } from "react";
import { ymLabel } from "@/lib/dates";
import type { StartMode } from "./useMonth";

export function StartMonth({
  ym,
  previousYm,
  onStart,
}: {
  ym: string;
  previousYm: string | null;
  onStart: (mode: StartMode) => Promise<void>;
}) {
  const [busy, setBusy] = useState<StartMode | null>(null);
  const go = async (mode: StartMode) => {
    setBusy(mode);
    await onStart(mode);
    setBusy(null);
  };

  const options: {
    mode: StartMode;
    title: string;
    text: string;
    icon: React.ReactNode;
    show: boolean;
    primary?: boolean;
  }[] = [
    {
      mode: "copy",
      title: `Copiar de ${previousYm ? ymLabel(previousYm) : "mês anterior"}`,
      text: "Traz as tabelas e os lançamentos fixos (salário, aluguel, assinaturas). Tudo volta como pendente e as datas acompanham o novo mês.",
      icon: <Copy size={18} />,
      show: !!previousYm,
      primary: true,
    },
    {
      mode: "structure",
      title: "Copiar só as tabelas",
      text: "Mantém tabelas, colunas e limites do mês anterior, mas sem nenhum lançamento.",
      icon: <LayoutTemplate size={18} />,
      show: !!previousYm,
    },
    {
      mode: "default",
      title: "Usar o modelo padrão",
      text: "Receitas, contas da casa, cartão de crédito, compras online, lazer e cofrinho, prontos para preencher.",
      icon: <LayoutTemplate size={18} />,
      show: !previousYm,
      primary: !previousYm,
    },
    {
      mode: "blank",
      title: "Começar em branco",
      text: "Uma planilha vazia. Você cria as tabelas que quiser.",
      icon: <Square size={18} />,
      show: true,
    },
  ];
  // com mês anterior, o modelo padrão continua disponível como alternativa
  if (previousYm)
    options.splice(2, 0, {
      mode: "default",
      title: "Usar o modelo padrão",
      text: "Receitas, contas da casa, cartão de crédito, compras online, lazer e cofrinho, vazios.",
      icon: <LayoutTemplate size={18} />,
      show: true,
    });

  return (
    <div className="mx-auto mt-6 max-w-2xl border border-grid bg-white shadow-sheet">
      <div className="border-b border-grid bg-head px-5 py-3">
        <h2 className="text-[15px] font-semibold">Como quer começar {ymLabel(ym)}?</h2>
        <p className="mt-0.5 text-[13px] text-muted">Você pode mudar tudo depois, tabela por tabela.</p>
      </div>
      <ul className="divide-y divide-grid">
        {options
          .filter((o) => o.show)
          .map((o) => (
            <li key={o.mode}>
              <button
                onClick={() => go(o.mode)}
                disabled={busy !== null}
                className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-brand-soft"
              >
                <span className={`mt-0.5 ${o.primary ? "text-brand" : "text-muted"}`}>{o.icon}</span>
                <span className="flex-1">
                  <span className="block text-[14px] font-semibold">
                    {o.title}
                    {busy === o.mode && <span className="ml-2 text-xs font-normal text-muted">Preparando...</span>}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted">{o.text}</span>
                </span>
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
