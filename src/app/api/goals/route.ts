import { json, readJson, route } from "@/lib/api";
import { createGoal, goalStats } from "@/lib/queries";
import { goalCreateSchema } from "@/lib/schemas";

export const GET = route(({ user }) => goalStats(user.id));

export const POST = route(async ({ req, user }) => {
  const body = goalCreateSchema.parse(await readJson(req));
  const id = createGoal(user.id, {
    name: body.name,
    targetAmount: body.targetAmount,
    targetMonth: body.targetMonth ?? null,
    color: body.color,
  });
  return json({ id }, 201);
});
