"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/ui/PasswordField";
import { api, errMsg } from "@/lib/client";
import { AUTH_FIELD, AUTH_LABEL } from "../styles";

export function SignupForm() {
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
      <h2 className="text-[32px] font-semibold tracking-tight">Criar conta</h2>
      <p className="mt-2 text-[17px] leading-relaxed text-muted">Uma conta só para o casal. Leva um minuto.</p>

      <form onSubmit={submit} className="mt-9 space-y-5" noValidate>
        <div>
          <label htmlFor="name" className={AUTH_LABEL}>
            Seu nome
          </label>
          <input
            id="name"
            autoComplete="name"
            required
            autoFocus
            className={AUTH_FIELD}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="email" className={AUTH_LABEL}>
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className={AUTH_FIELD}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
        </div>
        <div>
          <label htmlFor="password" className={AUTH_LABEL}>
            Senha
          </label>
          <PasswordField
            id="password"
            autoComplete="new-password"
            minLength={8}
            className={`${AUTH_FIELD} pr-11`}
            value={password}
            onChange={setPassword}
          />
          <p className="mt-1.5 text-[14px] text-muted">Pelo menos 8 caracteres.</p>
        </div>
        <div>
          <label htmlFor="confirm" className={AUTH_LABEL}>
            Repetir senha
          </label>
          <PasswordField
            id="confirm"
            autoComplete="new-password"
            className={`${AUTH_FIELD} pr-11`}
            value={confirm}
            onChange={setConfirm}
          />
        </div>
        {error && (
          <p role="alert" className="border border-expense/30 bg-red-50 px-4 py-3 text-[15px] text-expense">
            {error}
          </p>
        )}
        <button className="btn btn-primary h-12 w-full text-[17px]" disabled={loading}>
          {loading ? "Criando conta..." : "Criar conta"}
        </button>
      </form>

      <p className="mt-7 text-[16px] text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Entrar
        </Link>
      </p>
      <p className="mt-3 text-[14px] text-muted">Depois de entrar, cadastrem quem é quem em “Pessoas”.</p>
    </>
  );
}
