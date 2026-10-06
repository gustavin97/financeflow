import { json, readJson, route } from "@/lib/api";
import { createBlock } from "@/lib/queries";
import { blockCreateSchema } from "@/lib/schemas";

export const POST = route(async ({ req, user }) => {
  const body = blockCreateSchema.parse(await readJson(req));
  return json(await createBlock(user.id, body), 201);
});
