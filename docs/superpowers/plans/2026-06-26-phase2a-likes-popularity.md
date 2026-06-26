# Phase 2a — Likes & Popularity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public "like" 👍 signal (distinct from the private favorite ❤️) — a new `advert_likes` table + `/api/likes` API + `LikeToggle` on cards and the detail page + a like count — and switch the popularity ranking to `views·0.3 + likes·3 + favorites·5`.

**Architecture:** Likes **mirror the existing favorites feature** almost exactly: same table shape, same RLS (public-read so counts are queryable), same `/api/likes` (POST + DELETE) auth-only routes, a `LikesProvider`/`useLikes`/`LikeToggle` that mirror `FavoritesProvider`/`useFavorites`/`FavoriteToggle`. The public like **count** is resolved server-side: a shared `resolveLikeCounts(ids)` batch counter attaches `like_count` to `/api/search` items (mirroring the Phase-1 `resolveFirstImages` image attach) and feeds the updated `/api/top-adverts` formula. Likes are the **Auth tier** — they require an account but NOT phone verification; the anonymous case reuses the existing favorites "redirect to login on 401" pattern (the Trust Gate modal arrives in Phase 2b).

**Tech Stack:** Next.js 16 (App Router, `runtime=nodejs` routes), React 19, Supabase (Postgres + RLS + SQL functions), Zod, Vitest (jsdom), Tailwind v4 + shadcn UI, sonner toasts, custom `useI18n()` i18n.

## Global Constraints

- **Next.js pinned at `16.0.11`** — never downgrade (Vercel blocks vulnerable Next). See `memory/deploy-pipeline.md`.
- **Likes are the Auth tier** (account required; phone verification NOT required). `/api/likes` enforces auth (401 otherwise); no phone-verified check.
- **Every user-facing string localized in all 5 locales** (`apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`); `node scripts/check-i18n-keys.js` MUST pass. Add keys in the same task that introduces the UI.
- **API envelope:** `createSuccessResponse(data)` → `{ ok:true, data }`; `createErrorResponse(code,{status,detail})` → `{ ok:false, error, detail }` (from `@/lib/apiErrors`). Clients read `body.data.*` (NOT `body.*`) — see `memory/api-envelope.md`.
- **DB changes applied surgically via `pg` + `SUPABASE_DB_URL`** (load it from `.env.local`: `export SUPABASE_DB_URL="$(grep -E '^SUPABASE_DB_URL=' .env.local | head -1 | cut -d= -f2- | tr -d '"')"`), transactional, test-call-gated, idempotent. NEVER `supabase db push`. Commit the `.sql` file. Never stage `.env*`.
- **Mirror favorites, do not reinvent.** The favorites equivalents are the reference implementation: table `supabase/migrations/20251108110000_favorites.sql`; routes `apps/web/src/app/api/favorites/route.ts` + `apps/web/src/app/api/favorites/[advertId]/route.ts`; client `apps/web/src/components/favorites/{FavoritesProvider,FavoriteToggle}.tsx`. Read the favorites version before writing each likes equivalent.
- **Tests:** Vitest jsdom. Single file: `npx vitest run <path>`. Mock Supabase with `vi.mock("@/lib/supabaseServer")`; mock rate-limiting with `vi.mock("@/lib/rateLimiter", () => ({ createRateLimiter: () => async () => ({success:true}), withRateLimit: (h) => h }))`.
- **i18n in client components:** `const { t } = useI18n()` from `@/i18n`; dot-notation keys; `tr(k, fb)` fallback helper.
- **Toasts:** `import { toast } from "sonner"`.
- **Verification is on production** (www.lyvox.be). Gate each push on `tsc` + `pnpm build` + i18n PASS + `pnpm test`, then curl-verify.
- **Commits** end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; never stage `.claude/`.

**Reference shapes (used across tasks):**

```typescript
// /api/search item AFTER Task 5 (snake_case; image from Phase 1, like_count NEW):
type SearchApiItem = {
  id: string; title: string;
  price?: number | null; currency?: string | null; location?: string | null;
  image?: string | null;
  like_count?: number | null;        // NEW in Task 5
  created_at?: string | null; seller_verified?: boolean | null;
};
// AdvertCard (consumed by AdCard / AdsGrid) AFTER Task 6:
type AdvertCard = {
  id: string; title: string;
  price: number | null; currency: string | null; location: string | null;
  image: string | null;
  likeCount: number;                 // NEW in Task 6 (default 0)
  createdAt: string | null; sellerVerified: boolean;
};
```

---

### Task 1: `advert_likes` table + RLS + count function (migration)

**Files:**
- Create: `supabase/migrations/20260626130000_advert_likes.sql`

