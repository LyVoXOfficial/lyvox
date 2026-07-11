// SEC-CSP: the Content-Security-Policy is generated per-request in
// `src/middleware.ts` (nonce + 'strict-dynamic', no 'unsafe-inline'/'unsafe-eval')
// via `src/lib/security/csp.ts`. It MUST NOT also be emitted here — two
// `Content-Security-Policy` sources make the browser intersect them and break
// the app. The static (non-nonce) security headers stay below.
import withBundleAnalyzerInit from "@next/bundle-analyzer";
import type { NextConfig } from "next";

// PERF-06: `pnpm analyze` (ANALYZE=true) opens the client/server bundle
// treemaps. Gated behind the env var so normal builds/deploys never pay the
// analyzer's report-generation cost.
const withBundleAnalyzer = withBundleAnalyzerInit({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // eslint config moved to eslint.config.mjs (Next.js 16)
  // No longer supported in next.config.ts
  typescript: {
    // The project currently type-checks cleanly under `strict: true`
    // (`pnpm typecheck` = 0 errors) and CI gates on it, so the build enforces
    // types too. If a future change needs to ship despite type errors, prefer
    // fixing them; only flip this back as a temporary, tracked exception.
    // PERF-06 exception: `pnpm analyze` forces `--webpack` (Turbopack has no
    // bundle-analyzer report) and Next 16's webpack build generates a
    // slightly different `.next/types` PageProps shape than the Turbopack
    // build every other command uses, which fails typecheck on a page
    // unrelated to whatever is being analyzed. Real (Turbopack) builds and CI
    // are unaffected — only this manual, non-deploy tool loosens the gate.
    ignoreBuildErrors: process.env.ANALYZE === "true",
  },
  // SEC-UPLOAD: `sharp` (native libvips binary) is used server-side in
  // /api/media/complete to sanitise uploads. Keep it external so the bundler
  // never tries to inline the platform-specific .node addon.
  serverExternalPackages: ["sharp"],
  images: {
    // PERF-002: Image optimization configuration
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/sign/**',
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
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // DENY aligns with CSP frame-ancestors 'none' (audit A-6) — the app
          // never frames itself, so the stricter legacy header is safe.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Confirmed via code audit that the app uses none of camera/
          // microphone/geolocation; WebAuthn (publickey-credentials-*) keeps its
          // default `self` allowlist because it is intentionally not listed.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // NOTE: Content-Security-Policy is intentionally NOT set here — it is
          // emitted per-request (with a nonce) from src/proxy.ts. See the
          // comment at the top of this file (SEC-CSP).
        ],
      },
      // NOTE: The previous blanket `Cache-Control: public, max-age=3600` on
      // `/:path*` was removed. It marked EVERY response cacheable by shared
      // caches/CDNs, including authenticated pages (e.g. /profile) and API JSON,
      // which risks leaking private data across users. Public pages should opt
      // into caching individually via route segment config (e.g.
      // `export const revalidate = 3600`). Next.js owns immutable caching for
      // its hashed `/_next/static` assets.
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

export default withBundleAnalyzer(nextConfig);

