"use client";

import { CalendarDays, Check, CreditCard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { centsToInput, fmtNum, fmtPlain, parseMoney } from "@/lib/money";
import type { Status } from "@/lib/types";

export type Nav = "enter" | "down" | "up";

interface BaseProps {
  dataCell?: string;
  onNav?: (dir: Nav) => void;
  label?: string;
}

function handleKeys(
  e: React.KeyboardEvent<HTMLInputElement>,
  commit: () => void,
  cancel: () => void,
  onNav?: (dir: Nav) => void,
) {
  if (e.key === "Enter") {
    e.preventDefault();
    commit();
    onNav?.("enter");
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    commit();
    onNav?.("down");
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    commit();
    onNav?.("up");
  } else if (e.key === "Escape") {
    cancel();
    e.currentTarget.blur();
  }
}

/* ---------------------------- texto ---------------------------- */
export function TextCell({
  value,
  onCommit,
  onNav,
  dataCell,
  label,
  placeholder,
  bold,
}: BaseProps & {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  bold?: boolean;
}) {
  const [text, setText] = useState(value);
  const last = useRef(value);
  const skip = useRef(false);
  useEffect(() => {
    setText(value);
    last.current = value;
  }, [value]);

  const commit = () => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    if (text !== last.current) {
      last.current = text;
      onCommit(text);
    }
  };

  return (
    <input
      data-cell={dataCell}
      aria-label={label}
      className={`cell ${bold ? "font-semibold" : ""}`}
      value={text}
      placeholder={placeholder}
      maxLength={200}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) =>
        handleKeys(
          e,
          commit,
          () => {
            skip.current = true;
            setText(last.current);
          },
          onNav,
        )
      }
    />
  );
}

/* ---------------------------- dinheiro / número ---------------------------- */
/** Aceita 1.250,50 · 1250.5 · =100+50*2 · (300-20)/2 */
export function MoneyCell({
  value,
  onCommit,
  onNav,
  dataCell,
  label,
  plain,
}: BaseProps & {
  /** centavos (ou, com `plain`, o número x 100) */
  value: number;
  onCommit: (cents: number) => void;
  plain?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const last = useRef(value);
  const skip = useRef(false);
  useEffect(() => {
    last.current = value;
  }, [value]);

  const commit = () => {
    setEditing(false);
    if (skip.current) {
      skip.current = false;
      return;
    }
    const parsed = parseMoney(text);
    if (parsed === null) return; // inválido: volta ao valor anterior
    if (parsed !== last.current) {
      last.current = parsed;
      onCommit(parsed);
    }
  };

  const shown = plain ? fmtPlain(value / 100) : fmtNum(value);

  return (
    <input
      data-cell={dataCell}
      aria-label={label}
      inputMode="decimal"
      className="cell text-right"
      value={editing ? text : value ? shown : ""}
      placeholder={plain ? "0" : "0,00"}
      onFocus={(e) => {
        setEditing(true);
        setText(value ? centsToInput(value).replace(/,00$/, "") : "");
        const el = e.currentTarget;
        requestAnimationFrame(() => el.select());
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) =>
        handleKeys(
          e,
          commit,
          () => {
            skip.current = true;
          },
          onNav,
        )
      }
    />
  );
}

/* ---------------------------- data ---------------------------- */
/** ISO (aaaa-mm-dd) → dd/mm/aaaa */
const isoToBr = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** Aceita dd/mm/aaaa, dd/mm/aa, dd/mm (ano de `fallbackYear`) e só dígitos (ddmmaaaa). */
function brToIso(text: string, fallbackYear: string): string | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const parts = /^\d{5,8}$/.test(t) ? [t.slice(0, 2), t.slice(2, 4), t.slice(4)] : t.split(/[/.\-\s]+/);
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return undefined;
  const [d, m] = parts.map(Number);
  let y = parts[2] ?? fallbackYear;
  if (y.length === 2) y = `20${y}`;
  if (y.length !== 4) return undefined;
  const date = new Date(Number(y), m - 1, d);
  if (date.getFullYear() !== Number(y) || date.getMonth() !== m - 1 || date.getDate() !== d) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Campo de data em dd/mm/aaaa (o seletor nativo segue o idioma do navegador), com calendário. */
export function DateInput({
  value,
  onCommit,
  min,
  max,
  className,
  id,
  dataCell,
  label,
  onNav,
}: BaseProps & {
  value: string | null;
  onCommit: (v: string | null) => void;
  min?: string;
  max?: string;
  className?: string;
  id?: string;
}) {
  const [text, setText] = useState(isoToBr(value));
  const skip = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => setText(isoToBr(value)), [value]);

  const commit = () => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const year = (value ?? max ?? min ?? new Date().toISOString()).slice(0, 4);
    const iso = brToIso(text, year);
    if (iso === undefined || iso === value) {
      setText(isoToBr(value)); // inválido ou igual: volta ao valor anterior
      return;
    }
    onCommit(iso);
  };

  return (
    <div className="relative">
      <input
        id={id}
        data-cell={dataCell}
        aria-label={label}
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        className={`${className ?? ""} pr-8`}
        value={text}
        maxLength={10}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) =>
          handleKeys(
            e,
            commit,
            () => {
              skip.current = true;
              setText(isoToBr(value));
            },
            onNav,
          )
        }
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Abrir calendário"
        className="absolute inset-y-0 right-1 flex items-center px-1 text-faint hover:text-ink"
        onClick={() => {
          try {
            picker.current?.showPicker();
          } catch {
            picker.current?.focus();
          }
        }}
      >
        <CalendarDays size={15} />
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(e) => onCommit(e.target.value || null)}
      />
    </div>
  );
}

