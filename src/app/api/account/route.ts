import { ApiError, json, readJson, route } from "@/lib/api";
import { destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import {
  deleteUser,
  findUserById,
  getAutoMonth,
  getEmailPrefs,
  getSurplusPrefs,
  setAutoMonth,
  setEmailPrefs,
  setSurplusPrefs,
  updateUserName,
  updateUserPassword,
} from "@/lib/queries";
import { mailConfigured } from "@/lib/mailer";
import { accountDeleteSchema, accountPatchSchema } from "@/lib/schemas";

export const GET = route(({ user }) => ({
  autoMonth: getAutoMonth(user.id),
  surplus: getSurplusPrefs(user.id),
  email: { ...getEmailPrefs(user.id), configured: mailConfigured() },
}));

export const PATCH = route(async ({ req, user }) => {
  const body = accountPatchSchema.parse(await readJson(req));
  if (body.name) updateUserName(user.id, body.name);
  if (body.autoMonth) setAutoMonth(user.id, body.autoMonth);
  setEmailPrefs(user.id, { enabled: body.emailAlerts, hour: body.emailHour });
  setSurplusPrefs(user.id, { mode: body.surplusMode, goalId: body.surplusGoal, pct: body.surplusPct });
  if (body.newPassword) {
    const row = findUserById(user.id);
    if (!body.currentPassword || !row || !(await verifyPassword(body.currentPassword, row.password_hash)))
      throw new ApiError("A senha atual está incorreta.", 400);
    updateUserPassword(user.id, await hashPassword(body.newPassword));
  }
  return { ok: true };
});

export const DELETE = route(async ({ req, user }) => {
  const body = accountDeleteSchema.parse(await readJson(req));
  const row = findUserById(user.id);
  if (!row || !(await verifyPassword(body.password, row.password_hash)))
    throw new ApiError("Senha incorreta.", 400);
  deleteUser(user.id);
  await destroySession();
  return json({ ok: true });
});
