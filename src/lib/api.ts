import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionUser } from "./auth";
import { ApiError } from "./errors";
import type { SessionUser } from "./types";

export { ApiError };

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

type Ctx<P> = { req: NextRequest; user: SessionUser; params: P };

/** Envolve um handler: exige sessão, resolve params e traduz erros em JSON. */
export function route<P = Record<string, string>>(
  handler: (ctx: Ctx<P>) => Promise<unknown> | unknown,
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      const user = await getSessionUser();
      if (!user) return json({ error: "Sessão expirada. Entre novamente." }, 401);
      const params = await context.params;
      const result = await handler({ req, user, params });
      return result instanceof Response ? result : json(result);
    } catch (err) {
      return handleError(err);
    }
  };
}

export function handleError(err: unknown) {
  if (err instanceof ApiError) return json({ error: err.message }, err.status);
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return json({ error: first?.message || "Dados inválidos." }, 400);
  }
  console.error(err);
  return json({ error: "Erro interno. Tente novamente." }, 500);
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError("Corpo da requisição inválido.");
  }
}
