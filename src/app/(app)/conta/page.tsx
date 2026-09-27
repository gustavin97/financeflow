"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MembersEditor } from "@/components/MembersEditor";
import { api, errMsg } from "@/lib/client";
import type { Member, SessionUser } from "@/lib/types";

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

function Panel({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <section className="border border-grid bg-white shadow-sheet">
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

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me").then((r) => {
      setUser(r.user);
      setName(r.user.name);
    });
    api<Member[]>("/api/members").then(setMembers).catch(() => setMembers([]));
  }, []);

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
