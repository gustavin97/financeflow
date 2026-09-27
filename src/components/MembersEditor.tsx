"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, errMsg } from "@/lib/client";
import { MEMBER_COLORS } from "@/lib/kinds";
import type { Member } from "@/lib/types";
import { Modal } from "./ui/Modal";

/** Lista editável das pessoas da casa. Cada mudança já vai para o servidor. */
export function MembersEditor({
  members,
  onChange,
}: {
  members: Member[];
  onChange: (members: Member[]) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Dê um nome à pessoa.");
    setBusy(true);
    try {
      const m = await api<Member>("/api/members", { body: { name: name.trim() } });
      onChange([...members, m]);
      setName("");
      setError(null);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  function patch(m: Member, p: Partial<Pick<Member, "name" | "color">>) {
    onChange(members.map((x) => (x.id === m.id ? { ...x, ...p } : x)));
    api(`/api/members/${m.id}`, { method: "PATCH", body: p }).catch((err) => setError(errMsg(err)));
  }

  async function remove(m: Member) {
    if (!window.confirm(`Remover ${m.name}? As tabelas dessa pessoa passam a ser do conjunto; nenhum lançamento é apagado.`))
      return;
    try {
      await api(`/api/members/${m.id}`, { method: "DELETE" });
      onChange(members.filter((x) => x.id !== m.id));
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div className="space-y-3">
      {members.length > 0 && (
        <ul className="divide-y divide-grid border border-grid">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 px-2 py-1.5">
              <div className="flex gap-1" role="radiogroup" aria-label={`Cor de ${m.name}`}>
                {MEMBER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={m.color === c}
                    aria-label={c}
                    onClick={() => patch(m, { color: c })}
                    className={`h-5 w-5 border-2 ${m.color === c ? "border-ink" : "border-white"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <input
                className="field h-10 flex-1"
                defaultValue={m.name}
                maxLength={40}
                aria-label="Nome da pessoa"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== m.name) patch(m, { name: v });
                  else e.target.value = m.name;
                }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm h-10 w-10 px-0 text-expense"
                aria-label={`Remover ${m.name}`}
                onClick={() => remove(m)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2">
        <input
          className="field flex-1"
          placeholder={members.length ? "Nome de mais alguém" : "Ex.: Gustavo"}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn h-11" disabled={busy}>
          <Plus size={16} /> Adicionar
        </button>
      </form>
      {error && <p className="text-[15px] text-expense">{error}</p>}
    </div>
  );
}

export function MembersDialog({
  members,
  onChange,
  onClose,
}: {
  members: Member[];
  onChange: (members: Member[]) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Pessoas da casa" onClose={onClose}>
      <p className="mb-3 text-[15px] text-muted">
        Cadastre quem divide as contas (ex.: marido e esposa). Cada tabela pode ser de uma pessoa ou do
        conjunto, e o sistema calcula receitas, despesas e saldo de cada um.
      </p>
      <MembersEditor members={members} onChange={onChange} />
      <div className="mt-4 flex justify-end">
        <button className="btn btn-primary" onClick={onClose}>
          Pronto
        </button>
      </div>
    </Modal>
  );
}

/** Etiqueta com a cor e o nome do dono da tabela. */
export function MemberTag({ member }: { member: Member | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-medium text-muted">
      <span className="h-2 w-2" style={{ background: member?.color ?? "#6b7280" }} />
      {member?.name ?? "Conjunto"}
    </span>
  );
}
