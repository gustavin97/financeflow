import { readJson, route } from "@/lib/api";
import { deleteBlock, updateBlock } from "@/lib/queries";
import { blockPatchSchema } from "@/lib/schemas";

type P = { id: string };

export const PATCH = route<P>(async ({ req, user, params }) => {
  updateBlock(user.id, params.id, blockPatchSchema.parse(await readJson(req)));
  return { ok: true };
});

export const DELETE = route<P>(({ user, params }) => {
  deleteBlock(user.id, params.id);
  return { ok: true };
});
