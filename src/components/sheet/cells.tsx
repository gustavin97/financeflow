"use client";

import { Check } from "lucide-react";
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
    <input
      data-cell={dataCell}
      aria-label={label}
      type="date"
      className={`cell ${alert ? "font-semibold text-expense" : ""} ${value ? "" : "text-faint"}`}
      value={value ?? ""}
      min={min}
      max={max}
      onChange={(e) => onCommit(e.target.value || null)}
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
