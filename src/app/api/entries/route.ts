import { json, readJson, route } from "@/lib/api";
import { createEntry } from "@/lib/queries";
import { entryCreateSchema } from "@/lib/schemas";

export const POST = route(async ({ req, user }) => {
  const { blockId, ...init } = entryCreateSchema.parse(await readJson(req));
  return json(createEntry(user.id, blockId, init), 201);
});
