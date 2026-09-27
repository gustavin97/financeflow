import { readJson, route } from "@/lib/api";
import { deleteEntry, updateEntry } from "@/lib/queries";
import { entryPatchSchema } from "@/lib/schemas";

type P = { id: string };

export const PATCH = route<P>(async ({ req, user, params }) => {
  updateEntry(user.id, params.id, entryPatchSchema.parse(await readJson(req)));
  return { ok: true };
});

export const DELETE = route<P>(({ user, params }) => {
  deleteEntry(user.id, params.id);
  return { ok: true };
});
