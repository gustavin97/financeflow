import { readJson, route } from "@/lib/api";
import { completeBlock } from "@/lib/queries";
import { completeSchema } from "@/lib/schemas";

export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const { status } = completeSchema.parse(await readJson(req));
  await completeBlock(user.id, params.id, status);
  return { ok: true };
});
