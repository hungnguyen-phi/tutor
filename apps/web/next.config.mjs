/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// Supabase origin the dev proxy forwards to. Same default as lib/config.ts so
// prod build and dev proxy always agree on the project.
const SUPABASE_ORIGIN =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://oonuzgnfoypibrssvmrt.supabase.co";

const nextConfig = {
  // Static export → deployed to Cloudflare Workers Static Assets (free plan).
  // All dynamic logic lives in Supabase Edge Functions + client-side Supabase JS.
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  // Dev-only concern: `trailingSlash` would 308-redirect `/__sb/…` (adding a
  // slash) and break the Supabase API paths proxied below. Disabling the auto
  // redirect fixes that. Harmless for the static export — Cloudflare serves
  // pre-generated files, it never does runtime trailing-slash redirects.
  skipTrailingSlashRedirect: true,
  images: { unoptimized: true },
  transpilePackages: ["@tutor/shared"],
  // Hai `next dev` cùng chạy trên một .next sẽ phá cache của nhau (dev chính +
  // preview của agent). Cho phép tách thư mục build qua biến môi trường.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // ── Dev-only same-origin Supabase proxy ─────────────────────────────────────
  // In dev the client (lib/config.ts) talks to `${window.origin}/__sb`, and
  // Next forwards that here to the real Supabase project. Because every call
  // (auth, edge functions, REST) is now SAME-ORIGIN, no CORS allowlist is ever
  // consulted — so the app just works on ANY localhost port or tunnel URL, with
  // no backend redeploy and no ALLOWED_ORIGINS maintenance. `beforeFiles` runs
  // ahead of routing so the proxy paths never touch page resolution. Ignored by
  // `next build` (output: export); the production bundle calls Supabase directly
  // against its whitelisted prod origin.
  ...(isDev && {
    async rewrites() {
      return {
        beforeFiles: [
          { source: "/__sb/:path*", destination: `${SUPABASE_ORIGIN}/:path*` },
        ],
      };
    },
  }),
  webpack: (config) => {
    // @tutor/shared viết import kiểu NodeNext ("./kg/types.js" trỏ file .ts) —
    // tsx/Node hiểu, webpack thì không. extensionAlias dạy webpack thử .ts/.tsx
    // trước khi tin đuôi .js — chuẩn cho monorepo TS ESM.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
