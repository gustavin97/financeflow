import { redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { getSessionUser } from "@/lib/auth";
import { currentYmIn } from "@/lib/dates";
import { APP_TIMEZONE, autoSaveSurplus, autoStartMonth } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // virou o mês: abre o novo antes de qualquer página (painel e anual também o veem)
  const ym = currentYmIn(APP_TIMEZONE);
  try {
    autoStartMonth(user.id, ym);
  } catch (err) {
    // é uma conveniência: se falhar, a pessoa ainda escolhe como começar o mês
    console.error("Falha ao abrir o mês sozinho:", err);
  }
  try {
    autoSaveSurplus(user.id, ym);
  } catch (err) {
    console.error("Falha ao guardar a sobra do mês:", err);
  }
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav user={user} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
