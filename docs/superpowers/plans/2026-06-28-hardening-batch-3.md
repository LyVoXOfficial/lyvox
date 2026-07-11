# Hardening Batch-3 (B4 + B1) Implementation Plan

> [!WARNING]
> **ARCHIVED IMPLEMENTATION PLAN — DO NOT EXECUTE AS A BACKLOG.** Этот документ сохраняется как история уже принятого технического подхода. Он не задаёт текущие priority/status/order и не разрешает правки. Единственный рабочий источник: [`docs/MASTER_PRODUCTION_TZ.md`](../../MASTER_PRODUCTION_TZ.md).

**Goal:** Fix two P1 regressions: (B4) anonymise raw IP stored in `advert_views.ip_address` to satisfy GDPR; (B1) add DB-level `UNIQUE(reviewer_id, subject_id)` on `reviews` after safe deduplication.

**Architecture:** Two independent atomic commits — B4 touches only the view route and one new migration; B1 touches only a new migration (create_review() already has the application-level EXISTS guard from F14). Both migrations are idempotent. After both migrations, run `pnpm gen:types` to regenerate types, then update docs.

**Tech Stack:** PostgreSQL migrations (idempotent SQL), Next.js API route (TypeScript), Vitest, pnpm monorepo.

## Global Constraints

- Migrations must be timestamped `YYYYMMDDHHMMSS_*.sql`, idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `CREATE OR REPLACE`, `IF EXISTS` guards).
- Next timestamp slot after current latest (`20260629200000_f6_analytics_events.sql`): use `20260629210000` (B4) and `20260629220000` (B1).
- `pnpm typecheck && pnpm test && pnpm lint` must stay green.
- i18n: no UI copy changes needed; no new strings.
- No RLS changes.
- Branch: `feat/hardening-batch-3`. Two atomic commits: `feat(B4): ...` and `feat(B1): ...`. Then docs commit.
- Rate limiter reads IP from the **HTTP request**, not from the DB — removing `ip_address` from the DB write is safe.

---

### Task 1: B4 — Anonymise `advert_views.ip_address` (migration + route)

**Files:**
- Create: `supabase/migrations/20260629210000_b4_anonymise_advert_views_ip.sql`
- Modify: `apps/web/src/app/api/adverts/[id]/view/route.ts`
- Modify: `apps/web/src/app/api/adverts/[id]/view/__tests__/view-route.test.ts`

**Interfaces:**
- Consumes: `advert_views` table with `ip_address inet` column (from `20251107010000_views_favorites_top_sellers.sql`)
- Produces: existing rows anonymised (IPv4 → /24, IPv6 → /48); new rows no longer receive `ip_address`; a test assertion verifies `ip_address` is absent from the upsert payload

- [ ] **Step 1: Write the failing test**

Add a new `it` block in `apps/web/src/app/api/adverts/[id]/view/__tests__/view-route.test.ts`, inside the existing `describe` block, after the last `it`:

```typescript
it("does not write raw ip_address to advert_views (B4 GDPR)", async () => {
  getUserMock.mockResolvedValue({ data: { user: null } });
  await POST(makeReq(), makeCtx());

  const [row] = upsertMock.mock.calls[0] as [Record<string, unknown>, unknown];
  expect(row).not.toHaveProperty("ip_address");
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test -- --run apps/web/src/app/api/adverts/\\[id\\]/view/__tests__/view-route.test.ts
```

Expected: FAIL — `received object: { advert_id, user_id, ip_address, user_agent, viewer_key, view_hour }` contains `ip_address`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260629210000_b4_anonymise_advert_views_ip.sql`:

```sql
-- B4: Anonymise ip_address in advert_views (GDPR — plaintext PII removal).
--
-- The raw IP is no longer needed: viewer dedup uses viewer_key (md5 hash for
-- anonymous visitors) from F11. Rate limiting reads IP from the HTTP request
-- at runtime — not from the database.
--
-- Strategy:
--   1. Anonymise existing rows:
--        IPv4  → /24 mask  (zero the last octet,   e.g. 1.2.3.4   → 1.2.3.0)
--        IPv6  → /48 mask  (zero bytes 7–16,        e.g. 2001:db8::1 → 2001:db8::)
--        NULL  → stays NULL
--   2. New rows will no longer receive ip_address (removed from the API route).
--      The column is kept (nullable) so the table DDL stays stable; all new
--      rows land with ip_address = NULL.

