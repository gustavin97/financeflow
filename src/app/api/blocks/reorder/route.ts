import { readJson, route } from "@/lib/api";
import { reorderBlocks } from "@/lib/queries";
import { reorderSchema } from "@/lib/schemas";

export const POST = route(async ({ req, user }) => {
  const { ym, ids } = reorderSchema.parse(await readJson(req));
  reorderBlocks(user.id, ym, ids);
  return { ok: true };
});
