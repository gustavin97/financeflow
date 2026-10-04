"use client";

import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MembersEditor } from "@/components/MembersEditor";
import { api, errMsg } from "@/lib/client";
import type { Member, SessionUser } from "@/lib/types";

type ImportRule = { id: string; pattern: string; blockName: string; memberId: string | null };

type AutoMonth = "copy" | "structure" | "off";

const AUTO_OPTIONS: { value: AutoMonth; title: string; text: string }[] = [
  {
    value: "copy",
    title: "Copiar o mês anterior",
    text: "Tabelas e lançamentos fixos (salário, aluguel, assinaturas) voltam como pendentes, com as datas no novo mês.",
  },
  { value: "structure", title: "Copiar só as tabelas", text: "Mesmas tabelas, colunas e limites, sem lançamentos." },
  { value: "off", title: "Não abrir sozinho", text: "No mês novo, você escolhe como começar." },
];

type SurplusPrefs = { mode: "ask" | "auto" | "off"; goalId: string | null; pct: number };

const SURPLUS_OPTIONS: { value: SurplusPrefs["mode"]; title: string; text: string }[] = [
  { value: "ask", title: "Perguntar", text: "No mês novo, a planilha mostra quanto sobrou e vocês decidem quanto guardar e em qual meta." },
  { value: "auto", title: "Guardar sozinho", text: "Na virada do mês a sobra vai direto para a meta escolhida. Dá para desfazer pelo aviso." },
  { value: "off", title: "Não fazer nada", text: "A sobra continua no saldo acumulado, como antes." },
];

type EmailPrefs = { enabled: boolean; hour: number; to: string; configured: boolean };

type Flash = { kind: "ok" | "err"; text: string } | null;

function Msg({ f }: { f: Flash }) {
  if (!f) return null;
  return (
    <p
      role={f.kind === "err" ? "alert" : "status"}
      className={`text-[15px] ${f.kind === "err" ? "text-expense" : "font-medium text-brand"}`}
    >
      {f.text}
    </p>
  );
}

