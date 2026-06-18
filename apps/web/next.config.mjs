/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export → deployed to Cloudflare Workers Static Assets (free plan).
  // All dynamic logic lives in Supabase Edge Functions + client-side Supabase JS.
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@tutor/shared"],
};

export default nextConfig;