**Interfaces:**
- Produces: table `public.advert_likes(user_id, advert_id, created_at, pk(user_id,advert_id))`; RLS `user_manage_own_likes` + `public_read_likes`; SQL fn `public.get_advert_like_count(advert_id_param uuid) returns bigint`.

- [ ] **Step 1: Write the migration** (mirrors `supabase/migrations/20251108110000_favorites.sql` + the favorites count fn)

```sql
-- Likes: a public popularity signal, mirroring the favorites table.
-- Idempotent; applied surgically via pg.

create table if not exists public.advert_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  advert_id uuid not null references public.adverts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, advert_id)
);

create index if not exists advert_likes_user_id_idx on public.advert_likes(user_id, created_at desc);
create index if not exists advert_likes_advert_id_idx on public.advert_likes(advert_id);

alter table public.advert_likes enable row level security;

drop policy if exists user_manage_own_likes on public.advert_likes;
create policy user_manage_own_likes on public.advert_likes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists public_read_likes on public.advert_likes;
create policy public_read_likes on public.advert_likes
  for select
  using (true);

create or replace function public.get_advert_like_count(advert_id_param uuid)
returns bigint
language sql
stable
as $$
  select count(*) from public.advert_likes where advert_id = advert_id_param;
$$;
```

- [ ] **Step 2: Apply surgically via pg with a transactional test-call gate**

```bash
cd "$(git rev-parse --show-toplevel)"
export SUPABASE_DB_URL="$(grep -E '^SUPABASE_DB_URL=' .env.local | head -1 | cut -d= -f2- | tr -d '"')"
[ -n "$SUPABASE_DB_URL" ] || { echo "NO DB URL"; exit 1; }
node -e '
const { Client } = require("pg"); const fs = require("fs");
const sql = fs.readFileSync("supabase/migrations/20260626130000_advert_likes.sql","utf8");
(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await c.connect();
  try {
    await c.query("begin");
    await c.query(sql);
    await c.query("select public.get_advert_like_count($1)", ["00000000-0000-0000-0000-000000000000"]);
    await c.query("select * from public.advert_likes limit 0");
    await c.query("commit");
    console.log("OK: advert_likes applied");
  } catch (e) { await c.query("rollback"); console.error("ROLLED BACK:", e.message); process.exit(1); }
  finally { await c.end(); }
})();
'
```
Expected: `OK: advert_likes applied`. If `ROLLED BACK`, fix the SQL and re-run (nothing persisted).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260626130000_advert_likes.sql
git commit -m "feat(likes): advert_likes table + RLS + get_advert_like_count

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `/api/likes` POST + DELETE + GET (mirror `/api/favorites`)

