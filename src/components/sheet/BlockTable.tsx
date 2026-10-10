"use client";

import { CalendarRange, Check, CreditCard, GripVertical, MoreHorizontal, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CARD_META, KIND_META } from "@/lib/kinds";
import { fmtBRL, fmtNum, fmtPct, fmtPlain } from "@/lib/money";
import { MONTHS_LONG, monthRange, todayIso } from "@/lib/dates";
import { faturaDates, faturaYm, hasCycle } from "@/lib/card";
import { refLabel, type MonthCalc, type Running } from "@/lib/calc";
import { blockTotals, budgetLimit, type CardInfo } from "@/lib/summary";
import type { Block, Entry, ExtraColumn, GoalLite, Member } from "@/lib/types";
import { MemberTag } from "../MembersEditor";
import { Dropdown, MenuItem } from "../ui/Dropdown";
import { BlockSettingsDialog } from "./blockDialogs";
import { DateCell, GoalCell, MoneyCell, PayWithCell, StatusCell, TextCell, type Nav } from "./cells";
import { BudgetDialog, ColumnsDialog, InstallmentDialog } from "./dialogs";
import type { useMonth } from "./useMonth";

type Actions = Pick<
  ReturnType<typeof useMonth>,
  | "patchBlock"
  | "removeBlock"
  | "completeBlock"
  | "addEntry"
  | "patchEntry"
  | "removeEntry"
  | "addInstallment"
  | "removeInstallment"
  | "moveFatura"
>;

const DONE_PLURAL = { income: "recebidos", expense: "pagos", savings: "guardados", total: "" } as const;

const shortDate = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");
const monthName = (ym: string) => MONTHS_LONG[Number(ym.slice(5)) - 1];

/** Fatura (mês) de uma compra no cartão `c`, quando não é a do mês da tabela. Parcelas não mudam de fatura. */
function otherFatura(e: Entry, c: Block | null | undefined, ym: string): string | null {
  if (!c || !hasCycle(c) || !e.date || e.installment) return null;
  const f = faturaYm(e.date, c.cardClose!, c.cardDue!);
  return f === ym ? null : f;
}

/** Etiqueta "fatura de novembro": pela data, a compra é de outra fatura. Clicar move. */
function FaturaTag({ target, onMove }: { target: string; onMove: () => void }) {
  return (
    <button
      className="mr-1 shrink-0 whitespace-nowrap rounded bg-amber-100 px-1.5 text-[12.5px] font-medium leading-[20px] text-amber-900 hover:bg-amber-200"
      title={`Pela data, esta compra é da fatura de ${monthName(target)}. Clique para mover.`}
      onClick={onMove}
    >
      fatura de {monthName(target).slice(0, 3)}
    </button>
  );
}

