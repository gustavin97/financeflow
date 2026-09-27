"use client";

export class ClientApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Init = { method?: string; body?: unknown };

/** fetch com JSON, tratamento de erro e redirecionamento quando a sessão expira. */
export async function api<T = unknown>(url: string, init: Init = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(url, {
    method: init.method ?? (hasBody ? "POST" : "GET"),
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const onAuthPage = /^\/(login|cadastro)/.test(window.location.pathname);
    if (res.status === 401 && !onAuthPage) {
      window.location.href = "/login";
    }
    throw new ClientApiError(data?.error ?? "Algo deu errado. Tente novamente.", res.status);
  }
  return data as T;
}

export const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : "Algo deu errado. Tente novamente.";

export const newColumnId = () => "c_" + Math.random().toString(36).slice(2, 8);
