"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMsg } from "@/lib/client";
import type { Block, Entry, ExtraColumn, Kind, Member, MonthPayload, Status } from "@/lib/types";

export type BlockPatch = Partial<
  Pick<
    Block,
    "name" | "budgetType" | "budgetValue" | "columns" | "memberId" | "source" | "card" | "cardPaid" | "cardClose" | "cardDue"
  >
>;
export type EntryPatch = Partial<
  Pick<Entry, "description" | "amount" | "date" | "status" | "goalId" | "target" | "extra" | "ref" | "sign" | "payWith">
>;
export interface NewBlock {
  name: string;
  kind: Kind;
  memberId?: string | null;
  card?: boolean;
  columns?: ExtraColumn[];
  rows?: { description: string; ref: string | null; sign: 1 | -1 }[];
}
export interface NewInstallment {
  description: string;
  /** valor total da compra, em centavos */
  total: number;
  count: number;
  currentNo: number;
  date: string | null;
  payWith: string | null;
}
export interface NewImport {
  /** cartão que paga as despesas (fatura); null = saem do saldo */
  payWith: string | null;
  rows: { key: string; blockId: string; description: string; amount: number; date: string }[];
  learn: { pattern: string; blockId: string }[];
}
export type StartMode = "default" | "blank" | "copy" | "structure";

/**
 * Estado do mês com atualização otimista: a tela responde na hora e o servidor
 * é atualizado em segundo plano. Se algo falhar, recarregamos o mês.
 */
