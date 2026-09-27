import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Finance Flow", template: "%s · Finance Flow" },
  description:
    "Controle financeiro do casal em tabelas conectadas: salários, contas da casa, cartão, economias, painel com gráficos e avisos antes do vermelho.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
