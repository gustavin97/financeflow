import { ApiError, readJson, route } from "@/lib/api";
import { isYm } from "@/lib/dates";
import { getMonth, initMonth } from "@/lib/queries";
import { startMonthSchema } from "@/lib/schemas";

type P = { ym: string };

export const GET = route<P>(({ user, params }) => {
  if (!isYm(params.ym)) throw new ApiError("Mês inválido.");
  return getMonth(user.id, params.ym);
});

export const POST = route<P>(async ({ req, user, params }) => {
  if (!isYm(params.ym)) throw new ApiError("Mês inválido.");
  const { mode } = startMonthSchema.parse(await readJson(req));
  initMonth(user.id, params.ym, mode);
  return getMonth(user.id, params.ym);
});
