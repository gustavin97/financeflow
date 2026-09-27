import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Finance Flow", template: "%s · Finance Flow" },
  description:
    "Controle financeiro pessoal em tabelas conectadas: salário, contas, cartão, lazer e cofrinho no mesmo lugar.",
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
