"use client";

import { CalendarCheck, ChevronLeft, ChevronRight, Plus, Users, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertsPanel } from "@/components/AlertsPanel";
import { MembersDialog } from "@/components/MembersEditor";
import { BlockTable } from "@/components/sheet/BlockTable";
import { NewBlockDialog } from "@/components/sheet/blockDialogs";
import { SortableGrid } from "@/components/sheet/SortableGrid";
import { TotalTable } from "@/components/sheet/TotalTable";
import { DistributionBar } from "@/components/sheet/DistributionBar";
import { MonthTabs } from "@/components/sheet/MonthTabs";
import { StartMonth } from "@/components/sheet/StartMonth";
import { PeopleTable, SummaryStrip } from "@/components/sheet/SummaryStrip";
import { useMonth } from "@/components/sheet/useMonth";
import { addMonths, currentYm, isYm, ymLabel } from "@/lib/dates";
import { monthAlerts } from "@/lib/alerts";
import { buildCalc, ownerScope } from "@/lib/calc";
import { SHARED_COLOR } from "@/lib/kinds";
import { computeSummary } from "@/lib/summary";

export default function MonthPage() {
  const params = useParams<{ ym: string }>();
  const router = useRouter();
  const ym = params.ym;
  const valid = isYm(ym);

  useEffect(() => {
    if (!valid) router.replace(`/planilha/${currentYm()}`);
  }, [valid, router]);

  if (!valid) return null;
  return <MonthView key={ym} ym={ym} />;
}

