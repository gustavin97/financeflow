"use client";

import { Users } from "lucide-react";
import { ownerScope } from "@/lib/calc";
import { CARD_META, KIND_META, SHARED_COLOR } from "@/lib/kinds";
import { fmtNum } from "@/lib/money";
import { counts } from "@/lib/summary";
import type { Block, Member } from "@/lib/types";
import { MemberTag } from "../MembersEditor";
import { FixedCell, SharedCell, StatusCell } from "./cells";
import type { useMonth } from "./useMonth";

type Actions = Pick<ReturnType<typeof useMonth>, "patchEntry">;

const shortDate = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

/**
 * Linhas do conjunto lançadas nas tabelas de cada pessoa. Aparecem no filtro
 * "Conjunto" mostrando de quem é a linha; marcar, fixar ou voltar para
 * individual aqui muda a linha na tabela de origem.
 */
export function SharedRows({ blocks, members, actions }: { blocks: Block[]; members: Member[]; actions: Actions }) {
  const rows = blocks.flatMap((b) => {
    const owner = members.find((m) => m.id === ownerScope(b, members));
    if (!owner || b.kind === "total") return [];
    return b.entries.filter((e) => e.shared).map((e) => ({ b, e, owner }));
  });
  if (!rows.length) return null;

  // receitas somam; despesas e economias subtraem (só as linhas marcadas)
  const net = rows.reduce(
    (t, { b, e }) => (b.card || !counts(e) ? t : t + (b.kind === "income" ? e.amount : -e.amount)),
    0,
  );

  return (
    <section className="panel-open" aria-label="Lançamentos do conjunto nas tabelas de cada pessoa">
      <div
        className="flex h-12 items-center gap-2 rounded-t-xl border-b border-grid px-3"
        style={{ background: `linear-gradient(180deg, ${SHARED_COLOR}12, ${SHARED_COLOR}05)`, boxShadow: `inset 0 2px 0 ${SHARED_COLOR}` }}
      >
        <Users size={17} style={{ color: SHARED_COLOR }} />
        <h2 className="flex-1 text-[16px] font-semibold">Do conjunto nas tabelas de cada pessoa</h2>
        <span className="whitespace-nowrap text-[16px] font-semibold" style={{ color: net < 0 ? "#c4361f" : undefined }}>
          {fmtNum(net)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="sheet" style={{ minWidth: 160 + 180 + 220 + 128 + 90 + 140 + 88 + 136 }}>
          <colgroup>
            <col style={{ width: 160 }} />
            <col style={{ width: 180 }} />
            <col />
            <col style={{ width: 128 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 136 }} />
          </colgroup>
          <thead>
            <tr>
              <th>De quem</th>
              <th>Tabela</th>
              <th>Descrição</th>
              <th className="!text-right">Valor (R$)</th>
              <th>Data</th>
              <th title="Só as linhas marcadas entram nas contas">Status</th>
              <th title="Linhas fixas são copiadas para o próximo mês; as outras não">Fixa</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ b, e, owner }) => {
              const meta = KIND_META[b.kind];
              const card = b.card || !!e.payWith;
              const patch = (p: Parameters<Actions["patchEntry"]>[2]) => actions.patchEntry(b.id, e.id, p);
              return (
                <tr key={e.id} className="hover:bg-[#f6faf7]">
                  <td className="!px-2">
                    <MemberTag member={owner} />
                  </td>
                  <td className="!px-2">
                    <span className="block truncate" style={{ color: meta.color }}>
                      {b.name}
                    </span>
                  </td>
                  <td className="!px-2">
                    <span className="block truncate">{e.description || <span className="text-faint">Sem descrição</span>}</span>
                  </td>
                  <td className="!px-2 text-right">{fmtNum(e.amount)}</td>
                  <td className="!px-2 text-muted">{shortDate(e.date)}</td>
                  <td>
                    <StatusCell
                      status={e.status}
                      color={card ? CARD_META.color : meta.color}
                      pendingLabel={card ? CARD_META.pending : meta.pending}
                      doneLabel={card ? CARD_META.done : meta.done}
                      onToggle={() => patch({ status: e.status === "done" ? "pending" : "done" })}
                    />
                  </td>
                  <td>
                    <FixedCell fixed={e.fixed} onToggle={() => patch({ fixed: !e.fixed })} />
                  </td>
                  <td>
                    <SharedCell shared owner={owner} onToggle={() => patch({ shared: false })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
