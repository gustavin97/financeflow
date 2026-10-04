import { readJson, route } from "@/lib/api";
import { importPreview } from "@/lib/queries";
import { importPreviewSchema } from "@/lib/schemas";

export const POST = route(async ({ req, user }) => {
  const { ym, keys } = importPreviewSchema.parse(await readJson(req));
  return importPreview(user.id, ym, keys);
});
