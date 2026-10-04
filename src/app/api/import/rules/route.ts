import { route } from "@/lib/api";
import { listImportRules } from "@/lib/queries";

export const GET = route(({ user }) => listImportRules(user.id));
