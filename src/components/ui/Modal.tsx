"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export function Modal({
  title,
  onClose,
  children,
  width = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/45 p-4 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`w-full ${width} border border-grid bg-white shadow-pop`}>
        <div className="flex h-11 items-center justify-between border-b border-grid bg-head pl-4 pr-1">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <button className="btn btn-ghost h-9 w-9 px-0" onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
