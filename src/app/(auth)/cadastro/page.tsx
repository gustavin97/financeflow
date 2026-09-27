"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/ui/PasswordField";
import { api, errMsg } from "@/lib/client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("As senhas não são iguais.");
      return;
    }
    setLoading(true);
    try {
      await api("/api/auth/register", { body: { name, email, password } });
      router.replace("/planilha");
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="text-[26px] font-semibold tracking-tight">Criar conta</h2>
      <p className="mt-1.5 text-[14px] text-muted">
        Leva menos de um minuto. Uma conta serve para o casal: depois vocês cadastram quem é quem.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <div>
          <label htmlFor="name" className="label">
            Seu nome
          </label>
          <input
            id="name"
            autoComplete="name"
            required
            autoFocus
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="email" className="label">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="label">
              Senha
            </label>
            <PasswordField id="password" autoComplete="new-password" minLength={8} value={password} onChange={setPassword} />
          </div>
          <div>
            <label htmlFor="confirm" className="label">
              Repetir senha
            </label>
            <PasswordField id="confirm" autoComplete="new-password" value={confirm} onChange={setConfirm} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted">Use pelo menos 8 caracteres.</p>
        {error && (
          <p role="alert" className="border border-expense/30 bg-red-50 px-3 py-2 text-[13px] text-expense">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-lg w-full" disabled={loading}>
          {loading ? "Criando conta..." : "Criar conta"}
        </button>
      </form>

      <p className="mt-6 text-[14px] text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