-- Guard: skip if already anonymised (idempotent re-run safety).
-- We detect "not yet anonymised" as: any row has a host-bits address narrower
-- than /24 (IPv4) or /48 (IPv6). The UPDATE below is a no-op when all rows
-- already carry the truncated form.

UPDATE public.advert_views
SET ip_address =
  CASE
    -- IPv4: zero last octet (host(ip) strips mask; network() applies /24)
    WHEN family(ip_address) = 4
      THEN network(set_masklen(ip_address::inet, 24))::inet
    -- IPv6: apply /48 prefix
    WHEN family(ip_address) = 6
      THEN network(set_masklen(ip_address::inet, 48))::inet
    ELSE NULL
  END
WHERE ip_address IS NOT NULL
  AND (
    -- IPv4 not yet a /24 network address (host bits non-zero past octet 3)
    (family(ip_address) = 4 AND ip_address != network(set_masklen(ip_address, 24))::inet)
    OR
    -- IPv6 not yet a /48 network address
    (family(ip_address) = 6 AND ip_address != network(set_masklen(ip_address, 48))::inet)
  );

COMMENT ON COLUMN public.advert_views.ip_address IS
  'Anonymised visitor IP (/24 for IPv4, /48 for IPv6). Raw IPs were removed 2026-06-29 (B4/GDPR). New rows have NULL here; dedup uses viewer_key instead.';
```

- [ ] **Step 4: Remove `ip_address` from the view route upsert**

In `apps/web/src/app/api/adverts/[id]/view/route.ts`, remove `ip_address: ip ?? null,` from the upsert payload. The upsert object (lines ~89–102) should become:

```typescript
  const { error: insertError } = await service.from("advert_views").upsert(
    {
      advert_id: advertId,
      user_id: user?.id ?? null,
      user_agent: userAgent,
      viewer_key: viewerKey,
      view_hour: viewHour,
    },
    {
      onConflict: "advert_id,viewer_key,view_hour",
      ignoreDuplicates: true,
    },
  );
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
pnpm test -- --run apps/web/src/app/api/adverts/\\[id\\]/view/__tests__/view-route.test.ts
```

Expected: all 6 tests PASS (5 existing + 1 new B4 test).

- [ ] **Step 6: Run full check**

```bash
pnpm typecheck && pnpm test && pnpm lint
```

Expected: all green.

- [ ] **Step 7: Commit B4**

```bash
git add supabase/migrations/20260629210000_b4_anonymise_advert_views_ip.sql \
        apps/web/src/app/api/adverts/\[id\]/view/route.ts \
        apps/web/src/app/api/adverts/\[id\]/view/__tests__/view-route.test.ts
git commit -m "feat(B4): anonymise advert_views.ip_address — GDPR (no raw IPv4/IPv6 in DB)"
```

---

### Task 2: B1 — UNIQUE(reviewer_id, subject_id) on reviews (migration)

**Files:**
- Create: `supabase/migrations/20260629220000_b1_reviews_unique_reviewer_subject.sql`

**Interfaces:**
- Consumes: `reviews` table with existing unique constraint `(advert_id, reviewer_id)`; F14 migration's `create_review()` already has an application-level EXISTS guard for (reviewer_id, subject_id)
- Produces: DB-level `UNIQUE(reviewer_id, subject_id)` constraint; any duplicate (reviewer_id, subject_id) pairs from the same seller on different adverts are resolved by keeping the newest row (MAX(created_at)); COUNT of deleted duplicates emitted as a `RAISE NOTICE` for audit

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260629220000_b1_reviews_unique_reviewer_subject.sql`:

```sql
-- B1: Add UNIQUE(reviewer_id, subject_id) constraint on reviews.
--
-- Background: F14 added an application-level EXISTS guard so create_review()
-- already prevents duplicate (reviewer_id, subject_id) pairs. This migration
-- adds the matching DB-level constraint so the guarantee is enforced even if
-- the function is replaced in the future.
--
-- Safe dedup procedure (no legitimate reviews are harmed):
--   A "duplicate" is any (reviewer_id, subject_id) pair that appears more than
--   once. We keep the row with the latest created_at and delete the earlier
--   extras. If two rows share the same created_at we keep the one with the
--   smaller id (arbitrary but deterministic).
--
-- Idempotent: the constraint is added with IF NOT EXISTS logic via a DO block
-- that skips the ALTER TABLE when the constraint already exists.

do $$
declare
  v_deleted int;
begin

  -- 1. Dedup: delete rows that are NOT the "keeper" for their (reviewer_id, subject_id) pair.
  --    Keeper = latest created_at; tie-break = smallest id (UUID string order).
  with keepers as (
    select distinct on (reviewer_id, subject_id)
           id
    from   public.reviews
    order  by reviewer_id, subject_id, created_at desc, id asc
  ),
  deleted as (
    delete from public.reviews
    where  id not in (select id from keepers)
      and  exists (
        -- Only delete where there actually IS a duplicate for this pair
        select 1
        from   public.reviews r2
        where  r2.reviewer_id = public.reviews.reviewer_id
          and  r2.subject_id  = public.reviews.subject_id
          and  r2.id         != public.reviews.id
      )
    returning id
  )
  select count(*) into v_deleted from deleted;

  raise notice 'B1 dedup: % duplicate review row(s) deleted', v_deleted;

  -- 2. Add the unique constraint if it does not already exist.
  if not exists (
    select 1
    from   pg_constraint
    where  conrelid = 'public.reviews'::regclass
      and  conname  = 'reviews_unique_reviewer_subject'
  ) then
    alter table public.reviews
      add constraint reviews_unique_reviewer_subject
      unique (reviewer_id, subject_id);
  end if;

end;
$$;

comment on constraint reviews_unique_reviewer_subject on public.reviews is
  'One review per reviewer–seller pair (cross-advert). Enforces F14 anti-stacking at DB level. B1 hardening 2026-06-29.';
```

- [ ] **Step 2: Run full check**

```bash
pnpm typecheck && pnpm test && pnpm lint
```

Expected: all green. (No TypeScript or test changes needed — the migration only adds a DB constraint; no TS code paths change.)

- [ ] **Step 3: Commit B1**

```bash
git add supabase/migrations/20260629220000_b1_reviews_unique_reviewer_subject.sql
git commit -m "feat(B1): UNIQUE(reviewer_id, subject_id) on reviews — DB-level anti-stacking after safe dedup"
```

---

### Historical documentation note

The original plan ended by updating a now-retired tracker. That instruction has been removed. Generated types and the GDPR PRD remain technical references; current completion status and any follow-up work must be recorded only in `docs/MASTER_PRODUCTION_TZ.md`.

---

## Self-Review

**Spec coverage:**
- B4: migration anonymises existing rows ✓; removes raw IP write from route ✓; test asserts ip_address absent from upsert ✓; 41-gdpr-legal.md updated ✓
- B1: dedup keeps MAX(created_at) per pair ✓; deletes only extras ✓; NOTICE emits count ✓; UNIQUE constraint added idempotently ✓; §13 updated ✓
- Rate-limit not affected (reads from request, not DB) ✓
- i18n: no UI copy — no locale changes needed ✓
- typecheck+test+lint verified at each task ✓

**Placeholder scan:** None found.

**Type consistency:** No new TypeScript types introduced; `gen:types` handles any schema reflection.