**Files:**
- Create: `apps/web/src/app/api/likes/route.ts` (GET + POST)
- Create: `apps/web/src/app/api/likes/[advertId]/route.ts` (DELETE)
- Test: `apps/web/src/app/api/likes/__tests__/likes-route.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/likes?limit=200` → `{ ok, data: { items: { advert_id: string }[], total, authenticated } }` (the caller's liked advert ids; `{ items: [], authenticated: false }` when not signed in).
  - `POST /api/likes {advert_id}` → 201 `{ ok, data: { advert_id } }`; idempotent on `23505`; **401** if not signed in; 404 if advert missing; 400 if inactive.
  - `DELETE /api/likes/{advertId}` → `{ ok, data: { advert_id } }`; 401 if not signed in; 404 if not liked.

- [ ] **Step 1: Read the favorites routes** (the template)

Read `apps/web/src/app/api/favorites/route.ts` and `apps/web/src/app/api/favorites/[advertId]/route.ts` in full. The likes routes are the same with `favorites` → `advert_likes` and a simpler GET (return only `advert_id`s, no advert join/media). Reuse the local `getRequestContext`/`resolveUserId`/`buildRateLimitKey` helper pattern verbatim and the `createRateLimiter`/`withRateLimit` wrappers (GET 60/60s, POST 30/60s, DELETE 30/60s).

- [ ] **Step 2: Write the failing test**

```typescript
// apps/web/src/app/api/likes/__tests__/likes-route.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));
vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true, limit: 30, remaining: 29, reset: 0, retryAfterSec: 0 }),
  withRateLimit: (handler: unknown) => handler,
}));

const { POST } = await import("../route");

function jsonReq(body: unknown) {
  return new Request("https://x.test/api/likes", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("POST /api/likes", () => {
  beforeEach(() => { getUserMock.mockReset(); fromMock.mockReset(); });

  it("401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(jsonReq({ advert_id: "11111111-1111-1111-1111-111111111111" }));
    expect(res.status).toBe(401);
  });

  it("inserts a like for an active advert (201)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "adverts") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "adv-1", status: "active" }, error: null }) }) }),
      };
      if (table === "advert_likes") return { insert: async () => ({ error: null }) };
      throw new Error("unexpected table " + table);
    });
    const res = await POST(jsonReq({ advert_id: "11111111-1111-1111-1111-111111111111" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("is idempotent on duplicate (23505 → ok)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "adverts") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "adv-1", status: "active" }, error: null }) }) }),
      };
      if (table === "advert_likes") return { insert: async () => ({ error: { code: "23505" } }) };
      throw new Error("unexpected table " + table);
    });
    const res = await POST(jsonReq({ advert_id: "11111111-1111-1111-1111-111111111111" }));
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run apps/web/src/app/api/likes/__tests__/likes-route.test.ts`
Expected: FAIL — `Cannot find module "../route"`.

- [ ] **Step 4: Write the routes** (mirror favorites; the POST handler below — GET returns the caller's liked ids; DELETE mirrors favorites' `[advertId]` route)

```typescript
// apps/web/src/app/api/likes/route.ts
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { createErrorResponse, createSuccessResponse, handleSupabaseError, ApiErrorCode } from "@/lib/apiErrors";

export const runtime = "nodejs";

type SupabaseServerClient = SupabaseClient;
type SupabaseUser = Awaited<ReturnType<SupabaseServerClient["auth"]["getUser"]>>["data"]["user"];

const contextCache = new WeakMap<Request, Promise<{ supabase: SupabaseServerClient; user: SupabaseUser }>>();
const getRequestContext = async (req: Request) => {
  let cached = contextCache.get(req);
  if (!cached) {
    cached = (async () => {
      const supabase = await supabaseServer();
      const { data: { user } } = await supabase.auth.getUser();
      return { supabase, user: user ?? null };
    })();
    contextCache.set(req, cached);
  }
  return cached;
};
const resolveUserId = (req: Request) => getRequestContext(req).then(({ user }) => user?.id ?? null);
const buildRateLimitKey = (_req: Request, userId: string | null, ip: string | null) => userId ?? ip ?? "anonymous";

const likesGetLimiter = createRateLimiter({ limit: 60, windowSec: 60, prefix: "likes:get" });
const likesPostLimiter = createRateLimiter({ limit: 30, windowSec: 60, prefix: "likes:post" });

const addLikeSchema = z.object({ advert_id: z.string().uuid() });

async function getLikes(request: Request) {
  const { supabase, user } = await getRequestContext(request);
  if (!user) {
    return createSuccessResponse({ items: [], total: 0, authenticated: false });
  }
  const { data, error } = await supabase
    .from("advert_likes")
    .select("advert_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  return createSuccessResponse({ items: data ?? [], total: data?.length ?? 0, authenticated: true });
}

async function addLike(request: Request) {
  const { supabase, user } = await getRequestContext(request);
  if (!user) return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401, detail: "Authentication required" });

  let body: unknown;
  try { body = await request.json(); }
  catch { return createErrorResponse(ApiErrorCode.INVALID_JSON, { status: 400, detail: "Invalid JSON body" }); }

  const parsed = addLikeSchema.safeParse(body);
  if (!parsed.success) return createErrorResponse(ApiErrorCode.BAD_INPUT, { status: 400, detail: parsed.error.issues[0]?.message ?? "Validation failed" });
  const { advert_id } = parsed.data;

  const { data: advert, error: advertError } = await supabase.from("adverts").select("id, status").eq("id", advert_id).maybeSingle();
  if (advertError || !advert) return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404, detail: "Advert not found" });
  if (advert.status !== "active") return createErrorResponse(ApiErrorCode.BAD_INPUT, { status: 400, detail: "Cannot like inactive advert" });

  const { error: insertError } = await supabase.from("advert_likes").insert({ user_id: user.id, advert_id });
  if (insertError) {
    if (insertError.code === "23505") return createSuccessResponse({ advert_id });
    return handleSupabaseError(insertError, ApiErrorCode.INTERNAL_ERROR);
  }
  return createSuccessResponse({ advert_id }, 201);
}

export const GET = withRateLimit(getLikes, { limiter: likesGetLimiter, getUserId: resolveUserId, makeKey: buildRateLimitKey });
export const POST = withRateLimit(addLike, { limiter: likesPostLimiter, getUserId: resolveUserId, makeKey: buildRateLimitKey });
```

```typescript
// apps/web/src/app/api/likes/[advertId]/route.ts
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { createErrorResponse, createSuccessResponse, handleSupabaseError, ApiErrorCode } from "@/lib/apiErrors";

export const runtime = "nodejs";

const deleteLimiter = createRateLimiter({ limit: 30, windowSec: 60, prefix: "likes:delete" });
const uuidSchema = z.string().uuid();

async function removeLike(request: Request, context: { params: Promise<{ advertId: string }> }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401, detail: "Authentication required" });

  const { advertId } = await context.params;
  if (!uuidSchema.safeParse(advertId).success) return createErrorResponse(ApiErrorCode.BAD_INPUT, { status: 400, detail: "Invalid advert ID format" });

  const { error, count } = await supabase.from("advert_likes").delete({ count: "exact" }).eq("user_id", user.id).eq("advert_id", advertId);
  if (error) return handleSupabaseError(error, ApiErrorCode.INTERNAL_ERROR);
  if (!count) return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404, detail: "Like not found" });
  return createSuccessResponse({ advert_id: advertId });
}

export const DELETE = withRateLimit(removeLike, { limiter: deleteLimiter, makeKey: (_req, _userId, ip) => ip ?? "anonymous" });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run apps/web/src/app/api/likes/__tests__/likes-route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/likes
git commit -m "feat(likes): /api/likes GET+POST+DELETE (mirrors favorites)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `resolveLikeCounts` batch counter

**Files:**
- Create: `apps/web/src/lib/likeCounts.ts`
- Test: `apps/web/src/lib/__tests__/likeCounts.test.ts`

**Interfaces:**
- Produces: `resolveLikeCounts(advertIds: string[]): Promise<Map<string, number>>` — counts `advert_likes` rows per advert (dedupe + cap input at 48), reading via the public-read RLS with `supabaseServer()`. Ids with no likes are absent (treat as 0).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/likeCounts.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const tableData: { data: unknown; error: unknown } = { data: [], error: null };
function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "in"]) b[m] = () => b;
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(tableData);
  return b;
}
vi.mock("@/lib/supabaseServer", () => ({ supabaseServer: async () => ({ from: () => builder() }) }));

const { resolveLikeCounts } = await import("@/lib/likeCounts");

describe("resolveLikeCounts", () => {
  beforeEach(() => { tableData.data = []; tableData.error = null; });

  it("counts rows per advert_id", async () => {
    tableData.data = [{ advert_id: "a" }, { advert_id: "a" }, { advert_id: "b" }];
    const map = await resolveLikeCounts(["a", "b", "c"]);
    expect(map.get("a")).toBe(2);
    expect(map.get("b")).toBe(1);
    expect(map.get("c") ?? 0).toBe(0);
  });

  it("returns empty map for empty input", async () => {
    const map = await resolveLikeCounts([]);
    expect(map.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/web/src/lib/__tests__/likeCounts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/likeCounts.ts
import { supabaseServer } from "@/lib/supabaseServer";

const DEFAULT_CAP = 48;

/** Count advert_likes rows per advert id (public-read RLS). Absent ids = 0. */
export async function resolveLikeCounts(advertIds: string[], options: { cap?: number } = {}): Promise<Map<string, number>> {
  const cap = options.cap ?? DEFAULT_CAP;
  const ids = Array.from(new Set(advertIds.filter(Boolean))).slice(0, cap);
  const out = new Map<string, number>();
  if (ids.length === 0) return out;

  const supabase = await supabaseServer();
  const { data } = await supabase.from("advert_likes").select("advert_id").in("advert_id", ids);
  for (const row of (data ?? []) as Array<{ advert_id: string }>) {
    out.set(row.advert_id, (out.get(row.advert_id) ?? 0) + 1);
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/web/src/lib/__tests__/likeCounts.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/likeCounts.ts apps/web/src/lib/__tests__/likeCounts.test.ts
git commit -m "feat(likes): resolveLikeCounts batch counter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Attach `like_count` to `/api/search` items

**Files:**
- Modify: `apps/web/src/app/api/search/route.ts`
- Modify: `apps/web/src/app/api/search/__tests__/search-route.test.ts`

**Interfaces:**
- Consumes: `resolveLikeCounts` (Task 3). Produces: `/api/search` items gain `like_count: number` (0 when none), alongside the Phase-1 `image`.

- [ ] **Step 1: Update the test** (add a `like_count` assertion + mock)

Add to `search-route.test.ts`: mock `@/lib/likeCounts` and assert the item carries `like_count`.

```typescript
// add near the other vi.mock calls:
const resolveLikeCountsMock = vi.fn(async () => new Map([["adv-1", 3]]));
vi.mock("@/lib/likeCounts", () => ({ resolveLikeCounts: (...a: unknown[]) => resolveLikeCountsMock(...(a as [])) }));

// add a new test:
it("attaches like_count to each item", async () => {
  rpcMock.mockResolvedValue({
    data: [{ id: "adv-1", title: "Bike", status: "active", total_count: 1 }],
    error: null,
  });
  const res = await GET(new Request("https://x.test/api/search?limit=24"));
  const body = await res.json();
  expect(body.data.items[0].like_count).toBe(3);
});
```

- [ ] **Step 2: Run to verify the new test fails**

Run: `npx vitest run apps/web/src/app/api/search/__tests__/search-route.test.ts`
Expected: the new test FAILS (`like_count` is `undefined`).

- [ ] **Step 3: Edit the route**

Add the import: `import { resolveLikeCounts } from "@/lib/likeCounts";`. In the final block (where `imageMap` is resolved and `itemsWithImages` is built — from Phase 1 Task 2), resolve like counts in parallel and attach:

```typescript
  const ids = results.map((r) => r.id as string);
  const [imageMap, likeMap] = await Promise.all([resolveFirstImages(ids), resolveLikeCounts(ids)]);
  const itemsWithImages = results.map((r) => ({
    ...r,
    image: imageMap.get(r.id as string) ?? null,
    like_count: likeMap.get(r.id as string) ?? 0,
  }));
```

(Keep the existing `return createSuccessResponse({ items: itemsWithImages, ... })`.)

- [ ] **Step 4: Run to verify all pass**

Run: `npx vitest run apps/web/src/app/api/search/__tests__/search-route.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/search/route.ts apps/web/src/app/api/search/__tests__/search-route.test.ts
git commit -m "feat(likes): attach like_count to /api/search items

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Carry `likeCount` through the card mapper

**Files:**
- Modify: `apps/web/src/lib/advertCards.ts`
- Modify: `apps/web/src/lib/__tests__/advertCards.test.ts`

**Interfaces:**
- Produces: `SearchApiItem` gains `like_count?: number | null`; `AdvertCard` gains `likeCount: number`; `mapSearchItemToCard` maps `like_count → likeCount` (default 0).

- [ ] **Step 1: Update the test**

```typescript
// in advertCards.test.ts, extend the full-mapping expectation with like_count → likeCount:
it("maps like_count to likeCount (default 0)", () => {
  expect(mapSearchItemToCard({ id: "x", title: "T", like_count: 5 }).likeCount).toBe(5);
  expect(mapSearchItemToCard({ id: "y", title: "T" }).likeCount).toBe(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/lib/__tests__/advertCards.test.ts`
Expected: FAIL (`likeCount` undefined / property missing).

- [ ] **Step 3: Edit `advertCards.ts`**

Add `like_count?: number | null;` to `SearchApiItem`, `likeCount: number;` to `AdvertCard`, and in `mapSearchItemToCard` add `likeCount: item.like_count ?? 0,`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/lib/__tests__/advertCards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/advertCards.ts apps/web/src/lib/__tests__/advertCards.test.ts
git commit -m "feat(likes): carry likeCount through mapSearchItemToCard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `LikesProvider` + `useLikes` (mirror FavoritesProvider)

**Files:**
- Create: `apps/web/src/components/likes/LikesProvider.tsx`
- Modify: `apps/web/src/app/layout.tsx`

**Interfaces:**
- Produces: `LikesProvider` (wraps the app) + `useLikes(): { isLiked(id), addLike(id), removeLike(id), isLoading, isAuthenticated }`. `addLike`/`removeLike` call `/api/likes`; on 401 they return `{ ok:false, error:"unauthorized" }` and redirect to `/login?next=<path>` (mirroring favorites — the Trust Gate replaces this redirect in Phase 2b).

- [ ] **Step 1: Read `FavoritesProvider.tsx`** then write the likes version

Mirror `apps/web/src/components/favorites/FavoritesProvider.tsx`, simplified: state is `Set<string>` of liked advert ids (not a full item map). `refresh()` calls `GET /api/likes` and fills the set from `data.items[].advert_id`. `addLike(id)`/`removeLike(id)` call `POST /api/likes` / `DELETE /api/likes/{id}`, optimistic-update the set, and on `response.status === 401` set `isAuthenticated=false`, `window.location.assign("/login?next=" + encodeURIComponent(location.pathname))`, return `{ ok:false, error:"unauthorized" }`.

```tsx
// apps/web/src/components/likes/LikesProvider.tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/fetcher";

type LikesContextValue = {
  isLiked: (advertId: string) => boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  addLike: (advertId: string) => Promise<{ ok: boolean; error?: string }>;
  removeLike: (advertId: string) => Promise<{ ok: boolean; error?: string }>;
};

const LikesContext = createContext<LikesContextValue | null>(null);

function redirectToLogin() {
  if (typeof window !== "undefined") {
    window.location.assign("/login?next=" + encodeURIComponent(window.location.pathname));
  }
}

export function LikesProvider({ children }: { children: ReactNode }) {
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch("/api/likes?limit=500", { credentials: "include" });
      const payload = await response.json().catch(() => ({ ok: false }));
      if (response.status === 401 || !payload?.ok || !payload?.data?.authenticated) {
        setLiked(new Set());
        setIsAuthenticated(Boolean(payload?.data?.authenticated));
        return;
      }
      setLiked(new Set((payload.data.items as Array<{ advert_id: string }>).map((i) => i.advert_id)));
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const addLike = useCallback(async (advertId: string) => {
    try {
      const response = await apiFetch("/api/likes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ advert_id: advertId }),
      });
      if (response.status === 401) { setIsAuthenticated(false); redirectToLogin(); return { ok: false, error: "unauthorized" }; }
      const payload = await response.json().catch(() => ({ ok: false }));
      if (!response.ok || !payload?.ok) return { ok: false, error: payload?.error ?? "unknown" };
      setLiked((prev) => new Set(prev).add(advertId));
      return { ok: true };
    } catch { return { ok: false, error: "network" }; }
  }, []);

  const removeLike = useCallback(async (advertId: string) => {
    try {
      const response = await apiFetch(`/api/likes/${advertId}`, { method: "DELETE", credentials: "include" });
      if (response.status === 401) { setIsAuthenticated(false); redirectToLogin(); return { ok: false, error: "unauthorized" }; }
      const payload = await response.json().catch(() => ({ ok: false }));
      if (!response.ok || !payload?.ok) return { ok: false, error: payload?.error ?? "unknown" };
      setLiked((prev) => { const next = new Set(prev); next.delete(advertId); return next; });
      return { ok: true };
    } catch { return { ok: false, error: "network" }; }
  }, []);

  const value = useMemo<LikesContextValue>(() => ({
    isLiked: (id) => liked.has(id), isLoading, isAuthenticated, addLike, removeLike,
  }), [liked, isLoading, isAuthenticated, addLike, removeLike]);

  return <LikesContext.Provider value={value}>{children}</LikesContext.Provider>;
}

export function useLikes(): LikesContextValue {
  const ctx = useContext(LikesContext);
  if (!ctx) throw new Error("useLikes must be used within LikesProvider");
  return ctx;
}
```

- [ ] **Step 2: Wire into `layout.tsx`**

Add `import { LikesProvider } from "@/components/likes/LikesProvider";` and nest it inside `FavoritesProvider`:

```tsx
<FavoritesProvider>
  <LikesProvider>
    <TopBar />
    {/* …existing children… */}
  </LikesProvider>
</FavoritesProvider>
```

- [ ] **Step 3: Verify types + build**

Run: `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0
Run: `pnpm build` → exit 0

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/likes/LikesProvider.tsx apps/web/src/app/layout.tsx
git commit -m "feat(likes): LikesProvider + useLikes, wired into root layout

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: `LikeToggle` component (+ i18n)

**Files:**
- Create: `apps/web/src/components/likes/LikeToggle.tsx`
- Modify: `apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`

**Interfaces:**
- Consumes: `useLikes` (Task 6). Produces: `<LikeToggle advertId={string} initialCount={number} className? variant?="overlay"|"inline" />` — a 👍 button + count; optimistic count; toast on success/error; `t("likes.login_required")` on unauthorized.

- [ ] **Step 1: Read `FavoriteToggle.tsx`** then write the like version

```tsx
// apps/web/src/components/likes/LikeToggle.tsx
"use client";

import { useState } from "react";
import { ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useLikes } from "@/components/likes/LikesProvider";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

type Props = { advertId: string; initialCount?: number; className?: string; variant?: "overlay" | "inline" };

export default function LikeToggle({ advertId, initialCount = 0, className, variant = "inline" }: Props) {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => { const v = t(k); return v === k ? fb : v; };
  const { isLiked, addLike, removeLike, isLoading } = useLikes();
  const [pending, setPending] = useState(false);
  const [count, setCount] = useState(initialCount);
  const liked = isLiked(advertId);

  const onClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (pending || isLoading) return;
    setPending(true);
    const wasLiked = liked;
    setCount((c) => Math.max(0, c + (wasLiked ? -1 : 1))); // optimistic
    try {
      const result = wasLiked ? await removeLike(advertId) : await addLike(advertId);
      if (!result.ok) {
        setCount((c) => Math.max(0, c + (wasLiked ? 1 : -1))); // revert
        if (result.error === "unauthorized") toast.info(tr("likes.login_required", "Sign in to like listings"));
        else toast.error(tr("likes.failed", "Could not update like"));
      }
    } finally { setPending(false); }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={liked}
      aria-label={liked ? tr("likes.remove", "Remove like") : tr("likes.add", "Like")}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full text-sm font-semibold transition",
        variant === "overlay"
          ? "size-10 justify-center bg-card/90 shadow-[var(--shadow-soft)] backdrop-blur"
          : "px-2.5 py-1 border border-border/70 bg-secondary/60",
        liked ? "text-primary" : "text-muted-foreground hover:text-primary",
        className,
      )}
    >
      <ThumbsUp className={cn("h-4 w-4", liked && "fill-current")} aria-hidden="true" />
      {count > 0 ? <span className="tabular-nums">{count}</span> : null}
    </button>
  );
}
```

- [ ] **Step 2: Add i18n keys to all 5 locales** (new `likes` namespace)

- en: `"likes": { "add": "Like", "remove": "Remove like", "login_required": "Sign in to like listings", "failed": "Could not update like" }`
- ru: `"Нравится"`, `"Убрать лайк"`, `"Войдите, чтобы ставить лайки"`, `"Не удалось обновить лайк"`
- nl: `"Leuk"`, `"Like verwijderen"`, `"Log in om te liken"`, `"Kon like niet bijwerken"`
- fr: `"J'aime"`, `"Retirer le j'aime"`, `"Connectez-vous pour aimer"`, `"Impossible de mettre à jour le j'aime"`
- de: `"Gefällt mir"`, `"Like entfernen"`, `"Zum Liken anmelden"`, `"Like konnte nicht aktualisiert werden"`

- [ ] **Step 3: Verify i18n + types**

Run: `node scripts/check-i18n-keys.js` → PASS
Run: `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/likes/LikeToggle.tsx apps/web/src/i18n/locales
git commit -m "feat(likes): LikeToggle component + i18n

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Show likes on AdCard and the detail page

