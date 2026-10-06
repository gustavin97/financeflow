import { route } from "@/lib/api";
import { listImportRules } from "@/lib/queries";

export const GET = route(async ({ user }) => await listImportRules(user.id));
