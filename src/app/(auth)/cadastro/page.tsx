import Link from "next/link";
import { signupOpen } from "@/lib/auth";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  if (signupOpen()) return <SignupForm />;
  return (
    <>
      <h2 className="text-[32px] font-semibold tracking-tight">Cadastro fechado</h2>
      <p className="mt-2 text-[17px] leading-relaxed text-muted">
        Este Finance Flow já está em uso. Se a conta é de vocês, é só entrar.
      </p>
      <Link href="/login" className="btn btn-primary mt-9 h-12 w-full text-[17px]">
        Entrar
      </Link>
    </>
  );
}