**Files:**
- Modify: `apps/web/src/components/ad-card.tsx`
- Modify: `apps/web/src/components/ads-grid.tsx` (pass `likeCount` through if the grid maps props)
- Modify: `apps/web/src/app/ad/[id]/page.tsx`

**Interfaces:**
- Consumes: `LikeToggle` (Task 7), `AdvertCard.likeCount` (Task 5), `get_advert_like_count` (Task 1).

This is wiring — verified by `tsc` + `build` + the live check.

- [ ] **Step 1: AdCard — add the like toggle + count**

In `apps/web/src/components/ad-card.tsx`: add `likeCount?: number` to its `Props`, import `LikeToggle`, and render `<LikeToggle advertId={id} initialCount={likeCount ?? 0} variant="inline" />` in the card content area (e.g. in the footer row next to the date, or beside the report button). Keep `FavoriteToggle` (the heart) where it is — likes and favorites are distinct.

- [ ] **Step 2: AdsGrid — forward `likeCount`**

In `apps/web/src/components/ads-grid.tsx`, ensure the `items` type includes `likeCount?: number` and it spreads through to `AdCard` (the grid already spreads `{...item}` per Phase-1 recon; just widen the item type).

- [ ] **Step 3: Detail page — fetch + show the like count**

In `apps/web/src/app/ad/[id]/page.tsx`, add a server-side count for the advert via the RPC and render a `LikeToggle` near the title / contact panel:

