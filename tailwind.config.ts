import type { Config } from "tailwindcss";

/**
 * Finance Flow - tokens visuais.
 * Estética "planilha": fundo cinza-claro de bancada, folhas brancas com
 * cantos suaves e linhas de grade finas e discretas dentro das tabelas.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    borderRadius: {
      none: "0",
      sm: "4px",
      DEFAULT: "6px",
      md: "8px",
      lg: "10px",
      xl: "12px",
      "2xl": "16px",
      full: "9999px",
    },
    extend: {
      colors: {
        ink: "#1c2024",
        muted: "#5f6b76",
        faint: "#8a949e",
        grid: "#e2e6eb",
        line: "#dfe4ea",
        head: "#f4f6f8",
        bench: "#f1f4f7",
        brand: {
          DEFAULT: "#107c41",
          dark: "#0b5f31",
          soft: "#e7f3ec",
        },
        income: "#107c41",
        expense: "#c4361f",
        savings: "#1d5fbf",
      },
      fontFamily: {
        sans: [
          "Aptos",
          "Segoe UI",
          "Calibri",
          "Helvetica Neue",
          "Arial",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        sheet: "0 1px 2px rgba(16,24,40,0.04), 0 2px 6px rgba(16,24,40,0.04)",
        lift: "0 2px 4px rgba(16,24,40,0.06), 0 10px 24px rgba(16,24,40,0.08)",
        pop: "0 4px 8px rgba(16,24,40,0.06), 0 16px 36px rgba(16,24,40,0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
