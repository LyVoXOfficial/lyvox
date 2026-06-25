// Content-Security-Policy shipped in Report-Only mode first: it does NOT block
// anything, it only reports violations, so it is safe to enable while the
// allowlist is validated against real traffic. Allowlist covers Next.js
// (inline/eval needed without nonces), Supabase (REST + realtime websockets),
// Stripe (checkout/elements), and Upstash. Once the browser console shows no
// legitimate violations, promote the header key to `Content-Security-Policy`.
// See docs/SECURITY_AUDIT.md (M3).
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.upstash.io",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // eslint config moved to eslint.config.mjs (Next.js 16)
  // No longer supported in next.config.ts
  typescript: {
    // The project currently type-checks cleanly under `strict: true`
    // (`pnpm typecheck` = 0 errors) and CI gates on it, so the build enforces
    // types too. If a future change needs to ship despite type errors, prefer
    // fixing them; only flip this back as a temporary, tracked exception.
    ignoreBuildErrors: false,
  },
  images: {
    // PERF-002: Image optimization configuration
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // SEC: Baseline security headers applied to every response.
        // See docs/SECURITY_AUDIT.md (M1, M3).
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Confirmed via code audit that the app uses none of camera/
          // microphone/geolocation; WebAuthn (publickey-credentials-*) keeps its
          // default `self` allowlist because it is intentionally not listed.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Report-Only: observe before enforcing. Promote to
          // `Content-Security-Policy` once violations are clean.
          {
            key: 'Content-Security-Policy-Report-Only',
            value: contentSecurityPolicy,
          },
        ],
      },
      // NOTE: The previous blanket `Cache-Control: public, max-age=3600` on
      // `/:path*` was removed. It marked EVERY response cacheable by shared
      // caches/CDNs, including authenticated pages (e.g. /profile) and API JSON,
      // which risks leaking private data across users. Public pages should opt
      // into caching individually via route segment config (e.g.
      // `export const revalidate = 3600`). Immutable static assets stay cached
      // below.
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;


