"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface Drag {
  id: string;
  startX: number;
  startY: number;
  /** onde o mouse pegou a tabela, relativo ao canto dela */
  offX: number;
  offY: number;
  x: number;
  y: number;
  active: boolean;
  /** última tabela sobre a qual o mouse passou (evita trocar de lugar em loop) */
  over: string | null;
  scroll: number;
  raf: number;
}

const THRESHOLD = 6;
const EDGE = 70;

/**
 * Grade de tabelas que dá para reordenar arrastando pelo cabeçalho
 * (qualquer elemento com `data-drag-handle`). A tabela acompanha o mouse e as
 * outras abrem espaço; ao soltar, `onReorder` recebe a nova ordem.
 */
export function SortableGrid({
  ids,
  onReorder,
  render,
  after,
  className,
  style,
}: {
  ids: string[];
  onReorder: (ids: string[]) => void;
  render: (id: string) => React.ReactNode;
  after?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [order, setOrder] = useState(ids);
  const [dragId, setDragId] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const slots = useRef(new Map<string, HTMLDivElement>());
  const bodies = useRef(new Map<string, HTMLDivElement>());
  const orderRef = useRef(order);
  orderRef.current = order;

  // fora de um arraste, segue a ordem que vem de fora
  const key = ids.join("|");
  useEffect(() => {
    if (!drag.current?.active) setOrder(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /** coloca a tabela arrastada embaixo do mouse, a partir do lugar dela na grade */
  const place = useCallback(() => {
    const d = drag.current;
    if (!d?.active) return;
    const slot = slots.current.get(d.id);
    const body = bodies.current.get(d.id);
    if (!slot || !body) return;
    const r = slot.getBoundingClientRect();
    body.style.transform = `translate(${d.x - d.offX - r.left}px, ${d.y - d.offY - r.top}px)`;
  }, []);

  useLayoutEffect(place, [order, place]);

  const hitTest = () => {
    const d = drag.current!;
    let over: string | null = null;
    for (const [id, el] of slots.current) {
      if (id === d.id) continue;
      const r = el.getBoundingClientRect();
      if (d.x >= r.left && d.x <= r.right && d.y >= r.top && d.y <= r.bottom) {
        over = id;
        break;
      }
    }
    if (over === d.over) return;
    d.over = over;
    if (!over) return;
    setOrder((cur) => {
      const from = cur.indexOf(d.id);
      const to = cur.indexOf(over!);
      if (from < 0 || to < 0) return cur;
      const next = [...cur];
      next.splice(from, 1);
      next.splice(to, 0, d.id);
      return next;
    });
  };

  // rolagem automática perto das bordas da tela
  const tick = () => {
    const d = drag.current;
    if (!d?.active) return;
    if (d.scroll) {
      window.scrollBy(0, d.scroll);
      place();
      hitTest();
    }
    d.raf = requestAnimationFrame(tick);
  };

  const end = (commit: boolean) => {
    const d = drag.current;
    drag.current = null;
    window.removeEventListener("pointermove", stable.move);
    window.removeEventListener("pointerup", stable.up);
    window.removeEventListener("pointercancel", stable.cancel);
    window.removeEventListener("keydown", stable.key);
    if (!d?.active) return;
    cancelAnimationFrame(d.raf);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    const body = bodies.current.get(d.id);
    if (body) body.style.transform = "";
    setDragId(null);
    // o clique que vem junto com o soltar não deve acionar nada embaixo do mouse
    const stop = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);

    const next = orderRef.current;
    if (commit && next.join("|") !== ids.join("|")) onReorder(next);
    else setOrder(ids);
  };

  function onMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    d.x = e.clientX;
    d.y = e.clientY;
    if (!d.active) {
      if (Math.hypot(d.x - d.startX, d.y - d.startY) < THRESHOLD) return;
      d.active = true;
      (document.activeElement as HTMLElement | null)?.blur();
      window.getSelection()?.removeAllRanges();
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
      setDragId(d.id);
      d.raf = requestAnimationFrame(tick);
    }
    e.preventDefault();
    const h = window.innerHeight;
    d.scroll = d.y < EDGE ? -Math.ceil((EDGE - d.y) / 4) : d.y > h - EDGE ? Math.ceil((d.y - (h - EDGE)) / 4) : 0;
    place();
    hitTest();
  }

  // os listeners da janela precisam ser os mesmos entre renders para poder removê-los
  const latest = useRef({ onMove, end });
  latest.current = { onMove, end };
  const stable = useRef({
    move: (e: PointerEvent) => latest.current.onMove(e),
    up: () => latest.current.end(true),
    cancel: () => latest.current.end(false),
    key: (e: KeyboardEvent) => {
      if (e.key === "Escape") latest.current.end(false);
    },
  }).current;

  useEffect(() => () => latest.current.end(false), []);

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0 || drag.current) return;
    const t = e.target as HTMLElement;
    if (!t.closest("[data-drag-handle]") || t.closest("button, select, a, [data-no-drag]")) return;
    const slot = slots.current.get(id);
    if (!slot) return;
    const r = slot.getBoundingClientRect();
    drag.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      offX: e.clientX - r.left,
      offY: e.clientY - r.top,
      x: e.clientX,
      y: e.clientY,
      active: false,
      over: null,
      scroll: 0,
      raf: 0,
    };
    window.addEventListener("pointermove", stable.move, { passive: false });
    window.addEventListener("pointerup", stable.up);
    window.addEventListener("pointercancel", stable.cancel);
    window.addEventListener("keydown", stable.key);
  };

  const ref = <T,>(map: Map<string, T>, id: string) => (el: T | null) => {
    if (el) map.set(id, el);
    else map.delete(id);
  };

  return (
    <div className={className} style={style}>
      {order.map((id) => {
        const dragging = dragId === id;
        return (
          <div
            key={id}
            ref={ref(slots.current, id)}
            className={dragging ? "bg-brand-soft/60 outline-dashed outline-2 outline-brand/50" : undefined}
            onPointerDown={(e) => onPointerDown(e, id)}
          >
            <div
              ref={ref(bodies.current, id)}
              className={dragging ? "relative z-30 opacity-95 shadow-2xl" : undefined}
              style={dragging ? { pointerEvents: "none" } : undefined}
            >
              {render(id)}
            </div>
          </div>
        );
      })}
      {after}
    </div>
  );
}