export function DateCell({
  value,
  onCommit,
  min,
  max,
  dataCell,
  label,
  alert,
}: BaseProps & {
  value: string | null;
  onCommit: (v: string | null) => void;
  min?: string;
  max?: string;
  alert?: boolean;
}) {
  return (
    <DateInput
      dataCell={dataCell}
      label={label}
      className={`cell text-[14.5px] ${alert ? "font-semibold text-expense" : ""}`}
      value={value}
      min={min}
      max={max}
      onCommit={onCommit}
    />
  );
}

/* ---------------------------- status ---------------------------- */
export function StatusCell({
  status,
  onToggle,
  pendingLabel,
  doneLabel,
  color,
}: {
  status: Status;
  onToggle: () => void;
  pendingLabel: string;
  doneLabel: string;
  color: string;
}) {
  const done = status === "done";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      className="flex h-[37px] w-full items-center gap-2 px-2 text-left text-[14.5px] hover:bg-head"
    >
      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center border"
        style={{
          borderColor: done ? color : "#9aa3ab",
          background: done ? color : "#fff",
        }}
      >
        {done && <Check size={13} strokeWidth={3} className="text-white" />}
      </span>
      <span className={done ? "font-medium" : "text-muted"} style={done ? { color } : undefined}>
        {done ? doneLabel : pendingLabel}
      </span>
    </button>
  );
}

/* ---------------------------- pagar com (select) ---------------------------- */
export function PayWithCell({
  value,
  cards,
  onCommit,
  label,
}: {
  value: string | null;
  cards: { id: string; name: string }[];
  onCommit: (v: string | null) => void;
  label?: string;
}) {
  const card = cards.find((x) => x.id === value);
  return (
    <div className="relative">
      <CreditCard
        size={14}
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"
        style={{ color: card ? "#8a4fa3" : "#b4bcc4" }}
      />
      <select
        aria-label={label}
        className={`cell pl-7 ${card ? "font-medium text-[#8a4fa3]" : "text-muted"}`}
        value={card ? card.id : ""}
        onChange={(e) => onCommit(e.target.value || null)}
      >
        <option value="">Saldo</option>
        {cards.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ---------------------------- meta (select) ---------------------------- */
export function GoalCell({
  value,
  goals,
  onCommit,
  label,
}: {
  value: string | null;
  goals: { id: string; name: string; color: string }[];
  onCommit: (v: string | null) => void;
  label?: string;
}) {
  const goal = goals.find((g) => g.id === value);
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-2 top-1/2 h-2.5 w-2.5 -translate-y-1/2"
        style={{ background: goal?.color ?? "#cfd5db" }}
      />
      <select
        aria-label={label}
        className="cell pl-6"
        value={value ?? ""}
        onChange={(e) => onCommit(e.target.value || null)}
      >
        <option value="">Sem meta</option>
        {goals.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </div>
  );
}
