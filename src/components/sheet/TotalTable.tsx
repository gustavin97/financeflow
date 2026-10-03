"use client";

import { AlertTriangle, GripVertical, MoreHorizontal, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { refLabel, refOptions, type MonthCalc } from "@/lib/calc";
import { KIND_META } from "@/lib/kinds";
import { fmtBRL, fmtNum } from "@/lib/money";
import type { Block, Member } from "@/lib/types";
import { MemberTag } from "../MembersEditor";
import { Dropdown, MenuItem } from "../ui/Dropdown";
import { BlockSettingsDialog, RefSelect } from "./blockDialogs";
import { MoneyCell, TextCell } from "./cells";
import type { useMonth } from "./useMonth";

type Actions = Pick<ReturnType<typeof useMonth>, "patchBlock" | "removeBlock" | "addEntry" | "patchEntry" | "removeEntry">;

/**
 * Tabela de total: cada linha soma (+) ou subtrai (−) o valor de outra tabela,
 * de uma pessoa, do saldo... ou um valor digitado. Tudo se atualiza sozinho.
 */
export function TotalTable({
  block,
  blocks,
  members,
  calc,
  actions,
}: {
  block: Block;
  blocks: Block[];
  members: Member[];
  calc: MonthCalc;
  actions: Actions;
}) {
  const meta = KIND_META.total;
  const [settings, setSettings] = useState(false);
  const owner = members.find((m) => m.id === block.memberId) ?? null;
  const groups = useMemo(() => refOptions(blocks, members, block.id), [blocks, members, block.id]);
  const total = calc.blockValue(block.id);
  const cyclic = calc.cyclic.has(block.id);

  return (
    <section className="panel-open" aria-label={`Tabela ${block.name}`}>
      <div
        data-drag-handle
        className="flex h-12 cursor-grab items-center rounded-t-xl border-b border-grid active:cursor-grabbing"
        style={{ background: `linear-gradient(180deg, ${meta.color}12, ${meta.color}05)`, boxShadow: `inset 0 2px 0 ${meta.color}` }}
      >
        <span
          className="flex h-full w-7 shrink-0 touch-none items-center justify-center text-faint hover:text-muted"
          title="Arraste para mover a tabela"
          aria-hidden
        >
          <GripVertical size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <TextCell
            bold
            label="Nome da tabela"
            value={block.name}
            onCommit={(v) => v.trim() && actions.patchBlock(block.id, { name: v.trim() })}
          />
        </div>
        {members.length > 0 && (
          <button className="hidden px-2 hover:underline sm:block" title="Mudar dono da tabela" onClick={() => setSettings(true)}>
            <MemberTag member={owner} />
          </button>
        )}
        <span
          className="mx-1 hidden items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13.5px] font-semibold sm:flex"
          style={{ color: meta.color, background: `${meta.color}14` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
          {meta.label}
        </span>
        <span className="whitespace-nowrap px-2 text-[16px] font-semibold" style={{ color: total < 0 ? "#c4361f" : undefined }}>
          {fmtBRL(total)}
        </span>
        <Dropdown label={`Opções de ${block.name}`} trigger={<MoreHorizontal size={18} />}>
          <MenuItem onClick={() => setSettings(true)}>Dono da tabela</MenuItem>
          <div className="my-1 border-t border-grid" />
          <MenuItem
            danger
            onClick={() => {
              if (window.confirm(`Excluir a tabela “${block.name}”?`)) actions.removeBlock(block.id);
            }}
          >
            Excluir tabela
          </MenuItem>
        </Dropdown>
      </div>

      <div className="overflow-x-auto">
        <table className="sheet" style={{ minWidth: 42 + 66 + 180 + 260 + 152 + 40 }}>
          <colgroup>
            <col style={{ width: 42 }} />
            <col style={{ width: 66 }} />
            <col />
            <col style={{ width: 260 }} />
            <col style={{ width: 152 }} />
            <col style={{ width: 40 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="gutter" />
              <th title="Soma ou subtrai">±</th>
              <th>Descrição</th>
              <th>Vem de</th>
              <th className="!text-right">Valor (R$)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {block.entries.map((e, i) => {
              const value = calc.rowValue(block, e);
              const patch = (p: Parameters<Actions["patchEntry"]>[2]) => actions.patchEntry(block.id, e.id, p);
              return (
                <tr key={e.id} className="group hover:bg-[#f6faf7]">
                  <td className="gutter">
                    <span className="group-hover:hidden">{i + 1}</span>
                    <button
                      className="hidden h-[37px] w-full items-center justify-center text-faint hover:bg-red-50 hover:text-expense group-hover:flex focus-visible:flex"
                      aria-label={`Excluir linha ${i + 1}`}
                      onClick={() => actions.removeEntry(block.id, e.id)}
                    >
                      <X size={15} />
                    </button>
                  </td>
                  <td className="!p-0">
                    <button
                      className="flex h-[37px] w-full items-center justify-center text-[17px] font-semibold hover:bg-head"
                      style={{ color: e.sign === -1 ? "#c4361f" : "#107c41" }}
                      aria-label={e.sign === -1 ? "Subtrai (clique para somar)" : "Soma (clique para subtrair)"}
                      title="Clique para trocar entre somar e subtrair"
                      onClick={() => patch({ sign: e.sign === -1 ? 1 : -1 })}
                    >
                      {e.sign === -1 ? "−" : "+"}
                    </button>
                  </td>
                  <td>
                    <TextCell
                      label="Descrição"
                      value={e.description}
                      placeholder={e.ref ? refLabel(e.ref, blocks, members) : "Descrição"}
                      onCommit={(v) => patch({ description: v })}
                    />
                  </td>
                  <td>
                    <RefSelect
                      className="cell"
                      label="De onde vem o valor"
                      value={e.ref}
                      groups={groups}
                      emptyLabel="Valor digitado"
                      onChange={(ref) =>
                        patch({
                          ref,
                          // descrição acompanha a origem enquanto o usuário não escreveu a dele
                          ...(!e.description || (e.ref && e.description === refLabel(e.ref, blocks, members))
                            ? { description: ref ? refLabel(ref, blocks, members) : "" }
                            : {}),
                        })
                      }
                    />
                  </td>
                  <td>
                    {e.ref ? (
                      <span
                        className="block px-2 text-right leading-[37px]"
                        style={{ color: value < 0 ? "#c4361f" : undefined }}
                        title="Calculado automaticamente"
                      >
                        {fmtNum(value)}
                      </span>
                    ) : (
                      <MoneyCell label="Valor" value={e.amount} onCommit={(v) => patch({ amount: v })} />
                    )}
                  </td>
                  <td />
                </tr>
              );
            })}
            {block.entries.length === 0 && (
              <tr>
                <td className="gutter" />
                <td colSpan={4} className="!px-2 text-[15px] text-faint">
                  Adicione linhas apontando para outras tabelas, pessoas ou saldos.
                </td>
                <td />
              </tr>
            )}
            <tr>
              <td className="gutter" />
              <td colSpan={4} className="!p-0">
                <button
                  onClick={() => actions.addEntry(block.id)}
                  className="flex h-[37px] w-full items-center gap-1.5 px-2 text-[15px] font-medium text-brand hover:bg-brand-soft"
                >
                  <Plus size={16} /> Nova linha
                </button>
              </td>
              <td />
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="gutter" />
              <td />
              <td colSpan={2}>Total</td>
              <td className="text-right" style={{ color: total < 0 ? "#c4361f" : undefined }}>
                {fmtNum(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {cyclic && (
        <div className="flex items-center gap-2 border-t border-grid bg-[#fff7e6] px-3 py-1.5 text-[14px] text-[#9a5b00]">
          <AlertTriangle size={16} /> Esta tabela depende dela mesma (referência circular). A linha em círculo conta como zero.
        </div>
      )}

      {settings && (
        <BlockSettingsDialog
          block={block}
          blocks={blocks}
          members={members}
          onClose={() => setSettings(false)}
          onSave={(p) => actions.patchBlock(block.id, p)}
        />
      )}
    </section>
  );
}
