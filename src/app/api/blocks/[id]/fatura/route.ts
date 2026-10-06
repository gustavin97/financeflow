import { readJson, route } from "@/lib/api";
import { moveToFatura } from "@/lib/queries";
import { faturaMoveSchema } from "@/lib/schemas";

/** Move as compras do cartão que são de outra fatura para o mês certo. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const { entryIds } = faturaMoveSchema.parse(await readJson(req));
  return await moveToFatura(user.id, params.id, entryIds);
});
