"use client";

import { useEffect, useRef, useState } from "react";

export function Dropdown({
  trigger,
  label,
  children,
  align = "right",
  triggerClassName = "btn btn-ghost h-11 w-11 px-0",
}: {
  trigger: React.ReactNode;
  label: string;
  children: React.ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-40 mt-1 min-w-[210px] rounded-xl border border-line bg-white p-1 shadow-pop ${
            align === "right" ? "right-0" : "left-0"
          }`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  danger,
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  href?: string;
}) {
  const cls = `flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[15px] hover:bg-head ${
    danger ? "text-expense" : "text-ink"
  }`;
  if (href)
    return (
      <a role="menuitem" href={href} className={cls}>
        {children}
      </a>
    );
  return (
    <button role="menuitem" type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  );
}
