import { json, readJson, route } from "@/lib/api";
import { createMember, listMembers } from "@/lib/queries";
import { memberCreateSchema } from "@/lib/schemas";

export const GET = route(({ user }) => listMembers(user.id));

export const POST = route(async ({ req, user }) => {
  const body = memberCreateSchema.parse(await readJson(req));
  return json(createMember(user.id, body), 201);
});
