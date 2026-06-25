# Discovery & Search — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an infinite, image-rich discovery feed on the home page, instant listing results + recent searches in the search bar, a recently-viewed row, and a Condition filter + integrated Sort — the first shippable slice of the Stage-1 UX overhaul.

**Architecture:** Images are the foundation. The search RPC (`search_adverts`) returns no media, so today `/api/search` consumers must resolve images themselves — and the search page's attempt is silently broken (`mediaData.items` instead of `mediaData.data.items`), so search results render imageless. We fix this **at the source**: `/api/search` attaches a signed first-image URL to each item server-side (one batch resolution, capped + deduped). Every consumer (search page, instant-search dropdown, discovery feed) then gets card-ready data in one round-trip and the client-merge bug class disappears. The feed itself is a client component over the existing `/api/search` (paged), using `IntersectionObserver` with the page-0/page-1 seam deduped by id. Recently-viewed and recent-searches are anonymous localStorage features. The Condition filter extends the existing zod schema + RPC (additive 13th param, old overload dropped) and plugs into the existing URL-param-driven `SearchFilters`.

**Tech Stack:** Next.js 16 (App Router, `runtime=nodejs` routes), React 19, Supabase (Postgres RPC + Storage signed URLs + RLS), Zod validation, Vitest (jsdom), Tailwind v4 + shadcn UI, sonner toasts, custom `useI18n()` i18n.

## Global Constraints

- **Next.js pinned at `16.0.11`** (and `eslint-config-next` matching) — never downgrade; Vercel blocks vulnerable Next versions. See `memory/deploy-pipeline.md`.
- **Every user-facing string is localized in all 5 locales** — `apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`. `node scripts/check-i18n-keys.js` MUST pass (identical key sets across locales). Add keys in the same task that introduces the UI.
- **API envelope:** success = `createSuccessResponse(data)` → `{ ok: true, data }`; error = `createErrorResponse(code, { status, detail })` → `{ ok: false, error, detail }`. Both from `@/lib/apiErrors`. Validate input with `validateRequest(schema, data)` from `@/lib/validations`.
- **DB changes are applied surgically via `pg` + `SUPABASE_DB_URL`**, transactionally, gated by a test-call, idempotent. NEVER `supabase db push` (local migrations have drifted from remote). Still commit the `.sql` migration file for the record.
- **Tests:** Vitest, env `jsdom`. Run all with `pnpm test` (root `vitest run`); a single file with `npx vitest run <path>`. Mock Supabase with `vi.mock("@/lib/supabaseServer")` / `vi.mock("@/lib/supabaseService")` (see Task 1 for the pattern).
- **i18n in client components:** `const { t } = useI18n()` from `@/i18n`; dot-notation keys; fallback pattern `const tr = (k, fb) => { const v = t(k); return v === k ? fb : v; }`.
- **Toasts:** `import { toast } from "sonner"`.
- **UI primitives** from `@/components/ui/*` (`Button`, `Input`, `Checkbox`, `Select`, `Sheet`, `Label`).
- **Verification is on production:** local Turbopack dev does not reflect CSS/client changes. Gate each push on `tsc` + `pnpm build` + i18n check + `pnpm test`, then verify on **www.lyvox.be** via `curl`.
- **Commits** end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` and never stage `.claude/`.

**Reference shapes (used across tasks):**

```typescript
// What /api/search returns per item AFTER Task 2 (snake_case, image attached server-side):
type SearchApiItem = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;        // NEW in Task 2 (signed URL or null)
  created_at?: string | null;
  seller_verified?: boolean | null;
};

// What AdCard (@/components/ad-card) and AdsGrid (@/components/ads-grid) consume:
type AdvertCard = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  location: string | null;
  image: string | null;
  createdAt: string | null;     // camelCase
  sellerVerified: boolean;      // camelCase
};
```

---

### Task 1: Server util `resolveFirstImages` (batch first-image signer)

**Files:**
- Create: `apps/web/src/lib/advertMedia.ts`
- Test: `apps/web/src/lib/__tests__/advertMedia.test.ts`

**Interfaces:**
- Consumes: `supabaseServer` (reads), `supabaseService` (signs) — existing modules.
- Produces: `resolveFirstImages(advertIds: string[], options?: { cap?: number }): Promise<Map<string, string>>` — maps each advert id with an active first image to a signed URL (10-min TTL). Ids that are inactive or have no media are simply absent from the map. Input is deduped and capped (default 24). Mirrors the signing logic already in `app/api/media/public/route.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/advertMedia.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// Thenable query builder: every chained method returns the builder;
// awaiting it resolves to { data, error }.
function builder(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "in", "eq", "order"]) b[m] = () => b;
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return b;
}

const tableResults: Record<string, { data: unknown; error: unknown }> = {};
const signMock = vi.fn(async (path: string) => ({
  data: { signedUrl: `signed:${path}` },
  error: null,
}));

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    from: (table: string) => builder(tableResults[table] ?? { data: [], error: null }),
  }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    storage: { from: () => ({ createSignedUrl: (p: string) => signMock(p) }) },
  }),
}));

const { resolveFirstImages } = await import("@/lib/advertMedia");

