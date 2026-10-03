import { NextRequest } from "next/server";
import { ApiError, handleError, json, readJson } from "@/lib/api";
import { createSession, hashPassword, signupOpen } from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/queries";
import { registerSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    if (!signupOpen()) throw new ApiError("O cadastro de novas contas está fechado.", 403);
    const body = registerSchema.parse(await readJson(req));
    if (findUserByEmail(body.email)) throw new ApiError("Este e-mail já está cadastrado.", 409);
    const user = createUser(body.name, body.email, await hashPassword(body.password));
    await createSession(user.id);
    return json({ user }, 201);
  } catch (err) {
    return handleError(err);
  }
}
