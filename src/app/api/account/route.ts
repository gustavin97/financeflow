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

export const GET = route(async ({ user }) => ({
  autoMonth: await getAutoMonth(user.id),
  surplus: await getSurplusPrefs(user.id),
  email: { ...(await getEmailPrefs(user.id)), configured: mailConfigured() },
}));

export const PATCH = route(async ({ req, user }) => {
  const body = accountPatchSchema.parse(await readJson(req));
  if (body.name) await updateUserName(user.id, body.name);
  if (body.autoMonth) await setAutoMonth(user.id, body.autoMonth);
  await setEmailPrefs(user.id, { enabled: body.emailAlerts, hour: body.emailHour });
  await setSurplusPrefs(user.id, { mode: body.surplusMode, goalId: body.surplusGoal, pct: body.surplusPct });
  if (body.newPassword) {
    const row = await findUserById(user.id);
    if (!body.currentPassword || !row || !(await verifyPassword(body.currentPassword, row.password_hash)))
      throw new ApiError("A senha atual está incorreta.", 400);
    await updateUserPassword(user.id, await hashPassword(body.newPassword));
  }
  return { ok: true };
});

export const DELETE = route(async ({ req, user }) => {
  const body = accountDeleteSchema.parse(await readJson(req));
  const row = await findUserById(user.id);
  if (!row || !(await verifyPassword(body.password, row.password_hash)))
    throw new ApiError("Senha incorreta.", 400);
  await deleteUser(user.id);
  await destroySession();
  return json({ ok: true });
});