function MonthView({ ym }: { ym: string }) {
  const m = useMonth(ym);
  const { data } = m;
  const [showNew, setShowNew] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  /** filtro de tabelas: "all", "shared" ou id da pessoa */
  const [who, setWho] = useState("all");

  const summary = useMemo(
    () => (data ? computeSummary(data.blocks, data.carry) : null),
    [data],
  );
  const calc = useMemo(
    () => (data ? buildCalc(data.blocks, data.members, data.carry) : null),
    [data],
  );
  const alerts = useMemo(
    () =>
      data && calc
        ? monthAlerts({ ym, blocks: data.blocks, members: data.members, carry: data.carry, calc })
        : [],
    [data, calc, ym],
  );

  const members = data?.members ?? [];
  const filter = members.some((x) => x.id === who) || who === "shared" ? who : "all";
  const visible = (data?.blocks ?? []).filter((b) => filter === "all" || ownerScope(b, members) === filter);

  /** com filtro de pessoa, só as tabelas visíveis trocam de lugar entre si */
  const reorder = (visibleIds: string[]) => {
    if (!data) return;
    const shown = new Set(visibleIds);
    let k = 0;
    m.reorderBlocks(data.blocks.map((b) => (shown.has(b.id) ? visibleIds[k++] : b.id)));
  };

  const title = ymLabel(ym).replace(/^./, (c) => c.toUpperCase());
  const isNow = ym === currentYm();

  return (
    <>
      <div className="w-full px-4 sm:px-6 lg:px-8 pb-20 pt-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center overflow-hidden rounded-xl border border-line bg-white shadow-sheet">
            <Link
              href={`/planilha/${addMonths(ym, -1)}`}
              className="flex h-11 w-11 items-center justify-center text-muted hover:bg-head hover:text-ink"
              aria-label="Mês anterior"
            >
              <ChevronLeft size={19} />
            </Link>
            <h1 className="min-w-[190px] border-x border-line px-3 text-center text-[18px] font-semibold leading-[44px]">
              {title}
            </h1>
            <Link
              href={`/planilha/${addMonths(ym, 1)}`}
              className="flex h-11 w-11 items-center justify-center text-muted hover:bg-head hover:text-ink"
              aria-label="Próximo mês"
            >
              <ChevronRight size={19} />
            </Link>
          </div>
          {!isNow && (
            <Link href={`/planilha/${currentYm()}`} className="btn h-11">
              Ir para o mês atual
            </Link>
          )}
          {data?.initialized && (
            <div className="ml-auto flex gap-2">
              <button className="btn h-11" onClick={() => setShowMembers(true)}>
                <Users size={17} /> Pessoas{members.length ? ` (${members.length})` : ""}
              </button>
              <button className="btn btn-primary h-11" onClick={() => setShowNew(true)}>
                <Plus size={17} /> Nova tabela
              </button>
            </div>
          )}
        </div>

        {m.error && (
          <div
            role="alert"
            className="mb-4 flex items-start justify-between gap-3 border border-expense/30 bg-red-50 px-3 py-2 text-[15px] text-expense"
          >
            <span>{m.error}</span>
            <button onClick={m.clearError} aria-label="Fechar aviso">
              <X size={17} />
            </button>
          </div>
        )}

        {!data && m.loading && <SheetSkeleton />}

        {data && !data.initialized && (
          <StartMonth ym={ym} previousYm={data.previousYm} onStart={m.start} />
        )}

        {data && data.initialized && summary && calc && (
          <div className="space-y-4">
            {data.autoFrom && (
              <div
                role="status"
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-brand/30 bg-brand-soft px-4 py-2.5 text-[15px]"
              >
                <CalendarCheck size={18} className="shrink-0 text-brand" />
                <span className="flex-1">
                  <strong className="font-semibold">{title} foi aberto sozinho</strong> a partir de {ymLabel(data.autoFrom)}.
                  Confira os valores do mês; as parcelas já entraram.{" "}
                  <Link href="/conta#automacao" className="font-medium text-brand underline-offset-2 hover:underline">
                    Mudar isso
                  </Link>
                </span>
                <button className="btn btn-sm" onClick={m.dismissAuto}>
                  Entendi
                </button>
              </div>
            )}
            <SummaryStrip s={summary} carry={data.carry} />
            <AlertsPanel alerts={alerts} />
            {members.length > 0 ? (
              <PeopleTable members={members} calc={calc} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 border border-dashed border-[#aab3bb] bg-white/60 px-4 py-2.5 text-[15px] text-muted">
                <span>Planilha do casal? Cadastre as pessoas para ter tabelas de cada um e o saldo de cada pessoa.</span>
                <button className="btn btn-sm" onClick={() => setShowMembers(true)}>
                  <Users size={15} /> Cadastrar pessoas
                </button>
              </div>
            )}
            <DistributionBar blocks={data.blocks} income={summary.income} />

            {members.length > 0 && (
              <div className="seg" role="tablist" aria-label="Filtrar tabelas por pessoa">
                {[
                  { id: "all", name: "Todas as tabelas", color: null as string | null },
                  ...members.map((x) => ({ id: x.id, name: x.name, color: x.color })),
                  { id: "shared", name: "Conjunto", color: SHARED_COLOR },
                ].map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={filter === t.id}
                    onClick={() => setWho(t.id)}
                    className="seg-item"
                  >
                    {t.color && <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />}
                    {t.name}
                  </button>
                ))}
              </div>
            )}

            <SortableGrid
              className="grid items-start gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 820px), 1fr))" }}
              ids={visible.map((b) => b.id)}
              onReorder={reorder}
              render={(id) => {
                const b = data.blocks.find((x) => x.id === id);
                if (!b) return null;
                return b.kind === "total" ? (
                  <TotalTable block={b} blocks={data.blocks} members={members} calc={calc} actions={m} />
                ) : (
                  <BlockTable
                    block={b}
                    blocks={data.blocks}
                    goals={data.goals}
                    members={members}
                    calc={calc}
                    income={summary.income}
                    ym={ym}
                    actions={m}
                  />
                );
              }}
              after={
                <button
                  onClick={() => setShowNew(true)}
                  className="flex min-h-[120px] flex-col items-center justify-center gap-1 border border-dashed border-[#aab3bb] bg-white/60 text-[15px] font-medium text-muted transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
                >
                  <Plus size={20} />
                  Nova tabela
                </button>
              }
            />
          </div>
        )}
      </div>

      <MonthTabs ym={ym} />
      {showNew && (
        <NewBlockDialog
          members={members}
          defaultMemberId={filter !== "all" && filter !== "shared" ? filter : null}
          onClose={() => setShowNew(false)}
          onCreate={m.addBlock}
          onManageMembers={() => {
            setShowNew(false);
            setShowMembers(true);
          }}
        />
      )}
      {showMembers && (
        <MembersDialog members={members} onChange={m.setMembers} onClose={() => setShowMembers(false)} />
      )}
    </>
  );
}

function SheetSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="grid grid-cols-2 kpis gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[92px] bg-white" />
        ))}
      </div>
      <div className="h-[92px] rounded-xl border border-line bg-white" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 rounded-xl border border-line bg-white" />
        <div className="h-64 rounded-xl border border-line bg-white" />
      </div>
    </div>
  );
}