export function useMonth(ym: string) {
  const [data, setData] = useState<MonthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    try {
      const d = await api<MonthPayload>(`/api/months/${ym}`);
      if (id === reqId.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (id === reqId.current) setError(errMsg(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [ym]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    load();
  }, [load]);

  const fail = useCallback(
    (e: unknown) => {
      setError(errMsg(e));
      load();
    },
    [load],
  );

  const mapBlocks = (fn: (b: Block) => Block) =>
    setData((d) => (d ? { ...d, blocks: d.blocks.map(fn) } : d));

  /* ---------- mês ---------- */
  const start = async (mode: StartMode) => {
    try {
      setData(await api<MonthPayload>(`/api/months/${ym}`, { body: { mode } }));
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const dismissAuto = () => {
    setData((d) => (d ? { ...d, autoFrom: null } : d));
    api(`/api/months/${ym}`, { method: "PATCH", body: { dismissAuto: true } }).catch(fail);
  };

  /* ---------- tabelas ---------- */
  const addBlock = async (input: NewBlock) => {
    const b = await api<Block>("/api/blocks", { body: { ym, ...input } });
    setData((d) => (d ? { ...d, initialized: true, blocks: [...d.blocks, b] } : d));
  };

  const patchBlock = (id: string, patch: BlockPatch) => {
    // mesmas regras do servidor ao ligar/desligar o cartão
    const local: BlockPatch = patch.card === false ? { ...patch, cardPaid: null } : patch;
    mapBlocks((b) => {
      if (b.id !== id) {
        if (patch.card === false && b.entries.some((e) => e.payWith === id))
          return { ...b, entries: b.entries.map((e) => (e.payWith === id ? { ...e, payWith: null } : e)) };
        return b;
      }
      const next = { ...b, ...local };
      if (patch.columns) {
        const keep = new Set(patch.columns.map((c) => c.id));
        next.entries = b.entries.map((e) => ({
          ...e,
          extra: Object.fromEntries(Object.entries(e.extra).filter(([k]) => keep.has(k))),
        }));
      }
      if (patch.card) next.entries = next.entries.map((e) => ({ ...e, payWith: null }));
      return next;
    });
    api(`/api/blocks/${id}`, { method: "PATCH", body: patch }).catch(fail);
  };

  const removeBlock = (id: string) => {
    setData((d) =>
      d
        ? {
            ...d,
            blocks: d.blocks
              .filter((b) => b.id !== id)
              .map((b) => ({ ...b, entries: b.entries.map((e) => (e.payWith === id ? { ...e, payWith: null } : e)) })),
          }
        : d,
    );
    api(`/api/blocks/${id}`, { method: "DELETE" }).catch(fail);
  };

  /** `ids`: todas as tabelas do mês, na nova ordem */
  const reorderBlocks = (ids: string[]) => {
    const pos = new Map(ids.map((id, i) => [id, i]));
    setData((d) =>
      d
        ? {
            ...d,
            blocks: [...d.blocks]
              .sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9))
              .map((b, i) => ({ ...b, position: i })),
          }
        : d,
    );
    api("/api/blocks/reorder", { body: { ym, ids } }).catch(fail);
  };

  const completeBlock = (id: string, status: Status) => {
    mapBlocks((b) => (b.id === id ? { ...b, entries: b.entries.map((e) => ({ ...e, status })) } : b));
    api(`/api/blocks/${id}/complete`, { body: { status } }).catch(fail);
  };

  /* ---------- linhas ---------- */
  const addEntry = async (blockId: string, init: EntryPatch = {}) => {
    try {
      const e = await api<Entry>("/api/entries", { body: { blockId, ...init } });
      mapBlocks((b) => (b.id === blockId ? { ...b, entries: [...b.entries, e] } : b));
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const patchEntry = (blockId: string, id: string, patch: EntryPatch) => {
    mapBlocks((b) =>
      b.id === blockId
        ? { ...b, entries: b.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }
        : b,
    );
    api(`/api/entries/${id}`, { method: "PATCH", body: patch }).catch(fail);
  };

  const removeEntry = (blockId: string, id: string) => {
    mapBlocks((b) =>
      b.id === blockId ? { ...b, entries: b.entries.filter((e) => e.id !== id) } : b,
    );
    api(`/api/entries/${id}`, { method: "DELETE" }).catch(fail);
  };

  /* ---------- compras parceladas (as parcelas podem criar tabelas: recarrega o mês) ---------- */
  const addInstallment = async (blockId: string, input: NewInstallment) => {
    await api("/api/installments", { body: { blockId, ...input } });
    await load();
  };

  /** apaga as parcelas deste mês em diante; as anteriores ficam */
  const removeInstallment = (installmentId: string) => {
    mapBlocks((b) => ({ ...b, entries: b.entries.filter((e) => e.installment?.id !== installmentId) }));
    api(`/api/installments/${installmentId}`, { method: "DELETE", body: { fromYm: ym } }).catch(fail);
  };

  /* ---------- compras do cartão que são de outra fatura (vão para outro mês: recarrega) ---------- */
  const moveFatura = async (cardId: string, entryIds?: string[]) => {
    try {
      const r = await api<{ moved: { id: string; ym: string; started: boolean }[] }>(`/api/blocks/${cardId}/fatura`, {
        body: { entryIds },
      });
      await load();
      return r.moved;
    } catch (e) {
      setError(errMsg(e));
      return [];
    }
  };

  /* ---------- importação de extrato (muitas linhas em várias tabelas: recarrega o mês) ---------- */
  const importStatement = async (input: NewImport) => {
    const r = await api<{ imported: number; learned: number }>("/api/import", { body: { ym, ...input } });
    await load();
    return r;
  };

  /* ---------- sobra do mês que fechou (mexe no mês anterior e no acumulado: recarrega) ---------- */
  const surplus = async (body: { action: "save"; goalId: string | null; pct: number } | { action: "skip" | "undo" | "dismiss" }) => {
    const from = data?.surplus?.ym;
    if (!from) return;
    if (body.action === "skip" || body.action === "dismiss") setData((d) => (d ? { ...d, surplus: null } : d));
    try {
      await api(`/api/months/${from}/surplus`, { body });
    } catch (e) {
      setError(errMsg(e));
    }
    await load();
  };

  /* ---------- pessoas (a lista é editada no diálogo; aqui só refletimos) ---------- */
  const setMembers = (members: Member[]) => {
    setData((d) => {
      if (!d) return d;
      const ids = new Set(members.map((m) => m.id));
      // pessoa removida: as tabelas dela viram do conjunto, como no servidor
      const blocks = d.blocks.map((b) => (b.memberId && !ids.has(b.memberId) ? { ...b, memberId: null } : b));
      return { ...d, members, blocks };
    });
  };

  return {
    data,
    setMembers,
    loading,
    error,
    clearError: () => setError(null),
    start,
    dismissAuto,
    addBlock,
    patchBlock,
    removeBlock,
    reorderBlocks,
    completeBlock,
    addEntry,
    patchEntry,
    removeEntry,
    addInstallment,
    removeInstallment,
    importStatement,
    surplus,
    moveFatura,
  };
}