export function BlockTable({
  block,
  blocks,
  goals,
  members,
  calc,
  income,
  ym,
  actions,
}: {
  block: Block;
  blocks: Block[];
  goals: GoalLite[];
  members: Member[];
  calc: MonthCalc;
  income: number;
  ym: string;
  actions: Actions;
}) {
  const card = calc.cards.get(block.id) ?? null;
  const meta = KIND_META[block.kind];
  const color = card ? CARD_META.color : meta.color;
  const { total: ownTotal, done, count, doneCount } = blockTotals(block);
  // o cartão mostra a fatura inteira: compras da própria tabela + despesas pagas com ele
  const total = card ? card.bill : ownTotal;
  const [dialog, setDialog] = useState<"budget" | "columns" | "settings" | "installment" | null>(null);
  const running = calc.running.get(block.id) ?? null;
  const owner = members.find((m) => m.id === block.memberId) ?? null;
  const tableRef = useRef<HTMLTableElement>(null);
  const pendingFocus = useRef<{ index: number; col: string } | null>(null);
  // o cartão com fechamento aceita as datas do período da fatura (que começa no mês anterior)
  const cycle = card && hasCycle(block) ? faturaDates(ym, block.cardClose!, block.cardDue!) : null;
  const monthR = monthRange(ym);
  const range = cycle
    ? { min: cycle.start < monthR.min ? cycle.start : monthR.min, max: cycle.close > monthR.max ? cycle.close : monthR.max }
    : monthR;
  const today = todayIso();
  const [moveNote, setMoveNote] = useState<string | null>(null);
  const misplaced = card
    ? [...block.entries, ...card.charges.map((c) => c.entry)].filter((e) => otherFatura(e, block, ym))
    : [];
  const moveToFatura = async (ids?: string[]) => {
    const moved = await actions.moveFatura(block.id, ids);
    const later = [...new Set(moved.filter((m) => !m.started).map((m) => monthName(m.ym)))];
    const n = moved.length;
    setMoveNote(
      n
        ? `${n} ${n === 1 ? "compra movida" : "compras movidas"}.` +
            (later.length ? ` ${n === 1 ? "Entra" : "Entram"} em ${later.join(" e ")} quando o mês for iniciado.` : "")
        : null,
    );
  };
  const isSavings = block.kind === "savings";
  const targetTotal = isSavings ? block.entries.reduce((s, e) => s + (e.target ?? 0), 0) : 0;
  const extras = block.columns;

  // cartões em que as linhas desta despesa podem ser lançadas
  const cards = card || block.kind !== "expense" ? [] : blocks.filter((b) => calc.cards.has(b.id));
  const showPayWith = cards.length > 0;
  const showStatus = !card;
  const showSaldo = card ? card.limit !== null : !!running;
  const onCardTotal = showPayWith
    ? block.entries.reduce((s, e) => s + (e.payWith && calc.cards.has(e.payWith) ? e.amount : 0), 0)
    : 0;

  /* coluna "Saldo": no cartão, é o limite que vai sendo consumido */
  let saldo: number[] = running?.after ?? [];
  let chargeSaldo: number[] = [];
  if (card && card.limit !== null) {
    let bal = card.limit;
    saldo = block.entries.map((e) => (bal -= e.amount));
    chargeSaldo = card.charges.map((c) => (bal -= c.entry.amount));
  }
  const saldoEnd = card ? (card.available ?? 0) : (running?.end ?? 0);

  /* foco em uma nova linha assim que ela aparece */
  useEffect(() => {
    const p = pendingFocus.current;
    if (!p) return;
    const el = tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${p.index}:${p.col}"]`);
    if (el) {
      el.focus();
      pendingFocus.current = null;
    }
  }, [block.entries.length]);

  const focusCell = (index: number, col: string) => {
    const el = tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${index}:${col}"]`);
    if (el) {
      el.focus();
      return true;
    }
    return false;
  };

  const navigate = (index: number, col: string, dir: Nav) => {
    if (dir === "up") return void focusCell(index - 1, col);
    if (!focusCell(index + 1, col) && dir === "enter") {
      pendingFocus.current = { index: index + 1, col };
      actions.addEntry(block.id);
    }
  };

  const addRow = () => {
    pendingFocus.current = { index: block.entries.length, col: "desc" };
    actions.addEntry(block.id);
  };

  const minWidth =
    42 +
    180 +
    128 +
    (showSaldo ? 128 : 0) +
    152 +
    (isSavings ? 128 + 166 : 0) +
    (showStatus ? 128 : 0) +
    (showPayWith ? 150 : 0) +
    extras.length * 156 +
    40;

  // o limite em % é calculado sobre o dinheiro de onde a tabela sai
  const base = running ? calc.resolve(running.source) : income;
  const limit = budgetLimit(block, base);
  const cols =
    3 + (showSaldo ? 1 : 0) + (isSavings ? 2 : 0) + (showStatus ? 1 : 0) + (showPayWith ? 1 : 0) + extras.length;

  return (
    <section className="panel-open" aria-label={`Tabela ${block.name}`}>
      {/* ---------- título (segure aqui para arrastar a tabela) ---------- */}
      <div
        data-drag-handle
        className="flex h-12 cursor-grab items-center rounded-t-xl border-b border-grid active:cursor-grabbing"
        style={{ background: `linear-gradient(180deg, ${color}12, ${color}05)`, boxShadow: `inset 0 2px 0 ${color}` }}
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
          <button
            className="hidden px-2 hover:underline sm:block"
            title="Mudar dono da tabela"
            onClick={() => setDialog("settings")}
          >
            <MemberTag member={owner} />
          </button>
        )}
        <span
          className="mx-1 hidden items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13.5px] font-semibold sm:flex"
          style={{ color, background: `${color}14` }}
        >
          {card ? <CreditCard size={14} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
          {card ? CARD_META.short : meta.label}
        </span>
        {block.kind !== "income" && income > 0 && (
          <span className="hidden whitespace-nowrap pr-1 text-[14px] text-muted md:inline">
            {fmtPct(total / income, 1)} da renda
          </span>
        )}
        <span className="whitespace-nowrap px-2 text-[16px] font-semibold" title={card ? "Fatura do mês" : undefined}>
          {fmtBRL(total)}
        </span>
        <Dropdown label={`Opções de ${block.name}`} trigger={<MoreHorizontal size={18} />}>
          {block.kind !== "income" && !card && (
            <MenuItem onClick={() => setDialog("budget")}>
              {isSavings ? "Definir meta do mês" : "Definir limite do mês"}
            </MenuItem>
          )}
          <MenuItem onClick={() => setDialog("settings")}>
            {block.kind === "income"
              ? "Dono da tabela"
              : block.kind === "expense"
                ? "Dono, origem do dinheiro e cartão"
                : "Dono e origem do dinheiro"}
          </MenuItem>
          <MenuItem onClick={() => setDialog("columns")}>Colunas extras</MenuItem>
          {card ? (
            <MenuItem
              onClick={() => actions.patchBlock(block.id, { cardPaid: card.paid === null ? card.bill : null })}
            >
              {card.paid === null ? "Marcar fatura como paga" : "Desmarcar pagamento da fatura"}
            </MenuItem>
          ) : (
            count > 0 && (
              <>
                <MenuItem onClick={() => actions.completeBlock(block.id, "done")}>{meta.doneAll}</MenuItem>
                <MenuItem onClick={() => actions.completeBlock(block.id, "pending")}>Desmarcar todos</MenuItem>
              </>
            )
          )}
          <div className="my-1 border-t border-grid" />
          <MenuItem
            danger
            onClick={() => {
              const extra = card?.charges.length
                ? ` As ${card.charges.length} despesas pagas com ele voltam a sair do saldo.`
                : "";
              if (window.confirm(`Excluir a tabela “${block.name}” e todos os seus lançamentos?${extra}`))
                actions.removeBlock(block.id);
            }}
          >
            Excluir tabela
          </MenuItem>
        </Dropdown>
      </div>

      {/* ---------- grade ---------- */}
      <div className="overflow-x-auto">
        <table ref={tableRef} className="sheet" style={{ minWidth }}>
          <colgroup>
            <col style={{ width: 42 }} />
            <col />
            <col style={{ width: 128 }} />
            {showSaldo && <col style={{ width: 128 }} />}
            <col style={{ width: 152 }} />
            {isSavings && (
              <>
                <col style={{ width: 128 }} />
                <col style={{ width: 166 }} />
              </>
            )}
            {showStatus && <col style={{ width: 128 }} />}
            {showPayWith && <col style={{ width: 150 }} />}
            {extras.map((c) => (
              <col key={c.id} style={{ width: 156 }} />
            ))}
            <col style={{ width: 40 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="gutter" />
              <th>Descrição</th>
              <th className="!text-right">Valor (R$)</th>
              {showSaldo &&
                (card ? (
                  <th className="!text-right" title={`Começa com o limite de ${fmtBRL(card.limit ?? 0)} e desconta cada compra`}>
                    Limite disp.
                  </th>
                ) : (
                  running && (
                    <th
                      className="!text-right"
                      title={`Começa com ${fmtBRL(running.start)} (${refLabel(running.source, blocks, members)}) e desconta cada linha`}
                    >
                      Saldo
                    </th>
                  )
                ))}
              <th>{card ? "Data" : meta.dateLabel}</th>
              {isSavings && (
                <>
                  <th className="!text-right">Meta (R$)</th>
                  <th>Cofrinho</th>
                </>
              )}
              {showStatus && <th>Status</th>}
              {showPayWith && <th title="Saldo: sai do dinheiro da tabela. Cartão: entra na fatura e desconta o limite">Pagar com</th>}
              {extras.map((c) => (
                <th key={c.id} title={c.name} className={c.type === "currency" || c.type === "number" ? "!text-right" : ""}>
                  {c.name}
                </th>
              ))}
              <th className="!p-0">
                <button
                  className="flex h-full w-full items-center justify-center text-muted hover:bg-white hover:text-brand"
                  title="Adicionar coluna"
                  aria-label="Adicionar coluna"
                  onClick={() => setDialog("columns")}
                >
                  <Plus size={16} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {block.entries.map((e, i) => (
              <EntryRow
                key={e.id}
                entry={e}
                index={i}
                block={block}
                goals={goals}
                range={range}
                today={today}
                actions={actions}
                navigate={navigate}
                saldo={showSaldo ? (saldo[i] ?? 0) : null}
                showStatus={showStatus}
                cards={showPayWith ? cards : null}
                onMoveFatura={(cardId, id) =>
                  cardId === block.id ? moveToFatura([id]) : actions.moveFatura(cardId, [id])
                }
              />
            ))}
            {block.entries.length === 0 && (
              <tr>
                <td className="gutter" />
                <td colSpan={cols} className="!px-2 text-[15px] text-faint">
                  {card
                    ? "Nenhuma compra lançada direto no cartão. Clique em “Nova linha” ou escolha este cartão em “Pagar com” nas despesas."
                    : "Nenhum lançamento ainda. Clique em “Nova linha” para começar."}
                </td>
                <td />
              </tr>
            )}
            <tr>
              <td className="gutter" />
              <td colSpan={cols} className="!p-0">
                <div className="flex">
                  <button
                    onClick={addRow}
                    className="flex h-[37px] flex-1 items-center gap-1.5 px-2 text-[15px] font-medium text-brand hover:bg-brand-soft"
                  >
                    <Plus size={16} /> Nova linha
                  </button>
                  {block.kind === "expense" && (
                    <button
                      onClick={() => setDialog("installment")}
                      className="flex h-[37px] items-center gap-1.5 whitespace-nowrap px-3 text-[15px] font-medium text-muted hover:bg-brand-soft hover:text-brand"
                      title="Lança a compra aqui e as próximas parcelas nos meses seguintes"
                    >
                      <CalendarRange size={16} /> Compra parcelada
                    </button>
                  )}
                </div>
              </td>
              <td />
            </tr>
            {card && card.charges.length > 0 && (
              <>
                <tr>
                  <td className="gutter" />
                  <td colSpan={cols} className="!px-2 bg-[#f7f2fa] text-[14px] font-medium" style={{ color }}>
                    Despesas de outras tabelas pagas com este cartão
                  </td>
                  <td className="bg-[#f7f2fa]" />
                </tr>
                {card.charges.map((c, i) => (
                  <tr key={c.entry.id} className="text-[14.5px]">
                    <td className="gutter">
                      <CreditCard size={13} className="mx-auto" style={{ color }} />
                    </td>
                    <td className="!px-2">
                      <span className="flex items-center">
                      {(() => {
                        const f = otherFatura(c.entry, block, ym);
                        return f ? <FaturaTag target={f} onMove={() => moveToFatura([c.entry.id])} /> : null;
                      })()}
                      <span className="block min-w-0 truncate">
                        {c.entry.description || <span className="text-faint">Sem descrição</span>}
                        {c.entry.installment && (
                          <span className="text-muted">
                            {" "}
                            ({c.entry.installment.no}/{c.entry.installment.count})
                          </span>
                        )}
                        <span className="text-muted"> · {c.block.name}</span>
                      </span>
                      </span>
                    </td>
                    <td className="!px-2 text-right">{fmtNum(c.entry.amount)}</td>
                    {showSaldo && (
                      <td
                        className="bg-[#fafbfb] !px-2 text-right"
                        style={{ color: chargeSaldo[i] < 0 ? "#c4361f" : "#5f6b76", fontWeight: chargeSaldo[i] < 0 ? 600 : undefined }}
                      >
                        {fmtNum(chargeSaldo[i])}
                      </td>
                    )}
                    <td className="!px-2 text-muted">{shortDate(c.entry.date)}</td>
                    <td colSpan={extras.length + 1} />
                  </tr>
                ))}
              </>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="gutter" />
              <td>{card ? "Fatura" : "Total"}</td>
              <td className="text-right">{fmtNum(total)}</td>
              {showSaldo && (
                <td className="text-right" style={{ color: saldoEnd < 0 ? "#c4361f" : undefined }}>
                  {fmtNum(saldoEnd)}
                </td>
              )}
              <td />
              {isSavings && (
                <>
                  <td className="text-right">{targetTotal ? fmtNum(targetTotal) : ""}</td>
                  <td />
                </>
              )}
              {showStatus && (
                <td className="whitespace-nowrap text-[14px] font-medium text-muted">
                  {count > 0 ? `${doneCount} de ${count} ${DONE_PLURAL[block.kind]}` : ""}
                </td>
              )}
              {showPayWith && (
                <td className="whitespace-nowrap text-[14px] font-medium" style={{ color: CARD_META.color }}>
                  {onCardTotal ? `${fmtNum(onCardTotal)} no cartão` : ""}
                </td>
              )}
              {extras.map((c) => (
                <td key={c.id} className="text-right">
                  <ExtraSum col={c} block={block} />
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ---------- origem do dinheiro / limite / meta / fatura ---------- */}
      {card ? (
        <CardBar
          block={block}
          card={card}
          running={running}
          sourceLabel={running ? refLabel(running.source, blocks, members) : ""}
          onEditSource={() => setDialog("settings")}
          onPatch={(p) => actions.patchBlock(block.id, p)}
          cycle={cycle}
          ym={ym}
          misplaced={misplaced.length}
          moveNote={moveNote}
          onMoveAll={() => moveToFatura()}
        />
      ) : (
        <>
          {running && (
            <SourceBar
              running={running}
              label={refLabel(running.source, blocks, members)}
              onEdit={() => setDialog("settings")}
              onCard={onCardTotal}
            />
          )}
          {block.kind !== "income" && block.budgetType !== "none" && (
            <BudgetBar block={block} total={total} done={done} limit={limit} income={base} />
          )}
        </>
      )}

      {dialog === "budget" && (
        <BudgetDialog
          block={block}
          onClose={() => setDialog(null)}
          onSave={(budgetType, budgetValue) => actions.patchBlock(block.id, { budgetType, budgetValue })}
        />
      )}
      {dialog === "settings" && (
        <BlockSettingsDialog
          block={block}
          blocks={blocks}
          members={members}
          onClose={() => setDialog(null)}
          onSave={(p) => actions.patchBlock(block.id, p)}
        />
      )}
      {dialog === "installment" && (
        <InstallmentDialog
          block={block}
          ym={ym}
          cards={cards}
          onClose={() => setDialog(null)}
          onSave={(input) => actions.addInstallment(block.id, input)}
        />
      )}
      {dialog === "columns" && (
        <ColumnsDialog
          block={block}
          onClose={() => setDialog(null)}
          onSave={(columns) => actions.patchBlock(block.id, { columns })}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function EntryRow({
  entry: e,
  index: i,
  block,
  goals,
  range,
  today,
  actions,
  navigate,
  saldo,
  showStatus,
  cards,
  onMoveFatura,
}: {
  entry: Entry;
  index: number;
  block: Block;
  goals: GoalLite[];
  range: { min: string; max: string };
  today: string;
  actions: Actions;
  navigate: (index: number, col: string, dir: Nav) => void;
  saldo: number | null;
  showStatus: boolean;
  /** cartões disponíveis para "Pagar com"; null = coluna escondida */
  cards: Block[] | null;
  onMoveFatura: (cardId: string, entryId: string) => void;
}) {
  const meta = KIND_META[block.kind];
  const patch = (p: Parameters<Actions["patchEntry"]>[2]) => actions.patchEntry(block.id, e.id, p);
  const onCard = !!cards && !!e.payWith && cards.some((c) => c.id === e.payWith);
  // compra no cartão (na tabela dele ou paga com ele) que, pela data, é de outra fatura
  const faturaCard = block.card ? block : (cards?.find((c) => c.id === e.payWith) ?? null);
  const fatura = otherFatura(e, faturaCard, block.ym);
  const overdue = block.kind === "expense" && showStatus && !onCard && e.status === "pending" && !!e.date && e.date < today;

  return (
    <tr className="group hover:bg-[#f6faf7]">
      <td className="gutter">
        <span className="group-hover:hidden">{i + 1}</span>
        <button
          className="hidden h-[37px] w-full items-center justify-center text-faint hover:bg-red-50 hover:text-expense group-hover:flex focus-visible:flex"
          aria-label={`Excluir linha ${i + 1}`}
          title="Excluir linha"
          onClick={() => actions.removeEntry(block.id, e.id)}
        >
          <X size={15} />
        </button>
      </td>
      <td>
        <div className="flex items-center">
          <div className="min-w-0 flex-1">
            <TextCell
              dataCell={`${i}:desc`}
              label="Descrição"
              value={e.description}
              placeholder="Descrição"
              onCommit={(v) => patch({ description: v })}
              onNav={(d) => navigate(i, "desc", d)}
            />
          </div>
          {fatura && faturaCard && <FaturaTag target={fatura} onMove={() => onMoveFatura(faturaCard.id, e.id)} />}
          {e.installment && <InstallmentTag entry={e} onEnd={actions.removeInstallment} />}
        </div>
      </td>
      <td>
        <MoneyCell
          dataCell={`${i}:amount`}
          label="Valor"
          value={e.amount}
          onCommit={(v) => patch({ amount: v })}
          onNav={(d) => navigate(i, "amount", d)}
        />
      </td>
      {saldo !== null && (
        <td
          className="bg-[#fafbfb] !px-2 text-right text-[14.5px]"
          style={{ color: saldo < 0 ? "#c4361f" : "#5f6b76", fontWeight: saldo < 0 ? 600 : undefined }}
          title={onCard ? "Pago com cartão: não sai do saldo" : undefined}
        >
          {fmtNum(saldo)}
        </td>
      )}
      <td>
        <DateCell
          label={block.card ? "Data" : meta.dateLabel}
          value={e.date}
          min={range.min}
          max={range.max}
          alert={overdue}
          onCommit={(v) => patch({ date: v })}
        />
      </td>
      {block.kind === "savings" && (
        <td>
          <MoneyCell
            dataCell={`${i}:target`}
            label="Meta"
            value={e.target ?? 0}
            onCommit={(v) => patch({ target: v > 0 ? v : null })}
            onNav={(d) => navigate(i, "target", d)}
          />
        </td>
      )}
      {block.kind === "savings" && (
        <td>
          <GoalCell
            label="Cofrinho"
            value={e.goalId}
            goals={goals}
            onCommit={(v) => patch({ goalId: v })}
          />
        </td>
      )}
      {showStatus && (
        <td>
          {onCard ? (
            <span
              className="flex h-[37px] items-center gap-2 px-2 text-[14.5px] font-medium"
              style={{ color: CARD_META.color }}
              title="Fica paga quando a fatura do cartão for paga"
            >
              <CreditCard size={16} /> Na fatura
            </span>
          ) : (
            <StatusCell
              status={e.status}
              color={meta.color}
              pendingLabel={meta.pending}
              doneLabel={meta.done}
              onToggle={() => patch({ status: e.status === "done" ? "pending" : "done" })}
            />
          )}
        </td>
      )}
      {cards && (
        <td>
          <PayWithCell label="Pagar com" value={e.payWith} cards={cards} onCommit={(v) => patch({ payWith: v })} />
        </td>
      )}
      {block.columns.map((c) => (
        <td key={c.id}>
          <ExtraCell
            col={c}
            entry={e}
            range={range}
            dataCell={`${i}:x_${c.id}`}
            onNav={(d) => navigate(i, `x_${c.id}`, d)}
            onChange={(v) => patch({ extra: { ...e.extra, [c.id]: v } })}
          />
        </td>
      ))}
      <td />
    </tr>
  );
}

/** Etiqueta "3/12" da parcela; o menu encerra o parcelamento. */
function InstallmentTag({ entry, onEnd }: { entry: Entry; onEnd: (id: string) => void }) {
  const inst = entry.installment!;
  const tag = `${inst.no}/${inst.count}`;
  const cls = "mr-1 shrink-0 rounded-full bg-head px-2 py-0.5 text-[13px] font-semibold tabular-nums text-muted";
  if (!inst.id) return <span className={cls} title={`Parcela ${tag} (parcelamento encerrado)`}>{tag}</span>;
  return (
    <Dropdown
      label={`Parcela ${tag} de ${entry.description || "compra parcelada"}`}
      trigger={tag}
      triggerClassName={`${cls} hover:bg-brand-soft hover:text-brand`}
    >
      <p className="px-3 py-1.5 text-[14px] text-muted">
        Parcela {inst.no} de {inst.count}
        {inst.count > inst.no ? `. Faltam ${inst.count - inst.no} depois desta.` : ". É a última."}
      </p>
      <MenuItem
        danger
        onClick={() => {
          if (
            window.confirm(
              `Encerrar o parcelamento de “${entry.description}”? Esta parcela e as dos próximos meses são apagadas; as anteriores ficam.`,
            )
          )
            onEnd(inst.id!);
        }}
      >
        Encerrar parcelamento
      </MenuItem>
    </Dropdown>
  );
}

/* ------------------------------------------------------------------ */
/* Cartão: limite, fatura e pagamento                                  */
/* ------------------------------------------------------------------ */

function CardBar({
  block,
  card,
  running,
  sourceLabel,
  onEditSource,
  onPatch,
  cycle,
  ym,
  misplaced,
  moveNote,
  onMoveAll,
}: {
  block: Block;
  card: CardInfo;
  running: Running | null;
  sourceLabel: string;
  onEditSource: () => void;
  onPatch: (p: { budgetType?: "none" | "amount"; budgetValue?: number; cardPaid?: number | null }) => void;
  cycle: { start: string; close: string; due: string } | null;
  ym: string;
  misplaced: number;
  moveNote: string | null;
  onMoveAll: () => void;
}) {
  const paid = card.paid;
  const ratio = card.limit ? card.bill / card.limit : 0;
  const over = card.available !== null && card.available < 0;
  const barColor = over ? "#c4361f" : ratio >= 0.8 ? "#d9822b" : CARD_META.color;
  const left = paid !== null ? card.bill - paid : 0;

  return (
    <div className="space-y-2 border-t border-grid bg-[#fafbfb] px-3 py-2 text-[14px]">
      {/* fechamento e vencimento */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {cycle ? (
          <span className="text-muted">
            Fatura de {monthName(ym)}: compras de {shortDate(cycle.start)} a {shortDate(cycle.close)} · fecha{" "}
            <span className="font-semibold text-ink">{shortDate(cycle.close)}</span> · vence{" "}
            <span className="font-semibold text-ink">{shortDate(cycle.due)}</span>{" "}
            <button className="hover:underline" onClick={onEditSource} title="Mudar fechamento e vencimento">
              (mudar)
            </button>
          </span>
        ) : (
          <button className="text-muted hover:text-ink hover:underline" onClick={onEditSource}>
            Informe o dia do fechamento e do vencimento para separar as faturas
          </button>
        )}
        {misplaced > 0 && (
          <span className="flex items-center gap-2">
            <span className="font-medium text-amber-900">
              {misplaced} {misplaced === 1 ? "compra é" : "compras são"} de outra fatura
            </span>
            <button className="btn btn-sm" onClick={onMoveAll}>
              Mover para a fatura certa
            </button>
          </span>
        )}
      </div>
      {moveNote && <p className="font-medium text-brand">{moveNote}</p>}
      {/* limite */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <label className="flex items-center gap-2 text-muted">
          Limite do cartão
          <span className="w-[130px] overflow-hidden rounded-md border border-line bg-white">
            <MoneyCell
              label="Limite do cartão"
              value={card.limit ?? 0}
              onCommit={(v) =>
                onPatch(v > 0 ? { budgetType: "amount", budgetValue: v } : { budgetType: "none", budgetValue: 0 })
              }
            />
          </span>
        </label>
        <span className="text-muted">
          Fatura: <span className="font-semibold text-ink">{fmtBRL(card.bill)}</span>
          {card.chargesTotal > 0 && (
            <span>
              {" "}
              ({fmtBRL(card.own)} aqui + {fmtBRL(card.chargesTotal)} de outras tabelas)
            </span>
          )}
        </span>
        {card.available !== null ? (
          <span className="font-semibold" style={{ color: over ? "#c4361f" : "#107c41" }}>
            {over ? `Passou ${fmtBRL(-card.available)} do limite` : `Disponível ${fmtBRL(card.available)}`}
          </span>
        ) : (
          <span className="text-faint">Defina o limite para ver quanto ainda dá para gastar</span>
        )}
      </div>
      {card.limit !== null && (
        <div
          className="h-[6px] w-full bg-[#e3e7eb]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round(ratio * 100))}
          aria-label={`Limite usado de ${block.name}`}
        >
          <div className="h-full transition-[width] duration-300" style={{ width: `${Math.min(100, ratio * 100)}%`, background: barColor }} />
        </div>
      )}

      {/* pagamento da fatura */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-grid pt-2">
        <span className="text-muted">
          Pagamento sai de{" "}
          <button className="font-semibold text-ink hover:underline" onClick={onEditSource} title="Mudar de onde sai o pagamento">
            {sourceLabel}
          </button>
          {running && (
            <>
              : {running.sharedWith.length ? "restavam " : ""}
              <span className="font-semibold text-ink">{fmtBRL(running.start)}</span>
            </>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-muted">Valor pago</span>
          <span className="w-[130px] overflow-hidden rounded-md border border-line bg-white">
            <MoneyCell label="Valor pago da fatura" value={paid ?? 0} onCommit={(v) => onPatch({ cardPaid: v > 0 ? v : null })} />
          </span>
          {paid === null ? (
            <button
              className="btn btn-sm"
              disabled={card.bill <= 0}
              onClick={() => onPatch({ cardPaid: card.bill })}
              style={{ borderColor: CARD_META.color, color: CARD_META.color }}
            >
              Pagar fatura ({fmtBRL(card.bill)})
            </button>
          ) : (
            <>
              <span className="flex items-center gap-1 font-semibold text-income">
                <Check size={15} strokeWidth={3} /> Paga
              </span>
              <button className="text-muted hover:underline" onClick={() => onPatch({ cardPaid: null })}>
                Desfazer
              </button>
            </>
          )}
        </span>
      </div>
      {(running || left !== 0) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-muted">
            {left > 0 && `Ficaram ${fmtBRL(left)} da fatura sem pagar. `}
            {left < 0 && `Pago ${fmtBRL(-left)} a mais que a fatura. `}
            {paid === null && card.bill > 0 && "Até pagar, a fatura conta como prevista."}
          </span>
          {running && (
            <span className="font-semibold" style={{ color: running.end < 0 ? "#c4361f" : "#107c41" }}>
              {running.end < 0 ? `Faltam ${fmtBRL(-running.end)}` : `Sobram ${fmtBRL(running.end)}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ExtraCell({
  col,
  entry,
  range,
  dataCell,
  onNav,
  onChange,
}: {
  col: ExtraColumn;
  entry: Entry;
  range: { min: string; max: string };
  dataCell: string;
  onNav: (d: Nav) => void;
  onChange: (v: string | number | null) => void;
}) {
  const raw = entry.extra[col.id];
  switch (col.type) {
    case "currency":
      return (
        <MoneyCell
          dataCell={dataCell}
          label={col.name}
          value={typeof raw === "number" ? raw : 0}
          onCommit={(v) => onChange(v)}
          onNav={onNav}
        />
      );
    case "number":
      return (
        <MoneyCell
          plain
          dataCell={dataCell}
          label={col.name}
          value={typeof raw === "number" ? Math.round(raw * 100) : 0}
          onCommit={(v) => onChange(v / 100)}
          onNav={onNav}
        />
      );
    case "date":
      return (
        <DateCell
          label={col.name}
          value={typeof raw === "string" ? raw : null}
          min={range.min}
          max={range.max}
          onCommit={onChange}
        />
      );
    default:
      return (
        <TextCell
          dataCell={dataCell}
          label={col.name}
          value={typeof raw === "string" ? raw : ""}
          onCommit={(v) => onChange(v.trim() ? v : null)}
          onNav={onNav}
        />
      );
  }
}

function ExtraSum({ col, block }: { col: ExtraColumn; block: Block }) {
  if (col.type !== "currency" && col.type !== "number") return null;
  const sum = block.entries.reduce((s, e) => {
    const v = e.extra[col.id];
    return s + (typeof v === "number" ? v : 0);
  }, 0);
  if (!sum) return null;
  return <>{col.type === "currency" ? fmtNum(sum) : fmtPlain(sum)}</>;
}

/* ------------------------------------------------------------------ */

function SourceBar({
  running,
  label,
  onEdit,
  onCard,
}: {
  running: Running;
  label: string;
  onEdit: () => void;
  /** total das linhas pagas com cartão (não saem daqui) */
  onCard: number;
}) {
  const neg = running.end < 0;
  const after = running.sharedWith;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-grid bg-[#fafbfb] px-3 py-1.5 text-[14px]">
      <span className="text-muted">
        Sai de{" "}
        <button className="font-semibold text-ink hover:underline" onClick={onEdit} title="Mudar origem do dinheiro">
          {label}
        </button>
        : {after.length ? "restavam " : ""}
        <span className="font-semibold text-ink">{fmtBRL(running.start)}</span>
        {after.length > 0 && (
          <span title={`Já usado por: ${after.join(", ")}`}>
            {" "}(depois de {after.length === 1 ? after[0] : `${after.length} tabelas`})
          </span>
        )}
        {onCard > 0 && <span> · {fmtBRL(onCard)} vão para o cartão</span>}
      </span>
      <span className="font-semibold" style={{ color: neg ? "#c4361f" : "#107c41" }}>
        {neg ? `Faltam ${fmtBRL(-running.end)}` : `Sobram ${fmtBRL(running.end)}`}
      </span>
    </div>
  );
}

function BudgetBar({
  block,
  total,
  limit,
  income,
}: {
  block: Block;
  total: number;
  done: number;
  limit: number | null;
  income: number;
}) {
  const isSavings = block.kind === "savings";
  const what = isSavings ? "Meta do mês" : "Limite do mês";

  if (limit === null || (block.budgetType === "percent" && income <= 0)) {
    return (
      <div className="border-t border-grid bg-[#fafbfb] px-3 py-2 text-[14px] text-muted">
        {what}: {fmtPct(block.budgetValue / 100, 0)} da renda. Adicione receitas para calcular.
      </div>
    );
  }

  const ratio = limit > 0 ? total / limit : total > 0 ? 2 : 0;
  const over = !isSavings && total > limit;
  const color = isSavings ? "#1d5fbf" : over ? "#c4361f" : ratio >= 0.8 ? "#d9822b" : "#107c41";
  const origin =
    block.budgetType === "percent"
      ? `${fmtPct(block.budgetValue / 100, block.budgetValue % 1 ? 1 : 0)} da renda`
      : "valor fixo";

  let message: string;
  if (isSavings) {
    message = total >= limit ? "Meta do mês atingida" : `Faltam ${fmtBRL(limit - total)}`;
  } else {
    message = over ? `Passou ${fmtBRL(total - limit)} do limite` : `Restam ${fmtBRL(limit - total)}`;
  }

  return (
    <div className="border-t border-grid bg-[#fafbfb] px-3 py-2">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-[14px]">
        <span className="text-muted">
          {what}: <span className="font-semibold text-ink">{fmtBRL(limit)}</span> ({origin})
        </span>
        <span className="font-semibold" style={{ color }}>
          {message}
        </span>
      </div>
      <div
        className="h-[6px] w-full bg-[#e3e7eb]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.round(ratio * 100))}
        aria-label={what}
      >
        <div className="h-full transition-[width] duration-300" style={{ width: `${Math.min(100, ratio * 100)}%`, background: color }} />
      </div>
    </div>
  );
}
