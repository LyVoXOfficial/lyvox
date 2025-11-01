/** @type {import('next').NextConfig} */
const nextConfig = {
  // eslint config moved to eslint.config.mjs (Next.js 16)
  // No longer supported in next.config.ts
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
};

export default nextConfig;


