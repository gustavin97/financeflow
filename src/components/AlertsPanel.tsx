"use client";

import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import { useState } from "react";
import type { FinAlert } from "@/lib/alerts";

const STYLE = {
  danger: { icon: OctagonAlert, color: "#c4361f", bg: "#fdf1ef", label: "Atenção" },
  warning: { icon: AlertTriangle, color: "#9a5b00", bg: "#fff7e6", label: "Cuidado" },
  ok: { icon: CheckCircle2, color: "#107c41", bg: "#eef7f1", label: "Tudo certo" },
} as const;

/** Sinalizadores do mês. Mostra os mais graves primeiro; o resto fica recolhido. */
export function AlertsPanel({ alerts, max = 3 }: { alerts: FinAlert[]; max?: number }) {
  const [open, setOpen] = useState(false);
  if (!alerts.length) return null;
  const shown = open ? alerts : alerts.slice(0, max);
  const worst = alerts[0].level;
  const counts = {
    danger: alerts.filter((a) => a.level === "danger").length,
    warning: alerts.filter((a) => a.level === "warning").length,
  };

  return (
    <section className="panel" aria-label="Sinalizadores do mês">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grid px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="h-2 w-2 rounded-full" style={{ background: STYLE[worst].color, boxShadow: `0 0 0 4px ${STYLE[worst].bg}` }} />
          Sinalizadores do mês
        </h2>
        <p className="text-[14px] text-muted">
          {counts.danger > 0 && (
            <span className="font-semibold" style={{ color: STYLE.danger.color }}>
              {counts.danger} {counts.danger === 1 ? "alerta" : "alertas"}
            </span>
          )}
          {counts.danger > 0 && counts.warning > 0 && " · "}
          {counts.warning > 0 && (
            <span className="font-semibold" style={{ color: STYLE.warning.color }}>
              {counts.warning} {counts.warning === 1 ? "cuidado" : "cuidados"}
            </span>
          )}
        </p>
      </div>
      <ul className="divide-y divide-grid">
        {shown.map((a) => {
          const st = STYLE[a.level];
          const Icon = st.icon;
          return (
            <li key={a.id} className="flex items-start gap-3 px-4 py-2.5" style={{ background: st.bg }}>
              <Icon size={18} className="mt-0.5 shrink-0" style={{ color: st.color }} aria-label={st.label} />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold" style={{ color: st.color }}>
                  {a.title}
                </p>
                {a.detail && <p className="text-[14.5px] text-muted">{a.detail}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      {alerts.length > max && (
        <button
          className="w-full border-t border-grid px-4 py-2 text-left text-[14.5px] font-medium text-brand hover:bg-brand-soft"
          onClick={() => setOpen(!open)}
        >
          {open ? "Mostrar menos" : `Ver mais ${alerts.length - max}`}
        </button>
      )}
    </section>
  );
}
