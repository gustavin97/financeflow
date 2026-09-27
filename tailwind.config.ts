import type { Config } from "tailwindcss";

/**
 * Finance Flow - tokens visuais.
 * Estética "planilha": fundo cinza-claro de bancada, folhas brancas,
 * linhas de grade finas e cantos praticamente retos (máx. 3px).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    borderRadius: {
      none: "0",
      sm: "1px",
      DEFAULT: "2px",
      md: "2px",
      lg: "3px",
      xl: "3px",
      "2xl": "3px",
      full: "9999px",
    },
    extend: {
      colors: {
        ink: "#1c2024",
        muted: "#5f6b76",
        faint: "#8a949e",
        grid: "#d3d8de",
        head: "#f1f3f5",
        bench: "#eceff2",
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
        sheet: "0 1px 0 rgba(28,32,36,0.04), 0 1px 3px rgba(28,32,36,0.06)",
        pop: "0 8px 24px rgba(28,32,36,0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
