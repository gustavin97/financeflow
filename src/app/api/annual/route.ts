import { ApiError, route } from "@/lib/api";
import { annual } from "@/lib/queries";

export const GET = route(async ({ req, user }) => {
  const year = Number(req.nextUrl.searchParams.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new ApiError("Ano inválido.");
  return await annual(user.id, year);
});