```typescript
const { data: likeCountData } = await supabase.rpc("get_advert_like_count", { advert_id_param: data.advert.id });
const likeCount = Number(likeCountData ?? 0);
```
Render `<LikeToggle advertId={data.advert.id} initialCount={likeCount} variant="inline" />` in the detail header area. (Use whichever supabase client the page already has in scope; the count is public so the anon/server client is fine.)

- [ ] **Step 4: Verify types + build**

Run: `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0
Run: `pnpm build` → exit 0

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ad-card.tsx apps/web/src/components/ads-grid.tsx apps/web/src/app/ad/[id]/page.tsx
git commit -m "feat(likes): show LikeToggle + count on cards and the detail page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Popularity formula — `views·0.3 + likes·3 + favorites·5`

**Files:**
- Modify: `apps/web/src/app/api/top-adverts/route.ts`
- Test: `apps/web/src/lib/__tests__/popularity.test.ts` (create) + extract a pure helper

**Interfaces:**
- Produces: a pure `popularityScore({views, likes, favorites})` helper in `apps/web/src/lib/popularity.ts`; `/api/top-adverts` queries `advert_likes` counts (mirroring its `favorites` count query) and scores with the new formula, returning `like_count` per advert.

- [ ] **Step 1: Write the failing test for the pure helper**

```typescript
// apps/web/src/lib/__tests__/popularity.test.ts
import { describe, it, expect } from "vitest";
import { popularityScore } from "@/lib/popularity";

