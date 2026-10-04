import { ApiError, readJson, route } from "@/lib/api";
import { isYm } from "@/lib/dates";
import { dismissSurplus, saveSurplus, skipSurplus, undoSurplus } from "@/lib/queries";
import { surplusActionSchema } from "@/lib/schemas";

type P = { ym: string };

/** Sobra do mês `ym` (já fechado): guardar no cofrinho, pular, desfazer ou dispensar o aviso. */
export const POST = route<P>(async ({ req, user, params }) => {
  if (!isYm(params.ym)) throw new ApiError("Mês inválido.");
  const body = surplusActionSchema.parse(await readJson(req));
  if (body.action === "save") return saveSurplus(user.id, params.ym, { goalId: body.goalId, pct: body.pct });
  if (body.action === "skip") skipSurplus(user.id, params.ym);
  else if (body.action === "undo") undoSurplus(user.id, params.ym);
  else dismissSurplus(user.id, params.ym);
  return { ok: true };
});
