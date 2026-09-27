import { json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ error: "Não autenticado." }, 401);
  return json({ user });
}