function Panel({ id, title, text, children }: { id?: string; title: string; text?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="panel scroll-mt-20">
      <div className="border-b border-grid bg-head px-4 py-2.5">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {text && <p className="text-[14.5px] text-muted">{text}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [name, setName] = useState("");
  const [nameFlash, setNameFlash] = useState<Flash>(null);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwFlash, setPwFlash] = useState<Flash>(null);
  const [delPw, setDelPw] = useState("");
  const [delFlash, setDelFlash] = useState<Flash>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [autoMonth, setAutoMonth] = useState<AutoMonth | null>(null);
  const [autoFlash, setAutoFlash] = useState<Flash>(null);
  const [rules, setRules] = useState<ImportRule[] | null>(null);
  const [rulesFlash, setRulesFlash] = useState<Flash>(null);
  const [surplus, setSurplus] = useState<SurplusPrefs | null>(null);
  const [pctText, setPctText] = useState("");
  const [goals, setGoals] = useState<{ id: string; name: string }[]>([]);
  const [surplusFlash, setSurplusFlash] = useState<Flash>(null);
  const [email, setEmail] = useState<EmailPrefs | null>(null);
  const [emailFlash, setEmailFlash] = useState<Flash>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api<{ email: EmailPrefs }>("/api/account").then((r) => setEmail(r.email));
  }, []);

  async function saveEmail(patch: { enabled?: boolean; hour?: number }) {
    if (!email) return;
    const before = email;
    setEmail({ ...email, ...patch });
    try {
      await api("/api/account", { method: "PATCH", body: { emailAlerts: patch.enabled, emailHour: patch.hour } });
      setEmailFlash({ kind: "ok", text: "Preferência salva." });
    } catch (err) {
      setEmail(before);
      setEmailFlash({ kind: "err", text: errMsg(err) });
    }
  }

  async function testEmail() {
    setTesting(true);
    setEmailFlash(null);
    try {
      const r = await api<{ count: number }>("/api/account/test-email", { body: {} });
      setEmailFlash({
        kind: "ok",
        text: `E-mail enviado para ${email?.to} com ${r.count} ${r.count === 1 ? "aviso" : "avisos"}. Confira também o spam.`,
      });
    } catch (err) {
      setEmailFlash({ kind: "err", text: errMsg(err) });
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    api<{ surplus: SurplusPrefs }>("/api/account").then((r) => {
      setSurplus(r.surplus);
      setPctText(String(r.surplus.pct));
    });
    api<{ id: string; name: string }[]>("/api/goals").then(setGoals).catch(() => setGoals([]));
  }, []);

  async function saveSurplus(patch: Partial<SurplusPrefs>) {
    if (!surplus) return;
    const before = surplus;
    setSurplus({ ...surplus, ...patch });
    try {
      await api("/api/account", {
        method: "PATCH",
        body: { surplusMode: patch.mode, surplusGoal: patch.goalId, surplusPct: patch.pct },
      });
      setSurplusFlash({ kind: "ok", text: "Preferência salva." });
    } catch (err) {
      setSurplus(before);
      setPctText(String(before.pct));
      setSurplusFlash({ kind: "err", text: errMsg(err) });
    }
  }

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me").then((r) => {
      setUser(r.user);
      setName(r.user.name);
    });
    api<Member[]>("/api/members").then(setMembers).catch(() => setMembers([]));
    api<{ autoMonth: AutoMonth }>("/api/account").then((r) => setAutoMonth(r.autoMonth));
    api<ImportRule[]>("/api/import/rules").then(setRules).catch(() => setRules([]));
  }, []);

  async function saveAutoMonth(mode: AutoMonth) {
    const before = autoMonth;
    setAutoMonth(mode);
    try {
      await api("/api/account", { method: "PATCH", body: { autoMonth: mode } });
      setAutoFlash({ kind: "ok", text: "Preferência salva." });
    } catch (err) {
      setAutoMonth(before);
      setAutoFlash({ kind: "err", text: errMsg(err) });
    }
  }

  async function saveRule(rule: ImportRule, input: HTMLInputElement) {
    const pattern = input.value;
    if (pattern.trim() === rule.pattern) return;
    try {
      const r = await api<{ pattern: string }>(`/api/import/rules/${rule.id}`, { method: "PATCH", body: { pattern } });
      setRules((rs) => rs && rs.map((x) => (x.id === rule.id ? { ...x, pattern: r.pattern } : x)));
      input.value = r.pattern;
      setRulesFlash({ kind: "ok", text: "Regra salva." });
    } catch (err) {
      setRulesFlash({ kind: "err", text: errMsg(err) });
      input.value = rule.pattern;
    }
  }

  async function removeRule(rule: ImportRule) {
    setRules((rs) => rs && rs.filter((x) => x.id !== rule.id));
    try {
      await api(`/api/import/rules/${rule.id}`, { method: "DELETE" });
    } catch (err) {
      setRulesFlash({ kind: "err", text: errMsg(err) });
      api<ImportRule[]>("/api/import/rules").then(setRules);
    }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/account", { method: "PATCH", body: { name } });
      setNameFlash({ kind: "ok", text: "Nome atualizado." });
      router.refresh();
    } catch (err) {
      setNameFlash({ kind: "err", text: errMsg(err) });
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/account", { method: "PATCH", body: { currentPassword: cur, newPassword: next } });
      setPwFlash({ kind: "ok", text: "Senha alterada." });
      setCur("");
      setNext("");
    } catch (err) {
      setPwFlash({ kind: "err", text: errMsg(err) });
    }
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm("Excluir sua conta e todos os seus dados? Essa ação não pode ser desfeita.")) return;
    try {
      await api("/api/account", { method: "DELETE", body: { password: delPw } });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setDelFlash({ kind: "err", text: errMsg(err) });
    }
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pb-12 pt-5">
      <h1 className="mb-4 text-[26px] font-semibold tracking-tight">Minha conta</h1>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Panel title="Perfil">
          <form onSubmit={saveName} className="space-y-3">
            <div>
              <label className="label" htmlFor="acc-name">Nome</label>
              <input id="acc-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="acc-email">E-mail</label>
              <input id="acc-email" className="field bg-head text-muted" value={user?.email ?? ""} readOnly />
            </div>
            <div className="flex items-center gap-3">
              <button className="btn btn-primary">Salvar nome</button>
              <Msg f={nameFlash} />
            </div>
          </form>
        </Panel>

        <Panel title="Pessoas da casa" text="Quem divide as contas. Cada tabela pode ser de uma pessoa ou do conjunto.">
          {members ? <MembersEditor members={members} onChange={setMembers} /> : <div className="h-11" />}
        </Panel>

        <Panel
          id="automacao"
          title="Mês novo automático"
          text="Na virada do mês, a planilha nova já fica pronta quando vocês abrirem o app. As parcelas do mês entram sozinhas."
        >
          <fieldset className="space-y-2" disabled={!autoMonth}>
            <legend className="sr-only">Como abrir o mês novo</legend>
            {AUTO_OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-grid px-3 py-2.5 hover:bg-brand-soft has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              >
                <input
                  type="radio"
                  name="auto-month"
                  className="mt-1 accent-brand"
                  checked={autoMonth === o.value}
                  onChange={() => saveAutoMonth(o.value)}
                />
                <span>
                  <span className="block text-[15.5px] font-semibold">{o.title}</span>
                  <span className="block text-[14.5px] text-muted">{o.text}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="mt-2 min-h-[22px]">
            <Msg f={autoFlash} />
          </div>
        </Panel>

        <Panel
          id="alertas"
          title="Alertas por e-mail"
          text="Uma vez por dia, os avisos da planilha (contas vencendo ou vencidas, limite estourado, mês no vermelho...) chegam no seu e-mail. Só quando há algo novo."
        >
          {!email ? (
            <div className="h-11" />
          ) : (
            <div className="space-y-3">
              {!email.configured && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[14.5px] text-amber-900">
                  O envio ainda não está configurado no servidor. Preencha <code>SMTP_HOST</code>, <code>SMTP_USER</code> e{" "}
                  <code>SMTP_PASS</code> no arquivo <code>.env</code> e reinicie o app (veja o README).
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-3 text-[15.5px]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand"
                  checked={email.enabled}
                  onChange={(e) => saveEmail({ enabled: e.target.checked })}
                />
                Receber os alertas em <strong className="font-semibold">{email.to}</strong>
              </label>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="label" htmlFor="email-hour">
                    Horário
                  </label>
                  <select
                    id="email-hour"
                    className="field w-[120px]"
                    value={email.hour}
                    disabled={!email.enabled}
                    onChange={(e) => saveEmail({ hour: Number(e.target.value) })}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn" onClick={testEmail} disabled={testing || !email.configured}>
                  {testing ? "Enviando..." : "Enviar teste agora"}
                </button>
              </div>
              <p className="text-[14px] text-muted">
                O app precisa estar rodando no horário para enviar. Se estiver desligado, o e-mail sai quando ele voltar a rodar no mesmo dia.
              </p>
            </div>
          )}
          <div className="mt-2 min-h-[22px]">
            <Msg f={emailFlash} />
          </div>
        </Panel>

        <Panel
          id="sobra"
          title="Sobra do mês para o cofrinho"
          text="Quando um mês fecha no azul, a sobra pode ir para uma meta. Ela vira uma linha no cofrinho do mês que fechou e sai do saldo acumulado."
        >
          <fieldset className="space-y-2" disabled={!surplus}>
            <legend className="sr-only">O que fazer com a sobra</legend>
            {SURPLUS_OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-grid px-3 py-2.5 hover:bg-brand-soft has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
              >
                <input
                  type="radio"
                  name="surplus-mode"
                  className="mt-1 accent-brand"
                  checked={surplus?.mode === o.value}
                  onChange={() => saveSurplus({ mode: o.value })}
                />
                <span>
                  <span className="block text-[15.5px] font-semibold">{o.title}</span>
                  <span className="block text-[14.5px] text-muted">{o.text}</span>
                </span>
              </label>
            ))}
            {surplus && surplus.mode !== "off" && (
              <div className="grid gap-3 pt-1 sm:grid-cols-[1fr_140px]">
                <div>
                  <label className="label" htmlFor="surplus-goal">
                    Meta {surplus.mode === "ask" ? "sugerida" : ""}
                  </label>
                  <select
                    id="surplus-goal"
                    className="field"
                    value={surplus.goalId ?? ""}
                    onChange={(e) => saveSurplus({ goalId: e.target.value || null })}
                  >
                    <option value="">Sem meta (só cofrinho)</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="surplus-pct">
                    Quanto da sobra
                  </label>
                  <div className="relative">
                    <input
                      id="surplus-pct"
                      className="field pr-8 text-right tabular-nums"
                      inputMode="numeric"
                      value={pctText}
                      onChange={(e) => setPctText(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      onBlur={() => {
                        const n = Number(pctText);
                        if (n === surplus.pct) return;
                        if (!Number.isInteger(n) || n < 1 || n > 100) {
                          setPctText(String(surplus.pct));
                          setSurplusFlash({ kind: "err", text: "Use uma porcentagem entre 1 e 100." });
                        } else saveSurplus({ pct: n });
                      }}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">%</span>
                  </div>
                </div>
              </div>
            )}
          </fieldset>
          <div className="mt-2 min-h-[22px]">
            <Msg f={surplusFlash} />
          </div>
        </Panel>

        <Panel
          id="regras"
          title="Regras da importação"
          text="Ao importar o extrato, o lançamento que tem todas as palavras da regra vai para a tabela dela. As regras nascem das escolhas que vocês fazem na importação."
        >
          {!rules ? (
            <div className="h-11" />
          ) : rules.length === 0 ? (
            <p className="text-[15px] text-muted">
              Nenhuma regra ainda. Na planilha, use <em>Importar extrato</em>; quando você muda a tabela de um lançamento, a escolha vira regra.
            </p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-grid overflow-y-auto rounded-lg border border-grid">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-2 py-1.5">
                  <input
                    key={r.pattern}
                    aria-label="Palavras da regra"
                    className="field h-9 min-w-0 flex-1 text-[15px]"
                    defaultValue={r.pattern}
                    onBlur={(e) => saveRule(r, e.currentTarget)}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                  <span className="shrink-0 text-muted">→</span>
                  <span className="w-[38%] truncate text-[15px]" title={r.blockName}>
                    {r.blockName}
                    {r.memberId && members?.some((x) => x.id === r.memberId) && (
                      <span className="text-muted"> · {members.find((x) => x.id === r.memberId)!.name}</span>
                    )}
                  </span>
                  <button className="btn btn-ghost h-9 w-9 shrink-0 px-0 text-muted hover:text-expense" onClick={() => removeRule(r)} aria-label={`Excluir regra ${r.pattern}`}>
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 min-h-[22px]">
            <Msg f={rulesFlash} />
          </div>
        </Panel>

        <Panel title="Senha">
          <form onSubmit={savePassword} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="cur-pw">Senha atual</label>
                <input id="cur-pw" type="password" autoComplete="current-password" className="field" value={cur} onChange={(e) => setCur(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="new-pw">Nova senha</label>
                <input id="new-pw" type="password" autoComplete="new-password" minLength={8} className="field" value={next} onChange={(e) => setNext(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="btn btn-primary" disabled={!cur || next.length < 8}>Alterar senha</button>
              <Msg f={pwFlash} />
            </div>
          </form>
        </Panel>

        <Panel title="Seus dados" text="Baixe tudo o que você registrou: tabelas, lançamentos e metas.">
          <a href="/api/export" className="btn">
            <Download size={16} /> Exportar em JSON
          </a>
        </Panel>

        <Panel title="Excluir conta" text="Apaga sua conta, planilhas e metas de forma permanente.">
          <form onSubmit={deleteAccount} className="space-y-3">
            <div className="max-w-xs">
              <label className="label" htmlFor="del-pw">Confirme com sua senha</label>
              <input id="del-pw" type="password" autoComplete="current-password" className="field" value={delPw} onChange={(e) => setDelPw(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <button className="btn btn-danger" disabled={!delPw}>Excluir minha conta</button>
              <Msg f={delFlash} />
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
