import { readJson, route } from "@/lib/api";
import { deleteMember, updateMember } from "@/lib/queries";
import { memberPatchSchema } from "@/lib/schemas";

type P = { id: string };

export const PATCH = route<P>(async ({ req, user, params }) => {
  updateMember(user.id, params.id, memberPatchSchema.parse(await readJson(req)));
  return { ok: true };
});

export const DELETE = route<P>(({ user, params }) => {
  deleteMember(user.id, params.id);
  return { ok: true };
});
