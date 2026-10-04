import { ApiError, readJson, route } from "@/lib/api";
import { currentYmIn, isYm } from "@/lib/dates";
import { APP_TIMEZONE, autoSaveSurplus, autoStartMonth, dismissAutoNotice, getMonth, initMonth } from "@/lib/queries";
import { monthPatchSchema, startMonthSchema } from "@/lib/schemas";

type P = { ym: string };

export const GET = route<P>(({ user, params }) => {
  if (!isYm(params.ym)) throw new ApiError("Mês inválido.");
  // a aba pode ter ficado aberta na virada do mês
  if (params.ym === currentYmIn(APP_TIMEZONE)) {
    autoStartMonth(user.id, params.ym);
    autoSaveSurplus(user.id, params.ym);
  }
  return getMonth(user.id, params.ym);
});

export const POST = route<P>(async ({ req, user, params }) => {
  if (!isYm(params.ym)) throw new ApiError("Mês inválido.");
  const { mode } = startMonthSchema.parse(await readJson(req));
  initMonth(user.id, params.ym, mode);
  return getMonth(user.id, params.ym);
});

/** Dispensa o aviso de "mês aberto sozinho". */
export const PATCH = route<P>(async ({ req, user, params }) => {
  if (!isYm(params.ym)) throw new ApiError("Mês inválido.");
  const { dismissAuto } = monthPatchSchema.parse(await readJson(req));
  if (dismissAuto) dismissAutoNotice(user.id, params.ym);
  return { ok: true };
});
