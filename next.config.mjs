/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // NEXT_DIST_DIR permite um build de produção sem mexer no .next do "npm run dev"
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // build enxuto para produção (Docker): .next/standalone com só o necessário
  output: "standalone",
  // driver do Postgres: carregado do node_modules, sem passar pelo bundler
  serverExternalPackages: ["pg"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
