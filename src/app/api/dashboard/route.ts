import { ApiError, route } from "@/lib/api";
import { isYm } from "@/lib/dates";
import { dashboard } from "@/lib/queries";

export const GET = route(({ req, user }) => {
  const ym = req.nextUrl.searchParams.get("ym");
  if (!isYm(ym)) throw new ApiError("Mês inválido.");
  return dashboard(user.id, ym);
});
