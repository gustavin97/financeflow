import { readJson, route } from "@/lib/api";
import { deleteGoal, updateGoal } from "@/lib/queries";
import { goalPatchSchema } from "@/lib/schemas";

type P = { id: string };

export const PATCH = route<P>(async ({ req, user, params }) => {
  updateGoal(user.id, params.id, goalPatchSchema.parse(await readJson(req)));
  return { ok: true };
});

export const DELETE = route<P>(({ user, params }) => {
  deleteGoal(user.id, params.id);
  return { ok: true };
});
