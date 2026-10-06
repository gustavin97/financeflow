import { json, readJson, route } from "@/lib/api";
import { createInstallment } from "@/lib/queries";
import { installmentCreateSchema } from "@/lib/schemas";

export const POST = route(async ({ req, user }) =>
  json(await createInstallment(user.id, installmentCreateSchema.parse(await readJson(req))), 201),
);
