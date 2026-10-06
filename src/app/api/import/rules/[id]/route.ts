import { readJson, route } from "@/lib/api";
import { deleteImportRule, updateImportRule } from "@/lib/queries";
import { importRulePatchSchema } from "@/lib/schemas";

export const PATCH = route<{ id: string }>(async ({ req, user, params }) =>
  await updateImportRule(user.id, params.id, importRulePatchSchema.parse(await readJson(req)).pattern),
);

export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  await deleteImportRule(user.id, params.id);
  return { ok: true };
});
