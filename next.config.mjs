/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Customer-facing host only. No CRM code lives here.
  poweredByHeader: false,
  // Native module: keep it out of the webpack bundle (loaded at runtime).
  experimental: { serverComponentsExternalPackages: ['@napi-rs/canvas'] },
};

export default nextConfig;
