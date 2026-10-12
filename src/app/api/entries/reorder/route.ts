import { readJson, route } from "@/lib/api";
import { reorderEntries } from "@/lib/queries";
import { entryReorderSchema } from "@/lib/schemas";

export const POST = route(async ({ req, user }) => {
  const { blockId, ids } = entryReorderSchema.parse(await readJson(req));
  await reorderEntries(user.id, blockId, ids);
  return { ok: true };
});