describe("popularityScore", () => {
  it("weights views·0.3 + likes·3 + favorites·5", () => {
    expect(popularityScore({ views: 10, likes: 2, favorites: 1 })).toBeCloseTo(10 * 0.3 + 2 * 3 + 1 * 5);
  });
  it("treats missing counts as 0", () => {
    expect(popularityScore({})).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/lib/__tests__/popularity.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

```typescript
// apps/web/src/lib/popularity.ts
export function popularityScore({ views = 0, likes = 0, favorites = 0 }: { views?: number; likes?: number; favorites?: number }): number {
  return views * 0.3 + likes * 3 + favorites * 5;
}
```

- [ ] **Step 4: Wire into `/api/top-adverts`**

In `apps/web/src/app/api/top-adverts/route.ts`: add a `advert_likes` count query mirroring the existing `favorites` count query (`.from("advert_likes").select("advert_id").in("advert_id", advertIds)` → build `likeCountMap`), import `popularityScore`, and replace `const popularityScore = views * 1 + favorites * 5;` with `const score = popularityScore({ views, likes, favorites });` (rename the local to avoid shadowing the import). Add `like_count: likes` to each result object.

- [ ] **Step 5: Run the helper test to verify it passes + tsc**

Run: `npx vitest run apps/web/src/lib/__tests__/popularity.test.ts` → PASS
Run: `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/popularity.ts apps/web/src/lib/__tests__/popularity.test.ts apps/web/src/app/api/top-adverts/route.ts
git commit -m "feat(likes): popularity = views·0.3 + likes·3 + favorites·5

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Full verification + deploy + live check

**Files:** none (verification + release).

- [ ] **Step 1: Full local gate**

```bash
node scripts/check-i18n-keys.js
npx tsc -p apps/web/tsconfig.json --noEmit
pnpm build
pnpm test
```
Expected: i18n PASS, tsc 0, build 0, all green (new suites: likes-route, likeCounts, popularity; updated: search-route, advertCards).

- [ ] **Step 2: Push to deploy** (`git push origin main`) and wait for Vercel `Ready` (`vercel ls lyvox-frontend` until Ready, not `● Error`; confirm `next` is `16.0.11` if it errors).

- [ ] **Step 3: Live verification on www.lyvox.be**

```bash
# /api/search now carries like_count
curl -s 'https://www.lyvox.be/api/search?limit=3' | grep -o '"like_count"' | head
# top-adverts returns like_count + new scores (no error)
curl -s 'https://www.lyvox.be/api/top-adverts' | head -c 300
# /api/likes requires auth (anonymous POST → 401)
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://www.lyvox.be/api/likes -H "Content-Type: application/json" -d '{"advert_id":"00000000-0000-0000-0000-000000000000"}'
```
Expected: `/api/search` items include `"like_count"`; `/api/top-adverts` returns `{"ok":true,...}`; anonymous `POST /api/likes` returns `401`. Then load the home/search pages and a listing in a browser: the 👍 toggle appears next to the ❤️ heart; liking while signed-in increments the count; liking while signed-out redirects to login.

- [ ] **Step 4: Done.** Phase 2b (Trust Gate + verified-only enforcement + hide-seller-identity) follows as its own plan.

---

## Self-Review

**1. Spec coverage (Phase 2a = the Likes/popularity half of spec Section G):**
- New `advert_likes` table + RLS (public-read, mirrors favorites) + count fn → Task 1. ✅
- `/api/likes` POST/DELETE (auth-tier) + GET for the provider → Task 2. ✅
- Like count on cards + detail page → Tasks 3–5, 8. ✅
- `LikesProvider`/`useLikes`/`LikeToggle` mirroring favorites → Tasks 6, 7. ✅
- Popularity `views·0.3 + likes·3 + favorites·5` → Task 9. ✅
- Deferred to **Phase 2b** (correctly out of scope here): the Trust Gate modal (likes here use the existing login-redirect on 401), verified-only server enforcement, hiding seller identity.

**2. Placeholder scan:** No "TBD"/"add error handling" without code. Task 2/6/7 say "read the favorites version first" because they are deliberate mirrors — the favorites file is the exact template, and the likes code is given in full; this is guidance, not a placeholder.

**3. Type consistency:** `SearchApiItem.like_count` / `AdvertCard.likeCount` defined in Task 5, consumed in Tasks 4/8. `resolveLikeCounts` consistent (Tasks 3, 4). `useLikes`/`isLiked`/`addLike`/`removeLike` consistent (Tasks 6, 7). `popularityScore` signature consistent (Task 9). `get_advert_like_count` consistent (Tasks 1, 8).
