"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/ui/PasswordField";
import { api, errMsg } from "@/lib/client";
import { AUTH_FIELD, AUTH_LABEL } from "../styles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/login", { body: { email, password } });
      router.replace("/planilha");
      router.refresh();
    } catch (err) {
      setError(errMsg(err));
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="text-[32px] font-semibold tracking-tight">Olá de novo</h2>
      <p className="mt-2 text-[17px] leading-relaxed text-muted">Entre para abrir a planilha da casa.</p>

      <form onSubmit={submit} className="mt-9 space-y-5" noValidate>
        <div>
          <label htmlFor="email" className={AUTH_LABEL}>
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
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
            autoComplete="current-password"
            className={`${AUTH_FIELD} pr-11`}
            value={password}
            onChange={setPassword}
          />
        </div>
        {error && (
          <p role="alert" className="border border-expense/30 bg-red-50 px-4 py-3 text-[15px] text-expense">
            {error}
          </p>
        )}
        <button className="btn btn-primary h-12 w-full text-[17px]" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="mt-7 text-[16px] text-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-brand hover:underline">
          Criar conta
        </Link>
      </p>
    </>
  );
}
