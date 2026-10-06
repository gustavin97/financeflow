import { json, readJson, route } from "@/lib/api";
import { importStatement } from "@/lib/queries";
import { importSchema } from "@/lib/schemas";

export const POST = route(async ({ req, user }) =>
  json(await importStatement(user.id, importSchema.parse(await readJson(req))), 201),
);
