import { NextRequest } from "next/server";
import { ApiError, handleError, json, readJson } from "@/lib/api";
import {
  clearLoginFailures,
  createSession,
  loginRateLimited,
  registerLoginFailure,
  verifyPassword,
} from "@/lib/auth";
import { findUserByEmail } from "@/lib/queries";
import { loginSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await readJson(req));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const key = `${ip}:${body.email}`;
    if (loginRateLimited(key))
      throw new ApiError("Muitas tentativas. Aguarde alguns minutos e tente de novo.", 429);

    const row = findUserByEmail(body.email);
    const ok = row ? await verifyPassword(body.password, row.password_hash) : false;
    if (!row || !ok) {
      registerLoginFailure(key);
      throw new ApiError("E-mail ou senha incorretos.", 401);
    }
    clearLoginFailures(key);
    await createSession(row.id);
    return json({ user: { id: row.id, name: row.name, email: row.email } });
  } catch (err) {
    return handleError(err);
  }
}
