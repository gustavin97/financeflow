"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { currentYm } from "@/lib/dates";

/** Leva para o mês atual (calculado no navegador, respeitando o fuso do usuário). */
export default function PlanilhaIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/planilha/${currentYm()}`);
  }, [router]);
  return <p className="p-6 text-[13px] text-muted">Abrindo o mês atual...</p>;
}
