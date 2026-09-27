import { route } from "@/lib/api";
import { exportAll } from "@/lib/queries";

export const GET = route(({ user }) => {
  const data = exportAll(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="finance-flow-dados.json"',
    },
  });
});
