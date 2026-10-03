import { readJson, route } from "@/lib/api";
import { deleteInstallment } from "@/lib/queries";
import { installmentDeleteSchema } from "@/lib/schemas";

type P = { id: string };

/** Encerra o parcelamento a partir de um mês (as parcelas anteriores ficam). */
export const DELETE = route<P>(async ({ req, user, params }) => {
  const { fromYm } = installmentDeleteSchema.parse(await readJson(req));
  deleteInstallment(user.id, params.id, fromYm);
  return { ok: true };
});
