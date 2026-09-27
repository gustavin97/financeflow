import { NextRequest } from "next/server";
import { ApiError, handleError, json, readJson } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/queries";
import { registerSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = registerSchema.parse(await readJson(req));
    if (findUserByEmail(body.email)) throw new ApiError("Este e-mail já está cadastrado.", 409);
    const user = createUser(body.name, body.email, await hashPassword(body.password));
    await createSession(user.id);
    return json({ user }, 201);
  } catch (err) {
    return handleError(err);
  }
}
