"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errMsg } from "@/lib/client";

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
      <h2 className="text-[26px] font-semibold tracking-tight">Entrar</h2>
      <p className="mt-1.5 text-[14px] text-muted">Abra sua planilha e continue de onde parou.</p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="label">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="border border-expense/30 bg-red-50 px-3 py-2 text-[13px] text-expense">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-lg w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-[14px] text-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-brand hover:underline">
          Criar conta
        </Link>
      </p>
    </>
  );
}