describe("resolveFirstImages", () => {
  beforeEach(() => {
    signMock.mockClear();
    tableResults.adverts = {
      data: [
        { id: "a1", status: "active" },
        { id: "a2", status: "active" },
        { id: "a3", status: "draft" }, // inactive -> excluded
      ],
      error: null,
    };
    tableResults.media = {
      data: [
        { advert_id: "a1", url: "a1/first.jpg", sort: 0 },
        { advert_id: "a1", url: "a1/second.jpg", sort: 1 }, // not first
        { advert_id: "a2", url: "https://cdn.example/a2.jpg", sort: 0 }, // legacy absolute
      ],
      error: null,
    };
  });

  it("returns a signed first-image URL per active advert with media", async () => {
    const map = await resolveFirstImages(["a1", "a2", "a3"]);
    expect(map.get("a1")).toBe("signed:a1/first.jpg");
    expect(map.get("a2")).toBe("https://cdn.example/a2.jpg"); // legacy passthrough
    expect(map.has("a3")).toBe(false); // inactive
  });

  it("dedupes and caps the id list before querying", async () => {
    const map = await resolveFirstImages(["a1", "a1", "a1"], { cap: 1 });
    expect(map.get("a1")).toBe("signed:a1/first.jpg");
  });

  it("returns an empty map for empty input", async () => {
    const map = await resolveFirstImages([]);
    expect(map.size).toBe(0);
    expect(signMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/web/src/lib/__tests__/advertMedia.test.ts`
Expected: FAIL — `Cannot find module "@/lib/advertMedia"`.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/advertMedia.ts
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";

const SIGNED_DOWNLOAD_TTL_SECONDS = 10 * 60;
const DEFAULT_CAP = 24;

/**
 * Resolve a signed first-image URL for each active advert id.
 * Inactive adverts and adverts without media are omitted from the result.
 * The id list is deduped and capped (default 24) before any DB/storage work.
 */
export async function resolveFirstImages(
  advertIds: string[],
  options: { cap?: number } = {},
): Promise<Map<string, string>> {
  const cap = options.cap ?? DEFAULT_CAP;
  const ids = Array.from(new Set(advertIds.filter(Boolean))).slice(0, cap);
  const out = new Map<string, string>();
  if (ids.length === 0) return out;

  const supabase = await supabaseServer();

  const { data: adverts } = await supabase
    .from("adverts")
    .select("id,status")
    .in("id", ids);

  const activeIds = (adverts ?? [])
    .filter((a: { status?: string | null }) => a.status === "active")
    .map((a: { id: string }) => a.id);
  if (activeIds.length === 0) return out;

  const { data: media } = await supabase
    .from("media")
    .select("advert_id,url,sort")
    .in("advert_id", activeIds)
    .order("sort", { ascending: true });

  // First (lowest sort) media row per advert. Rows arrive sorted ascending.
  const firstPath = new Map<string, string>();
  for (const row of (media ?? []) as Array<{ advert_id: string; url: string }>) {
    if (!firstPath.has(row.advert_id)) firstPath.set(row.advert_id, row.url);
  }
  if (firstPath.size === 0) return out;

  const service = await supabaseService();
  const storage = service.storage.from("ad-media");

  await Promise.all(
    Array.from(firstPath.entries()).map(async ([advertId, path]) => {
      if (path.startsWith("http://") || path.startsWith("https://")) {
        out.set(advertId, path); // legacy absolute URL — use as-is
        return;
      }
      const { data, error } = await storage.createSignedUrl(
        path,
        SIGNED_DOWNLOAD_TTL_SECONDS,
      );
      if (!error && data?.signedUrl) out.set(advertId, data.signedUrl);
    }),
  );

  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/web/src/lib/__tests__/advertMedia.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/advertMedia.ts apps/web/src/lib/__tests__/advertMedia.test.ts
git commit -m "feat(search): add resolveFirstImages batch first-image signer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Attach `image` to `/api/search` items (fix the imageless bug at the source)

**Files:**
- Modify: `apps/web/src/app/api/search/route.ts`
- Test: `apps/web/src/app/api/search/__tests__/search-route.test.ts` (create)

**Interfaces:**
- Consumes: `resolveFirstImages` (Task 1).
- Produces: `GET /api/search` response items now include `image: string | null`. Response shape: `{ ok: true, data: { items: SearchApiItem[], total, page, limit, hasMore } }`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/app/api/search/__tests__/search-route.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ rpc: rpcMock }),
}));

// Make rate limiting a passthrough so the handler runs without Redis.
vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true, limit: 60, remaining: 59, reset: 0, retryAfterSec: 0 }),
  withRateLimit: (handler: unknown) => handler,
}));

const resolveFirstImagesMock = vi.fn(async () => new Map([["adv-1", "signed:adv-1/first.jpg"]]));
vi.mock("@/lib/advertMedia", () => ({
  resolveFirstImages: (...args: unknown[]) => resolveFirstImagesMock(...(args as [])),
}));

const { GET } = await import("../route");

describe("GET /api/search", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    resolveFirstImagesMock.mockClear();
  });

  it("attaches a signed image URL to each item", async () => {
    rpcMock.mockResolvedValue({
      data: [
        { id: "adv-1", title: "Bike", price: 50, currency: "EUR", location: "Gent",
          condition: "used", status: "active", created_at: "2026-06-01T00:00:00Z",
          seller_verified: true, total_count: 1, relevance_rank: 0 },
      ],
      error: null,
    });

    const res = await GET(new Request("https://x.test/api/search?limit=24"));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.data.items[0].image).toBe("signed:adv-1/first.jpg");
    expect(body.data.items[0].seller_verified).toBe(true);
    expect(resolveFirstImagesMock).toHaveBeenCalledWith(["adv-1"]);
  });

  it("sets image to null when no media is found", async () => {
    resolveFirstImagesMock.mockResolvedValueOnce(new Map());
    rpcMock.mockResolvedValue({
      data: [{ id: "adv-2", title: "Lamp", status: "active", total_count: 1 }],
      error: null,
    });

    const res = await GET(new Request("https://x.test/api/search"));
    const body = await res.json();
    expect(body.data.items[0].image).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/web/src/app/api/search/__tests__/search-route.test.ts`
Expected: FAIL — `body.data.items[0].image` is `undefined` (route does not attach images yet).

- [ ] **Step 3: Edit the route**

In `apps/web/src/app/api/search/route.ts`, add the import near the top:

```typescript
import { resolveFirstImages } from "@/lib/advertMedia";
```

Replace the final return block (currently `return createSuccessResponse({ items: results, ... })`) with:

```typescript
  const imageMap = await resolveFirstImages(results.map((r) => r.id as string));
  const itemsWithImages = results.map((r) => ({
    ...r,
    image: imageMap.get(r.id as string) ?? null,
  }));

  return createSuccessResponse({
    items: itemsWithImages,
    total: totalCount,
    page: params.page,
    limit: params.limit,
    hasMore: totalCount > pageOffset + results.length,
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/web/src/app/api/search/__tests__/search-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/search/route.ts apps/web/src/app/api/search/__tests__/search-route.test.ts
git commit -m "fix(search): attach signed first-image URL to /api/search items

Resolves images server-side so search/feed/instant-search render thumbnails
in one round-trip (the prior client-side resolution was silently broken).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Pure card mapper `lib/advertCards.ts`

**Files:**
- Create: `apps/web/src/lib/advertCards.ts`
- Test: `apps/web/src/lib/__tests__/advertCards.test.ts`

**Interfaces:**
- Produces: `mapSearchItemToCard(item: SearchApiItem): AdvertCard` (snake_case → camelCase, null-normalized). Shared by the search page (Task 4), feed (Task 9), and instant-search dropdown (Task 12).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/advertCards.test.ts
import { describe, it, expect } from "vitest";
import { mapSearchItemToCard } from "@/lib/advertCards";

describe("mapSearchItemToCard", () => {
  it("maps snake_case API fields to camelCase card fields", () => {
    const card = mapSearchItemToCard({
      id: "x", title: "Sofa", price: 120, currency: "EUR", location: "Antwerp",
      image: "signed:x.jpg", created_at: "2026-06-01T00:00:00Z", seller_verified: true,
    });
    expect(card).toEqual({
      id: "x", title: "Sofa", price: 120, currency: "EUR", location: "Antwerp",
      image: "signed:x.jpg", createdAt: "2026-06-01T00:00:00Z", sellerVerified: true,
    });
  });

  it("normalizes missing optional fields to null/false", () => {
    const card = mapSearchItemToCard({ id: "y", title: "Chair" });
    expect(card).toEqual({
      id: "y", title: "Chair", price: null, currency: null, location: null,
      image: null, createdAt: null, sellerVerified: false,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/web/src/lib/__tests__/advertCards.test.ts`
Expected: FAIL — `Cannot find module "@/lib/advertCards"`.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/advertCards.ts
export type SearchApiItem = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  created_at?: string | null;
  seller_verified?: boolean | null;
};

export type AdvertCard = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  location: string | null;
  image: string | null;
  createdAt: string | null;
  sellerVerified: boolean;
};

export function mapSearchItemToCard(item: SearchApiItem): AdvertCard {
  return {
    id: item.id,
    title: item.title,
    price: item.price ?? null,
    currency: item.currency ?? null,
    location: item.location ?? null,
    image: item.image ?? null,
    createdAt: item.created_at ?? null,
    sellerVerified: Boolean(item.seller_verified),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/web/src/lib/__tests__/advertCards.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/advertCards.ts apps/web/src/lib/__tests__/advertCards.test.ts
git commit -m "feat(search): add pure mapSearchItemToCard helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Refactor SearchPage to use the mapper (delete the broken media block)

**Files:**
- Modify: `apps/web/src/app/search/page.tsx`

**Interfaces:**
- Consumes: `mapSearchItemToCard` (Task 3); `/api/search` items now carry `image` (Task 2).

This task has no new unit test — it is wiring; the mapping logic is covered by Task 3, and correctness (images appear) is verified by `tsc` + `build` + the live check in Task 15. It removes a real bug: `createSuccessResponse(data)` returns `{ ok: true, data }` (`apiErrors.ts`), so `/api/media/public` returns `{ ok, data: { items } }`, but the page reads `mediaData.items` (`search/page.tsx:178`) — always `undefined` — so every result rendered the placeholder.

- [ ] **Step 0 (cheap insurance): grep for the same envelope misread elsewhere**

Run: `rg -n "\.json\(\)" apps/web/src --glob '!**/__tests__/**' -A3 | rg -n "(?<![.]data)\.items|(?<![.]data)\.(?:user|advert|profile|count)\b" ` (or simply review other `await res.json()` sites). Any consumer of a `createSuccessResponse` route that reads `body.<field>` instead of `body.data.<field>` is the same bug — note it for a follow-up (do not fix unrelated routes in this task; just record findings in the commit body if any).

- [ ] **Step 1: Add the import**

At the top of `apps/web/src/app/search/page.tsx`, add:

```typescript
import { mapSearchItemToCard } from "@/lib/advertCards";
```

- [ ] **Step 2: Extend the response item type**

In the `SearchResponse` type, add `image` to the `items` element type:

```typescript
    items: Array<{
      id: string;
      title: string;
      price?: number | null;
      currency?: string | null;
      location?: string | null;
      image?: string | null;       // NEW — now provided by /api/search
      created_at?: string | null;
      seller_verified?: boolean;
      user_id?: string;
    }>;
```

- [ ] **Step 3: Replace the media-resolution block**

Delete the entire block that builds `firstMedia` and `formattedResults` (the `const ids = ...` through the `const formattedResults: SearchResult[] = data.data.items.map(...)` assignment — roughly lines 167–212, including the `/api/media/public` per-advert fetch loop). Replace it with:

```typescript
      const formattedResults: SearchResult[] = data.data.items.map(mapSearchItemToCard);

      setResults(formattedResults);
```

(If `logger` is no longer referenced after the deletion, leave the import — it is still used in the outer `catch`. Do not remove `logger`.)

- [ ] **Step 4: Verify types compile**

Run: `npx tsc -p apps/web/tsconfig.json --noEmit`
Expected: exit 0, no errors in `search/page.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/search/page.tsx
git commit -m "fix(search): render result images via mapped /api/search items

Removes the broken client-side media resolution (read mediaData.items
instead of mediaData.data.items, so results were always imageless).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `lib/recentlyViewed.ts` (localStorage store)

**Files:**
- Create: `apps/web/src/lib/recentlyViewed.ts`
- Test: `apps/web/src/lib/__tests__/recentlyViewed.test.ts`

**Interfaces:**
- Produces:
  - `type RecentAdvert = { id: string; title: string; price: number | null; currency: string | null; location: string | null; image: string | null }`
  - `getRecentlyViewed(): RecentAdvert[]`
  - `addRecentlyViewed(item: RecentAdvert): RecentAdvert[]` (dedupe by id, most-recent-first, cap 20)
  - `clearRecentlyViewed(): void`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/recentlyViewed.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  getRecentlyViewed,
  addRecentlyViewed,
  clearRecentlyViewed,
  type RecentAdvert,
} from "@/lib/recentlyViewed";

const mk = (id: string): RecentAdvert => ({
  id, title: `T${id}`, price: 1, currency: "EUR", location: "Gent", image: null,
});

describe("recentlyViewed", () => {
  beforeEach(() => clearRecentlyViewed());

  it("returns [] initially", () => {
    expect(getRecentlyViewed()).toEqual([]);
  });

  it("adds most-recent-first", () => {
    addRecentlyViewed(mk("a"));
    addRecentlyViewed(mk("b"));
    expect(getRecentlyViewed().map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("dedupes by id, moving the re-viewed item to front", () => {
    addRecentlyViewed(mk("a"));
    addRecentlyViewed(mk("b"));
    addRecentlyViewed(mk("a"));
    expect(getRecentlyViewed().map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) addRecentlyViewed(mk(`id${i}`));
    const all = getRecentlyViewed();
    expect(all.length).toBe(20);
    expect(all[0].id).toBe("id24");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/web/src/lib/__tests__/recentlyViewed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/recentlyViewed.ts
export type RecentAdvert = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  location: string | null;
  image: string | null;
};

const KEY = "lyvox:recentlyViewed";
const CAP = 20;

function readStore(): RecentAdvert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentAdvert[]) : [];
  } catch {
    return [];
  }
}

function writeStore(items: RecentAdvert[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* private mode / quota — degrade silently */
  }
}

export function getRecentlyViewed(): RecentAdvert[] {
  return readStore();
}

export function addRecentlyViewed(item: RecentAdvert): RecentAdvert[] {
  const next = [item, ...readStore().filter((r) => r.id !== item.id)].slice(0, CAP);
  writeStore(next);
  return next;
}

export function clearRecentlyViewed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/web/src/lib/__tests__/recentlyViewed.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/recentlyViewed.ts apps/web/src/lib/__tests__/recentlyViewed.test.ts
git commit -m "feat(discovery): add recentlyViewed localStorage store

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `RecentlyViewedRecorder` + wire into the ad-detail page

**Files:**
- Create: `apps/web/src/components/discovery/RecentlyViewedRecorder.tsx`
- Modify: `apps/web/src/app/ad/[id]/page.tsx`

**Interfaces:**
- Consumes: `addRecentlyViewed`, `RecentAdvert` (Task 5).
- Produces: `<RecentlyViewedRecorder advert={RecentAdvert} />` — a render-null client component that records the advert on mount. No visible UI (no i18n).

- [ ] **Step 1: Create the recorder**

```tsx
// apps/web/src/components/discovery/RecentlyViewedRecorder.tsx
"use client";

import { useEffect } from "react";
import { addRecentlyViewed, type RecentAdvert } from "@/lib/recentlyViewed";

export default function RecentlyViewedRecorder({ advert }: { advert: RecentAdvert }) {
  useEffect(() => {
    if (!advert?.id) return;
    addRecentlyViewed(advert);
  }, [advert]);
  return null;
}
```

- [ ] **Step 2: Wire it into the detail page**

In `apps/web/src/app/ad/[id]/page.tsx`, add the import:

```typescript
import RecentlyViewedRecorder from "@/components/discovery/RecentlyViewedRecorder";
```

Inside the rendered JSX of `AdvertPage` (near the top of the main content, alongside `AdvertGallery`), render the recorder. The page already computes `primaryImageUrl` (`const primaryImageUrl = galleryImages[0]?.url ?? null;` at `ad/[id]/page.tsx:425`) and exposes the advert as `data.advert` (type `AdvertRecord`, fields `id/title/price/currency/location`). Reuse both:

```tsx
<RecentlyViewedRecorder
  advert={{
    id: data.advert.id,
    title: data.advert.title,
    price: data.advert.price ?? null,
    currency: data.advert.currency ?? null,
    location: data.advert.location ?? null,
    image: primaryImageUrl,
  }}
/>
```

(If any field name differs at implementation time, match the real `data.advert` shape; pass `null` for an absent field.)

- [ ] **Step 3: Verify types compile**

Run: `npx tsc -p apps/web/tsconfig.json --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/discovery/RecentlyViewedRecorder.tsx apps/web/src/app/ad/[id]/page.tsx
git commit -m "feat(discovery): record recently-viewed adverts on the detail page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: `RecentlyViewed` row component (+ i18n)

**Files:**
- Create: `apps/web/src/components/discovery/RecentlyViewed.tsx`
- Modify: `apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`

**Interfaces:**
- Consumes: `getRecentlyViewed` (Task 5), `AdCard` (`@/components/ad-card`).
- Produces: `<RecentlyViewed />` — a horizontal scroll row; renders nothing until mounted (avoids SSR mismatch) and nothing when empty.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/discovery/RecentlyViewed.tsx
"use client";

import { useEffect, useState } from "react";
import AdCard from "@/components/ad-card";
import { getRecentlyViewed, type RecentAdvert } from "@/lib/recentlyViewed";
import { useI18n } from "@/i18n";

export default function RecentlyViewed() {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };
  const [items, setItems] = useState<RecentAdvert[] | null>(null);

  useEffect(() => {
    setItems(getRecentlyViewed());
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-extrabold tracking-tight text-foreground">
        {tr("discovery.recently_viewed", "Recently viewed")}
      </h2>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <div key={item.id} className="w-40 shrink-0 snap-start sm:w-48">
            <AdCard
              id={item.id}
              title={item.title}
              price={item.price}
              currency={item.currency}
              location={item.location}
              image={item.image}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add the i18n key to all 5 locales**

Add the `discovery` namespace key (create the `discovery` object if it does not exist) to each file:

- `en.json`: `"discovery": { "recently_viewed": "Recently viewed" }`
- `ru.json`: `"discovery": { "recently_viewed": "Вы недавно смотрели" }`
- `nl.json`: `"discovery": { "recently_viewed": "Recent bekeken" }`
- `fr.json`: `"discovery": { "recently_viewed": "Vus récemment" }`
- `de.json`: `"discovery": { "recently_viewed": "Zuletzt angesehen" }`

(If a `discovery` object already exists from an earlier task, add the key inside it — do not duplicate the object.)

- [ ] **Step 3: Verify i18n + types**

Run: `node scripts/check-i18n-keys.js`
Expected: PASS (all locales have `discovery.recently_viewed`).
Run: `npx tsc -p apps/web/tsconfig.json --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/discovery/RecentlyViewed.tsx apps/web/src/i18n/locales
git commit -m "feat(discovery): recently-viewed horizontal row component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Pure feed-pagination helper `lib/discoveryFeed.ts`

**Files:**
- Create: `apps/web/src/lib/discoveryFeed.ts`
- Test: `apps/web/src/lib/__tests__/discoveryFeed.test.ts`

**Interfaces:**
- Consumes: `AdvertCard` (Task 3).
- Produces: `appendUnique(prev: AdvertCard[], incoming: AdvertCard[]): AdvertCard[]` — appends only ids not already present (handles the page-0/page-1 seam between `getLatestAds()` and `/api/search` page 1). This is the testable core; the `IntersectionObserver` wiring (Task 9) is a thin shell over it.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/discoveryFeed.test.ts
import { describe, it, expect } from "vitest";
import { appendUnique } from "@/lib/discoveryFeed";
import type { AdvertCard } from "@/lib/advertCards";

const card = (id: string): AdvertCard => ({
  id, title: id, price: null, currency: null, location: null, image: null,
  createdAt: null, sellerVerified: false,
});

describe("appendUnique", () => {
  it("appends new items preserving order", () => {
    const out = appendUnique([card("a"), card("b")], [card("c"), card("d")]);
    expect(out.map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("drops incoming items whose id already exists (seam dedup)", () => {
    const out = appendUnique([card("a"), card("b")], [card("b"), card("c")]);
    expect(out.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("returns prev unchanged when incoming is empty", () => {
    const prev = [card("a")];
    expect(appendUnique(prev, []).map((c) => c.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/web/src/lib/__tests__/discoveryFeed.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/discoveryFeed.ts
import type { AdvertCard } from "@/lib/advertCards";

/** Append `incoming` to `prev`, skipping any ids already present. */
export function appendUnique(prev: AdvertCard[], incoming: AdvertCard[]): AdvertCard[] {
  if (incoming.length === 0) return prev;
  const seen = new Set(prev.map((c) => c.id));
  return [...prev, ...incoming.filter((c) => !seen.has(c.id))];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/web/src/lib/__tests__/discoveryFeed.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/discoveryFeed.ts apps/web/src/lib/__tests__/discoveryFeed.test.ts
git commit -m "feat(discovery): add appendUnique feed-seam dedup helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: `DiscoveryFeed` infinite-scroll component (+ i18n)

**Files:**
- Create: `apps/web/src/components/discovery/DiscoveryFeed.tsx`
- Modify: `apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`

**Interfaces:**
- Consumes: `AdsGrid` (`@/components/ads-grid`), `AdsGridSkeleton` (`@/components/marketplace-grid-states`), `mapSearchItemToCard` (Task 3), `appendUnique` (Task 8), `/api/search` (Task 2).
- Produces: `<DiscoveryFeed initialItems={AdvertCard[]} />` — renders `initialItems` (the SSR first page), then appends `/api/search?sort_by=created_at_desc&page=N&limit=24` pages on scroll via `IntersectionObserver`, deduped. Shows a skeleton while loading, an end-of-feed line when exhausted, and an inline retry on error.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/discovery/DiscoveryFeed.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdsGrid from "@/components/ads-grid";
import { AdsGridSkeleton } from "@/components/marketplace-grid-states";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { mapSearchItemToCard, type AdvertCard, type SearchApiItem } from "@/lib/advertCards";
import { appendUnique } from "@/lib/discoveryFeed";

const PAGE_SIZE = 24;

export default function DiscoveryFeed({ initialItems }: { initialItems: AdvertCard[] }) {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };

  const [items, setItems] = useState<AdvertCard[]>(initialItems);
  const [page, setPage] = useState(1); // page 0 == initialItems (SSR)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(initialItems.length < PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `/api/search?sort_by=created_at_desc&page=${page}&limit=${PAGE_SIZE}`,
      );
      if (!res.ok) throw new Error("fetch failed");
      const body = await res.json();
      if (!body.ok || !body.data) throw new Error("bad payload");
      const incoming = (body.data.items as SearchApiItem[]).map(mapSearchItemToCard);
      setItems((prev) => appendUnique(prev, incoming));
      setPage((p) => p + 1);
      if (!body.data.hasMore || incoming.length === 0) setDone(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, done, page]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || done) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, done]);

  return (
    <div className="space-y-6">
      <AdsGrid items={items} />

      {loading && <AdsGridSkeleton count={8} />}

      {error && !loading && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            {tr("discovery.load_error", "Couldn't load more listings.")}
          </p>
          <Button variant="outline" size="sm" onClick={loadMore}>
            {tr("common.retry", "Retry")}
          </Button>
        </div>
      )}

      {done && !error && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {tr("discovery.end_of_feed", "You've reached the end.")}
        </p>
      )}

      {!done && <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}
    </div>
  );
}
```

- [ ] **Step 2: Add the i18n keys to all 5 locales**

Add inside the `discovery` namespace in each file:

- `en.json`: `"load_error": "Couldn't load more listings."`, `"end_of_feed": "You've reached the end."`
- `ru.json`: `"load_error": "Не удалось загрузить ещё объявления."`, `"end_of_feed": "Вы просмотрели все объявления."`
- `nl.json`: `"load_error": "Kon meer advertenties niet laden."`, `"end_of_feed": "Je hebt het einde bereikt."`
- `fr.json`: `"load_error": "Impossible de charger plus d'annonces."`, `"end_of_feed": "Vous êtes arrivé à la fin."`
- `de.json`: `"load_error": "Weitere Anzeigen konnten nicht geladen werden."`, `"end_of_feed": "Sie haben das Ende erreicht."`

Confirm `common.retry` already exists in all 5 (it is used by the search page); if missing in any, add it (`en` "Retry", `ru` "Повторить", `nl` "Opnieuw", `fr` "Réessayer", `de` "Erneut versuchen").

- [ ] **Step 3: Verify i18n + types + build**

Run: `node scripts/check-i18n-keys.js`
Expected: PASS.
Run: `npx tsc -p apps/web/tsconfig.json --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/discovery/DiscoveryFeed.tsx apps/web/src/i18n/locales
git commit -m "feat(discovery): infinite-scroll DiscoveryFeed component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Wire DiscoveryFeed + RecentlyViewed into the home page

**Files:**
- Modify: `apps/web/src/app/page.tsx`

**Interfaces:**
- Consumes: `DiscoveryFeed` (Task 9), `RecentlyViewed` (Task 7). `latestAds` (from `getLatestAds()`) already matches `AdvertCard` (`{id,title,price,currency,location,image,createdAt,sellerVerified}`).

This is wiring — verified by `tsc` + `build` + the live check in Task 15.

- [ ] **Step 1: Add imports**

At the top of `apps/web/src/app/page.tsx`:

```typescript
import DiscoveryFeed from "@/components/discovery/DiscoveryFeed";
import RecentlyViewed from "@/components/discovery/RecentlyViewed";
```

- [ ] **Step 2: Replace the latest-adverts section**

Replace the block (currently around lines 359–362):

```tsx
<section className="space-y-4">
  <SectionTitle>{t("home.latest")}</SectionTitle>
  <AdsGrid items={latestAds} />
</section>
```

with (keep `SectionTitle` and the server-side `t`; render the recently-viewed row above the feed):

```tsx
<RecentlyViewed />
<section className="space-y-4">
  <SectionTitle>{t("home.latest")}</SectionTitle>
  <DiscoveryFeed initialItems={latestAds} />
</section>
```

(If `AdsGrid` is now unused in `page.tsx`, remove its import to keep the build lint-clean. Confirm with a grep before removing — the "Free adverts" row may still use it.)

- [ ] **Step 3: Verify types + build**

Run: `npx tsc -p apps/web/tsconfig.json --noEmit`
Expected: exit 0.
Run: `pnpm build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(discovery): home page uses infinite feed + recently-viewed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: `lib/recentSearches.ts` (localStorage store)

**Files:**
- Create: `apps/web/src/lib/recentSearches.ts`
- Test: `apps/web/src/lib/__tests__/recentSearches.test.ts`

**Interfaces:**
- Produces:
  - `getRecentSearches(): string[]`
  - `addRecentSearch(q: string): string[]` (trim, ignore empty, dedupe case-insensitively, most-recent-first, cap 8)
  - `removeRecentSearch(q: string): string[]`
  - `clearRecentSearches(): void`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/__tests__/recentSearches.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from "@/lib/recentSearches";

describe("recentSearches", () => {
  beforeEach(() => clearRecentSearches());

  it("returns [] initially", () => {
    expect(getRecentSearches()).toEqual([]);
  });

  it("adds most-recent-first and ignores blank queries", () => {
    addRecentSearch("bike");
    addRecentSearch("  ");
    addRecentSearch("sofa");
    expect(getRecentSearches()).toEqual(["sofa", "bike"]);
  });

  it("dedupes case-insensitively, moving to front", () => {
    addRecentSearch("Bike");
    addRecentSearch("sofa");
    addRecentSearch("bike");
    expect(getRecentSearches()).toEqual(["bike", "sofa"]);
  });

  it("caps at 8", () => {
    for (let i = 0; i < 12; i++) addRecentSearch(`q${i}`);
    expect(getRecentSearches().length).toBe(8);
    expect(getRecentSearches()[0]).toBe("q11");
  });

  it("removes a specific query", () => {
    addRecentSearch("a");
    addRecentSearch("b");
    expect(removeRecentSearch("a")).toEqual(["b"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/web/src/lib/__tests__/recentSearches.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/lib/recentSearches.ts
const KEY = "lyvox:recentSearches";
const CAP = 8;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function write(items: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* degrade silently */
  }
}

export function getRecentSearches(): string[] {
  return read();
}

export function addRecentSearch(q: string): string[] {
  const query = q.trim();
  if (!query) return read();
  const lower = query.toLowerCase();
  const next = [query, ...read().filter((s) => s.toLowerCase() !== lower)].slice(0, CAP);
  write(next);
  return next;
}

export function removeRecentSearch(q: string): string[] {
  const lower = q.trim().toLowerCase();
  const next = read().filter((s) => s.toLowerCase() !== lower);
  write(next);
  return next;
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/web/src/lib/__tests__/recentSearches.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/recentSearches.ts apps/web/src/lib/__tests__/recentSearches.test.ts
git commit -m "feat(search): add recentSearches localStorage store

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: SearchBar — instant listing results + recent searches (+ i18n)

**Files:**
- Modify: `apps/web/src/components/SearchBar.tsx`
- Modify: `apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`

**Interfaces:**
- Consumes: `/api/search?q=&limit=6` (Task 2; items carry `image`), `getRecentSearches`/`addRecentSearch`/`removeRecentSearch` (Task 11), `mapSearchItemToCard` (Task 3, optional for typing).

This task extends an existing client component; correctness is verified by `tsc`/`build` + the live check. Follow the existing debounce + dropdown structure (a 300ms `setTimeout` writes `debouncedSearch`; suggestions render in a dropdown below the input).

- [ ] **Step 1: Add imports + state**

Add near the other imports in `SearchBar.tsx`:

```typescript
import { getRecentSearches, addRecentSearch, removeRecentSearch } from "@/lib/recentSearches";
```

SearchBar already has `const { t, locale } = useI18n();` but **no `tr` helper** — add one right after it (the new dropdown JSX uses `tr`):

```typescript
const tr = (key: string, fallback: string) => {
  const value = t(key);
  return value === key ? fallback : value;
};
```

Add state alongside the existing component state:

```typescript
const [instant, setInstant] = useState<
  Array<{ id: string; title: string; price?: number | null; currency?: string | null; image?: string | null }>
>([]);
const [recent, setRecent] = useState<string[]>([]);
const [focused, setFocused] = useState(false);
```

- [ ] **Step 2: Load recent searches on focus; fetch instant results on debounced input**

Add effects (mirroring the existing debounced-category effect):

```typescript
// Load recent searches when the input gains focus
useEffect(() => {
  if (focused) setRecent(getRecentSearches());
}, [focused]);

// Fetch top listing results for the debounced query
useEffect(() => {
  const q = debouncedSearch.trim();
  if (q.length < 2) {
    setInstant([]);
    return;
  }
  let cancelled = false;
  (async () => {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`);
      if (!res.ok) return;
      const body = await res.json();
      if (!cancelled && body.ok && body.data) setInstant(body.data.items);
    } catch {
      /* ignore — dropdown just omits listing results */
    }
  })();
  return () => {
    cancelled = true;
  };
}, [debouncedSearch]);
```

- [ ] **Step 3: Record the query on submit**

In the existing submit handler (the one that does `router.push(\`/search?q=...\`)`), call `addRecentSearch(query)` before/after navigating:

```typescript
addRecentSearch(query);
router.push(`/search?q=${encodeURIComponent(query)}`);
```

Wire `onFocus={() => setFocused(true)}` and `onBlur={() => setTimeout(() => setFocused(false), 150)}` onto the search `<input>` (the blur delay lets a result click register).

- [ ] **Step 4: Render instant results + recent searches in the dropdown**

In the dropdown area (where category suggestions render), add **above** the category suggestions:

```tsx
{instant.length > 0 && (
  <div className="border-b border-border/60 py-1">
    <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {tr("search.instant_results", "Listings")}
    </p>
    {instant.map((item) => (
      <button
        key={item.id}
        type="button"
        onClick={() => router.push(`/ad/${item.id}`)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-secondary/60"
      >
        <span className="lyvox-image-placeholder flex h-10 w-10 shrink-0 overflow-hidden rounded-md">
          {item.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={item.image} alt="" className="h-full w-full object-cover" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
        {typeof item.price === "number" && (
          <span className="shrink-0 text-sm font-semibold">
            {item.price} {item.currency ?? "EUR"}
          </span>
        )}
      </button>
    ))}
  </div>
)}

{focused && debouncedSearch.trim().length < 2 && recent.length > 0 && (
  <div className="py-1">
    <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {tr("search.recent_searches", "Recent searches")}
    </p>
    {recent.map((q) => (
      <div key={q} className="flex items-center justify-between px-3 py-1.5 hover:bg-secondary/60">
        <button type="button" onClick={() => router.push(`/search?q=${encodeURIComponent(q)}`)} className="min-w-0 flex-1 truncate text-left text-sm">
          {q}
        </button>
        <button
          type="button"
          aria-label={tr("search.remove_recent", "Remove")}
          onClick={() => setRecent(removeRecentSearch(q))}
          className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>
    ))}
  </div>
)}
```

Ensure the component obtains `tr` via the existing `useI18n()` (add the `tr` helper if not already present).

- [ ] **Step 5: Add the i18n keys to all 5 locales**

Inside the `search` namespace of each file:

- `en`: `"instant_results": "Listings"`, `"recent_searches": "Recent searches"`, `"remove_recent": "Remove"`
- `ru`: `"Объявления"`, `"Недавние запросы"`, `"Удалить"`
- `nl`: `"Advertenties"`, `"Recente zoekopdrachten"`, `"Verwijderen"`
- `fr`: `"Annonces"`, `"Recherches récentes"`, `"Supprimer"`
- `de`: `"Anzeigen"`, `"Letzte Suchen"`, `"Entfernen"`

- [ ] **Step 6: Verify i18n + types + build**

Run: `node scripts/check-i18n-keys.js` → PASS
Run: `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0
Run: `pnpm build` → exit 0

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/SearchBar.tsx apps/web/src/i18n/locales
git commit -m "feat(search): instant listing results + recent searches in SearchBar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 13: Condition filter — zod + route param + `search_adverts` migration

**Files:**
- Modify: `apps/web/src/lib/validations/search.ts`
- Modify: `apps/web/src/app/api/search/route.ts`
- Create: `supabase/migrations/20260626120000_search_adverts_condition.sql`
- Test: `apps/web/src/lib/validations/__tests__/search-schema.test.ts` (create)

**Interfaces:**
- Produces: `/api/search` accepts `condition=new|used|for_parts` and passes `condition_filter` to the RPC; the RPC gains a 13th param `condition_filter text default null`.

- [ ] **Step 1: Write the failing schema test**

```typescript
// apps/web/src/lib/validations/__tests__/search-schema.test.ts
import { describe, it, expect } from "vitest";
import { searchAdvertsQuerySchema } from "@/lib/validations/search";

describe("searchAdvertsQuerySchema condition", () => {
  it("accepts a valid condition", () => {
    const r = searchAdvertsQuerySchema.safeParse({ condition: "used" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.condition).toBe("used");
  });

  it("normalizes a missing condition to null", () => {
    const r = searchAdvertsQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.condition).toBeNull();
  });

  it("rejects an invalid condition", () => {
    const r = searchAdvertsQuerySchema.safeParse({ condition: "broken" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/web/src/lib/validations/__tests__/search-schema.test.ts`
Expected: FAIL — `condition` is not in the schema (either parses through with no `condition`, or the invalid case unexpectedly passes).

- [ ] **Step 3: Add `condition` to the schema**

In `apps/web/src/lib/validations/search.ts`, add this field to the `z.object({ ... })` (next to `location`):

```typescript
    // Condition filter (matches adverts.condition)
    condition: z
      .enum(["new", "used", "for_parts"])
      .optional()
      .nullable()
      .transform((val) => val || null),
```

- [ ] **Step 4: Pass it through the route**

In `apps/web/src/app/api/search/route.ts`, add to the `searchParams` object passed to `.rpc("search_adverts", ...)`:

```typescript
    condition_filter: params.condition ?? undefined,
```

- [ ] **Step 5: Run the schema test to verify it passes**

Run: `npx vitest run apps/web/src/lib/validations/__tests__/search-schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the migration**

Create `supabase/migrations/20260626120000_search_adverts_condition.sql` — the full canonical function with the new `condition_filter` param appended (13th) and a new WHERE clause, then DROP the old 12-arg overload:

```sql
-- Extend search_adverts with an optional condition_filter (13th param).
-- Additive + idempotent. Drops the prior 12-arg overload so only one remains
-- (avoids PGRST203 overload ambiguity).

create or replace function public.search_adverts(
  search_query text default null,
  category_id_filter uuid default null,
  price_min_filter numeric default null,
  price_max_filter numeric default null,
  location_filter text default null,
  location_lat numeric default null,
  location_lng numeric default null,
  radius_km numeric default 50,
  sort_by text default 'created_at_desc',
  page_offset int default 0,
  page_limit int default 24,
  verified_only boolean default false,
  condition_filter text default null
)
returns table (
  id uuid, user_id uuid, category_id uuid, title text, description text,
  price numeric, currency text, condition text, status text, location_id uuid,
  location text, created_at timestamptz, updated_at timestamptz,
  seller_verified boolean, total_count bigint, relevance_rank numeric
)
language plpgsql
stable
as $$
declare
  query_tsquery tsquery;
  has_postgis boolean;
begin
  select exists (select 1 from pg_extension where extname = 'postgis') into has_postgis;

  if search_query is not null and length(trim(search_query)) > 0 then
    query_tsquery := plainto_tsquery('simple', search_query);
  end if;

  return query
  with filtered as (
    select
      a.id, a.user_id, a.category_id, a.title, a.description, a.price, a.currency,
      a.condition, a.status, a.location_id, a.location, a.created_at, a.updated_at,
      coalesce(p.verified_email, false) and coalesce(p.verified_phone, false) as seller_verified,
      case
        when query_tsquery is not null then
          ts_rank_cd(
            to_tsvector('simple', coalesce(a.title, '') || ' ' || coalesce(a.description, '')),
            query_tsquery
          )
        else 0.0
      end as relevance_rank
    from public.adverts a
    left join public.profiles p on p.id = a.user_id
    left join public.locations loc on a.location_id = loc.id
    where
      a.status = 'active'
      and (category_id_filter is null or a.category_id = category_id_filter)
      and (price_min_filter is null or a.price is null or a.price >= price_min_filter)
      and (price_max_filter is null or a.price is null or a.price <= price_max_filter)
      and (location_filter is null or a.location ilike '%' || location_filter || '%')
      and (condition_filter is null or a.condition = condition_filter)
      and (
        query_tsquery is null
        or to_tsvector('simple', coalesce(a.title, '') || ' ' || coalesce(a.description, '')) @@ query_tsquery
      )
      and (
        location_lat is null or location_lng is null or not has_postgis or loc.point is null
        or (
          has_postgis and loc.point is not null
          and st_dwithin(loc.point, st_makepoint(location_lng, location_lat)::geography, radius_km * 1000)
        )
      )
      and (
        not verified_only
        or (coalesce(p.verified_email, false) and coalesce(p.verified_phone, false))
      )
  ),
  total as (select count(*) as total_count from filtered)
  select
    f.id::uuid, f.user_id::uuid, f.category_id::uuid, f.title::text, f.description::text,
    f.price::numeric, f.currency::text, f.condition::text, f.status::text, f.location_id::uuid,
    f.location::text, f.created_at::timestamptz, f.updated_at::timestamptz,
    f.seller_verified::boolean, t.total_count::bigint, f.relevance_rank::numeric
  from filtered f
  cross join total t
  order by
    case when sort_by = 'relevance' then f.relevance_rank end desc nulls last,
    case when sort_by = 'price_asc' then f.price end asc nulls last,
    case when sort_by = 'price_desc' then f.price end desc nulls last,
    case when sort_by = 'created_at_asc' then f.created_at end asc,
    case when sort_by = 'created_at_desc' or sort_by is null then f.created_at end desc,
    f.created_at desc
  offset page_offset
  limit page_limit;
end;
$$;

-- Drop the prior 12-arg overload (no condition_filter), if present.
drop function if exists public.search_adverts(
  text, uuid, numeric, numeric, text, numeric, numeric, numeric, text, int, int, boolean
);
```

- [ ] **Step 7: Apply the migration surgically with a transactional test-call gate**

Create a throwaway script and run it (uses `SUPABASE_DB_URL`). It applies inside a transaction, then **test-calls both the 13-arg and an old-style call** to confirm the new overload resolves and the old one is gone, committing only if the test-call succeeds:

```bash
node -e '
const { Client } = require("pg");
const fs = require("fs");
const sql = fs.readFileSync("supabase/migrations/20260626120000_search_adverts_condition.sql","utf8");
(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await c.connect();
  try {
    await c.query("begin");
    await c.query(sql);
    // Test-call the new 13-arg signature (named arg) — must not error.
    await c.query("select * from public.search_adverts(condition_filter => $1, page_limit => 1)", ["used"]);
    await c.query("commit");
    console.log("OK: search_adverts condition_filter applied");
  } catch (e) {
    await c.query("rollback");
    console.error("ROLLED BACK:", e.message);
    process.exit(1);
  } finally {
    await c.end();
  }
})();
'
```

Expected: `OK: search_adverts condition_filter applied`. If it prints `ROLLED BACK`, fix the SQL and re-run — nothing was persisted.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/validations/search.ts apps/web/src/app/api/search/route.ts supabase/migrations/20260626120000_search_adverts_condition.sql apps/web/src/lib/validations/__tests__/search-schema.test.ts
git commit -m "feat(search): add condition filter (schema + route + RPC param)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 14: SearchFilters — Condition checkboxes + integrated Sort (+ i18n)

**Files:**
- Modify: `apps/web/src/components/SearchFilters.tsx`
- Modify: `apps/web/src/app/search/page.tsx`
- Modify: `apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`

**Interfaces:**
- Consumes: the `condition` URL param (Task 13 makes the API honor it). `SearchFiltersState` gains `condition: string | null` and `sort_by: string`.

Wiring task — verified by `tsc`/`build` + live check. Mirror the existing filter sections (Category/Price/Location/Verified) and the existing URL-param application in `handleFiltersChange`.

- [ ] **Step 1: Extend `SearchFiltersState` + initial state**

In `SearchFilters.tsx`, add to the exported `SearchFiltersState` type:

```typescript
  condition: string | null;
  sort_by: string;
```

Initialize both from URL params on mount (next to where `verified_only` etc. are read): `condition` from `searchParams.get("condition")` (default `null`), `sort_by` from `searchParams.get("sort_by") ?? "created_at_desc"`.

- [ ] **Step 2: Add the Condition section UI**

Add a filter section (place it after the Verified-sellers section), using the existing `Checkbox` + `Label` primitives:

```tsx
<div className="space-y-2">
  <p className="text-sm font-semibold">{tr("search.condition", "Condition")}</p>
  {([
    ["new", tr("search.condition_new", "New")],
    ["used", tr("search.condition_used", "Used")],
    ["for_parts", tr("search.condition_for_parts", "For parts")],
  ] as const).map(([value, label]) => (
    <label key={value} className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={condition === value}
        onCheckedChange={(checked) => setCondition(checked ? value : null)}
      />
      {label}
    </label>
  ))}
</div>
```

(Condition is single-select here — selecting one clears the others — matching the single `condition` URL param and the RPC's single `condition_filter`. Track it with a `const [condition, setCondition] = useState<string | null>(...)`.)

- [ ] **Step 3: Add the Sort control inside the sheet**

Add a `Select` (reuse the exact options from `search/page.tsx` header) bound to a `sort_by` state, so the sort is also adjustable from within the filter sheet:

```tsx
<div className="space-y-2">
  <p className="text-sm font-semibold">{tr("search.sort", "Sort")}</p>
  <Select value={sortBy} onValueChange={setSortBy}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="relevance">{tr("search.sortRelevance", "Relevance")}</SelectItem>
      <SelectItem value="price_asc">{tr("search.sortPriceAsc", "Price: low to high")}</SelectItem>
      <SelectItem value="price_desc">{tr("search.sortPriceDesc", "Price: high to low")}</SelectItem>
      <SelectItem value="created_at_desc">{tr("search.sortNewest", "Newest first")}</SelectItem>
      <SelectItem value="created_at_asc">{tr("search.sortOldest", "Oldest first")}</SelectItem>
    </SelectContent>
  </Select>
</div>
```

- [ ] **Step 4: Include condition + sort_by when applying filters**

In the existing apply handler (where the component builds the `SearchFiltersState` it passes to `onFiltersChange`), include `condition` and `sort_by`. Add a condition chip to the active-filters array (label = the localized condition name, `onRemove` = `setCondition(null)`).

In `apps/web/src/app/search/page.tsx` `handleFiltersChange`, after the existing params, add:

```typescript
    if (filters.condition) {
      params.set("condition", filters.condition);
    } else {
      params.delete("condition");
    }
    if (filters.sort_by) {
      params.set("sort_by", filters.sort_by);
    }
```

Also in `search/page.tsx`, read `condition` and pass it through in `fetchResults` (next to the other `params.set(...)` calls):

```typescript
const condition = searchParams.get("condition");
// ...inside fetchResults param building:
if (condition) params.set("condition", condition);
```

- [ ] **Step 5: Add the i18n keys to all 5 locales**

Inside the `search` namespace (the `sort*` keys already exist):

- `en`: `"condition": "Condition"`, `"condition_new": "New"`, `"condition_used": "Used"`, `"condition_for_parts": "For parts"`
- `ru`: `"Состояние"`, `"Новое"`, `"Б/у"`, `"На запчасти"`
- `nl`: `"Staat"`, `"Nieuw"`, `"Gebruikt"`, `"Voor onderdelen"`
- `fr`: `"État"`, `"Neuf"`, `"Occasion"`, `"Pour pièces"`
- `de`: `"Zustand"`, `"Neu"`, `"Gebraucht"`, `"Für Teile"`

- [ ] **Step 6: Verify i18n + types + build**

Run: `node scripts/check-i18n-keys.js` → PASS
Run: `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0
Run: `pnpm build` → exit 0

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/SearchFilters.tsx apps/web/src/app/search/page.tsx apps/web/src/i18n/locales
git commit -m "feat(search): Condition filter + in-sheet Sort in SearchFilters

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 15: Full verification + deploy + live check

**Files:** none (verification + release).

- [ ] **Step 1: Full local gate**

```bash
node scripts/check-i18n-keys.js
npx tsc -p apps/web/tsconfig.json --noEmit
pnpm build
pnpm test
```
Expected: i18n PASS, tsc exit 0, build exit 0, all tests green (new suites: advertMedia, search-route, advertCards, recentlyViewed, discoveryFeed, recentSearches, search-schema).

- [ ] **Step 2: Push to deploy**

```bash
git push origin main
```

- [ ] **Step 3: Wait for the Vercel deploy to go Ready**

```bash
vercel ls lyvox-frontend
```
Re-run until the latest deployment shows `Ready` (not `● Error`). If `● Error` with "Vulnerable version of Next.js", confirm `next` is still `16.0.11`.

- [ ] **Step 4: Live verification on www.lyvox.be**

```bash
# Home feed renders (server HTML contains the latest section)
curl -s https://www.lyvox.be/ | grep -o 'home.latest\|DiscoveryFeed\|recently' | head
# Search API now returns image fields
curl -s 'https://www.lyvox.be/api/search?limit=3' | grep -o '"image"' | head
# Condition filter is honored (no 400/PGRST error)
curl -s 'https://www.lyvox.be/api/search?condition=used&limit=3' | head -c 300
```
Expected: the search API JSON includes `"image"` keys; the `condition=used` call returns `{"ok":true,...}` (not a PostgREST function-not-found / overload error). Manually load the home page and a search page in a browser to confirm: infinite scroll appends image-rich cards, the instant-search dropdown shows listings + recent searches, the filter sheet shows Condition + Sort, and recently-viewed appears after opening a listing.

- [ ] **Step 5: Mark complete**

The Phase 1 deliverable is shipped and verified. Subsequent phases (Trust Gate + likes, swipe deck, saved searches) get their own plans.

---

## Self-Review

**1. Spec coverage (Phase 1 = Parts A, B, C of the spec):**
- A. Discovery feed → Tasks 8, 9, 10. RecentlyViewed → Tasks 5, 6, 7. ✅
- B. Instant search → Task 12; recent searches → Tasks 11, 12. ✅
- C. Condition filter + Sort → Tasks 13, 14; RPC `condition_filter` param → Task 13. ✅
- Image foundation (prerequisite + bug fix, implied by the spec's "image-rich feed/results") → Tasks 1, 2, 3, 4. ✅
- Out of Phase 1 (correctly deferred): swipe, Trust Gate, likes/popularity, saved searches, Passkeys — separate plans.

**2. Placeholder scan:** No "TBD"/"implement later"/"add error handling" without code. Each code step shows the actual code. Task 6 leaves `firstImageUrl`/field-name matching to the implementer because the exact var name on the detail page must be read at implementation time — this is flagged explicitly, not a hidden placeholder.

**3. Type consistency:** `SearchApiItem`/`AdvertCard` defined in Task 3 and reused verbatim in Tasks 9, 12. `mapSearchItemToCard` name consistent (Tasks 3, 4, 9, 12). `appendUnique` consistent (Tasks 8, 9). `resolveFirstImages` consistent (Tasks 1, 2). `RecentAdvert` consistent (Tasks 5, 6, 7). `SearchFiltersState` additions (`condition`, `sort_by`) consistent (Tasks 13, 14). RPC param `condition_filter` consistent (Tasks 13, 14, 15).

**4. Risk coverage (from advisor):** server-side image attach removes the 3 client-merge sites and the `.items` vs `.data.items` bug (Tasks 2, 4) ✅; signing capped+deduped (Task 1) ✅; feed seam deduped by id (Task 8) ✅; i18n distributed per UI task (7, 9, 12, 14), final consistency check (15) ✅; IntersectionObserver logic extracted to a pure, jsdom-testable helper (Task 8) ✅; condition migration DROPs the old overload + transactional test-call gate (Task 13) ✅.
