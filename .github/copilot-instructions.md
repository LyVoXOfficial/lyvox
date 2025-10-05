# Copilot Instructions for Lyvox Codebase

## Overview
Lyvox is a multi-package monorepo for a Next.js-based marketplace. The main frontend lives in `lyvox-frontend/`, while the production app is in `lyvox/apps/web/`. The workspace uses pnpm, TurboRepo, and Supabase for backend auth/data.

## Architecture
- **Monorepo**: Two main roots: `lyvox-frontend/` (legacy/demo) and `lyvox/` (production, TurboRepo).
- **Production App**: `lyvox/apps/web/` is the main Next.js app. All new features go here.
- **Shared Config**: Root-level configs (`tsconfig.base.json`, `pnpm-workspace.yaml`, `turbo.json`) coordinate builds and types.
- **Supabase**: Used for authentication and data, integrated via `@supabase/auth-helpers-nextjs`.
- **i18n**: Locale-based routing and translation files in `lyvox-frontend/messages/` and `lyvox/apps/web/src/app/[locale]/`.

## Developer Workflows
- **Start Dev Server**: Use `pnpm dev` from the relevant package folder (e.g., `lyvox/apps/web/`).
- **Build**: Use `pnpm build` or TurboRepo commands for multi-package builds.
- **Test**: Frontend tests in `lyvox-frontend/src/components/__tests__/` (Jest). No backend tests found.
- **Lint**: Use `pnpm lint` (ESLint config in each package).
- **Seed Data**: Run scripts in `lyvox/scripts/` for DB seeding.

## Project Conventions
- **API Routes**: Next.js API routes in `lyvox/apps/web/src/app/api/` use top-level try/catch and always return JSON.
- **Error Handling**: Client code parses API responses with manual `JSON.parse` in try/catch to avoid crashes on non-JSON.
- **Auth**: Use Supabase server client via `@supabase/auth-helpers-nextjs` and Next.js cookies.
- **Components**: UI components in `lyvox/apps/web/src/components/` and `lyvox-frontend/src/components/`.
- **Translations**: Add new locales by updating translation files and `[locale]` folders.

## Integration Points
- **Supabase**: Credentials via env vars. Auth and data via Supabase client.
- **Twilio**: Used for phone verification in API routes.
- **TurboRepo**: For coordinated builds and caching across packages.

## Examples
- **API Route Pattern**:
  ```ts
  export async function POST(req: Request) {
    try {
      // ...logic...
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR', detail: String(e?.message || e) }, { status: 500 });
    }
  }
  ```
- **Client Response Parsing**:
  ```ts
  let j: any = null;
  const txt = await r.text();
  try { j = JSON.parse(txt); } catch { j = { ok: false, error: 'NON_JSON_RESPONSE', detail: txt.slice(0,200) }; }
  ```

## Key Files & Directories
- `lyvox/apps/web/src/app/` — Main Next.js app (pages, API, locales)
- `lyvox/apps/web/src/components/` — UI components
- `lyvox-frontend/messages/` — Translation files
- `lyvox/scripts/` — DB seed scripts
- `lyvox/tsconfig.base.json` — Shared TypeScript config
- `lyvox/pnpm-workspace.yaml` — Workspace packages
- `lyvox/turbo.json` — TurboRepo config

---
For questions about conventions or missing documentation, check the relevant README files or ask for clarification.
