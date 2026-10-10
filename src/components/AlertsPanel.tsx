"use client";

import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import { useState } from "react";
import { worstLevel, type AlertLevel, type FinAlert } from "@/lib/alerts";
import { SHARED_COLOR } from "@/lib/kinds";
import type { Member } from "@/lib/types";

export const ALERT_STYLE = {
  danger: { icon: OctagonAlert, color: "#c4361f", bg: "#fdf1ef", label: "Atenção" },
  warning: { icon: AlertTriangle, color: "#9a5b00", bg: "#fff7e6", label: "Cuidado" },
  ok: { icon: CheckCircle2, color: "#107c41", bg: "#eef7f1", label: "Tudo certo" },
} as const;

/** Etiqueta da saúde de uma pessoa ou do conjunto. */
export function HealthBadge({ level }: { level: AlertLevel | null }) {
  const st = ALERT_STYLE[level ?? "ok"];
  const Icon = st.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[14px] font-semibold" style={{ color: st.color }}>
      <Icon size={15} aria-hidden />
      {st.label}
    </span>
  );
}

/** Sinalizadores de uma pessoa ou do conjunto. Mostra os mais graves primeiro; o resto fica recolhido. */
export function AlertsPanel({
  alerts,
  title = "Sinalizadores do mês",
  color,
  max = 3,
}: {
  alerts: FinAlert[];
  title?: string;
  /** cor da pessoa (bolinha ao lado do nome) */
  color?: string;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const worst = worstLevel(alerts) ?? "ok";
  const shown = open ? alerts : alerts.slice(0, max);
  const counts = {
    danger: alerts.filter((a) => a.level === "danger").length,
    warning: alerts.filter((a) => a.level === "warning").length,
  };

  return (
    <section className="panel" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grid px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: ALERT_STYLE[worst].color, boxShadow: `0 0 0 4px ${ALERT_STYLE[worst].bg}` }}
          />
          {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
          {title}
        </h2>
        <p className="text-[14px] text-muted">
          {counts.danger > 0 && (
            <span className="font-semibold" style={{ color: ALERT_STYLE.danger.color }}>
              {counts.danger} {counts.danger === 1 ? "alerta" : "alertas"}
            </span>
          )}
          {counts.danger > 0 && counts.warning > 0 && " · "}
          {counts.warning > 0 && (
            <span className="font-semibold" style={{ color: ALERT_STYLE.warning.color }}>
              {counts.warning} {counts.warning === 1 ? "cuidado" : "cuidados"}
            </span>
          )}
        </p>
      </div>
      {alerts.length === 0 ? (
        <p className="px-4 py-2.5 text-[14.5px] text-muted">Nenhum aviso.</p>
      ) : (
        <ul className="divide-y divide-grid">
          {shown.map((a) => {
            const st = ALERT_STYLE[a.level];
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
      )}
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

/**
 * Um quadro de sinalizadores para cada pessoa e um para o conjunto, cada um
 * só com os avisos dele. `filter` mostra só o quadro de uma pessoa ("shared" = conjunto).
 */
export function ScopedAlerts({
  alerts,
  members,
  filter = "all",
  max = 3,
}: {
  alerts: FinAlert[];
  members: Member[];
  filter?: string;
  max?: number;
}) {
  if (!members.length) return alerts.length ? <AlertsPanel alerts={alerts} max={max} /> : null;
  const boards = [
    ...members.map((m) => ({ scope: m.id, title: `Sinalizadores de ${m.name}`, color: m.color })),
    { scope: "shared", title: "Sinalizadores do conjunto", color: SHARED_COLOR },
  ]
    .filter((b) => filter === "all" || b.scope === filter)
    .map((b) => ({ ...b, alerts: alerts.filter((a) => a.scope === b.scope) }))
    // o conjunto sem avisos não precisa de quadro
    .filter((b) => b.scope !== "shared" || b.alerts.length > 0 || filter === "shared");
  if (!boards.length) return null;
  return (
    <div className="grid items-start gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))" }}>
      {boards.map((b) => (
        <AlertsPanel key={b.scope} alerts={b.alerts} title={b.title} color={b.color} max={max} />
      ))}
    </div>
  );
}
