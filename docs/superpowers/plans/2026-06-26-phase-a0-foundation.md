# Phase A0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the company-free dependency root for all of Phase A0 — the account/business data model plus the Decision-3 capability-flag registry and provider-adapter seams — so every later A0 feature (business onboarding, public profiles, anti-fraud) has a foundation, and every Phase-B capability can be switched on later by adding a credential and flipping a flag.

**Architecture:** Two cohesive subsystems. (A) Pure-TypeScript capability flags + provider-adapter interfaces (env-driven, default OFF) — the activation seam from Decision 3. (B) Additive Supabase migrations introducing `businesses`, `business_members`, `verifications`, `kyc_records`, `badges_awarded`, plus `profiles.seller_type` and `adverts.business_id`, with RLS enabled on every new table, a `create_business()` bootstrap RPC, and a verifications→booleans sync trigger. Schema is complete from day one (Phase-B columns included); nothing changes existing runtime behavior (all flags OFF; new columns default to today's semantics).

**Tech Stack:** Next.js 16 App Router · TypeScript · Supabase (Postgres + RLS) applied via `psql`/`SUPABASE_DB_URL` · Vitest · libphonenumber already in tree.

## Global Constraints

- **DB changes apply to the LIVE prod Supabase DB via `psql` + `SUPABASE_DB_URL` from `.env.local`.** Never `supabase db push`. Never echo the secret. Load it without printing: `set -a; source /c/LyvoxMarketPlace/.env.local; set +a` then reference `"$SUPABASE_DB_URL"`.
- **Migration apply & verify protocol (every migration task uses this):**
  1. Write the migration file at `supabase/migrations/<UTC-timestamp>_<name>.sql`. Make it idempotent: `create table if not exists`, `drop policy if exists … ; create policy …`, `create or replace function`.
  2. **Dry-run in a ROLLED-BACK transaction** (this is the test gate — it proves the DDL applies and the assertions pass without committing):
     `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1 <<'SQL'` … `\i supabase/migrations/<file>.sql` … `<verification SELECTs that RAISE on failure>` … `ROLLBACK;` … `SQL`
  3. Only after the dry-run is clean, **apply for real**: `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/<file>.sql`
  4. Hand-edit `supabase/types/database.types.ts` to add the new tables/columns (Row/Insert/Update), then run `( cd apps/web && pnpm exec tsc -p tsconfig.json --noEmit )` clean.
- **Never stage `.claude/` or `.env*`.** Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Verification-row status is the source of truth; the booleans (`verified_email`/`verified_phone`/`itsme_verified`/`entity_verified`) are denormalized read-caches kept in sync by a trigger (§6.4 of the spec).**
- **Canonical names (Decision 2, verbatim):** `profiles.seller_type ENUM('individual','business')`; `businesses` + `business_members`; `verifications`; `kyc_records`; `badges_awarded`. No linear status enum; suspension is an overlay.
- **Capability flags default OFF/free (Decision 3).** No new runtime behavior ships enabled in this plan.
- Tests run from repo root: `pnpm test`. Typecheck: `( cd apps/web && pnpm exec tsc -p tsconfig.json --noEmit )`. Build before any deploy: `( cd apps/web && pnpm exec next build )`.
- Spec reference (canonical DDL/RLS): `docs/superpowers/specs/2026-06-26-marketplace-accounts-trust-design.md` §6.

---

## Task 1: Capability-flag registry

**Files:**
- Create: `apps/web/src/lib/capabilities.ts`
- Test: `apps/web/src/lib/__tests__/capabilities.test.ts`

**Interfaces:**
- Produces: `type Capability = 'pro_subscriptions' | 'stripe_identity' | 'itsme' | 'whatsapp_otp' | 'payments_escrow'`; `function isCapabilityEnabled(cap: Capability, env?: NodeJS.ProcessEnv): boolean` (reads `CAPABILITY_<UPPER>` env, default `false`); `const CAPABILITY_ENV: Record<Capability,string>`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/__tests__/capabilities.test.ts
import { describe, it, expect } from "vitest";
import { isCapabilityEnabled, CAPABILITY_ENV } from "@/lib/capabilities";

describe("capability flags", () => {
  it("defaults every capability to OFF when env is empty", () => {
    const env = {} as NodeJS.ProcessEnv;
    for (const cap of Object.keys(CAPABILITY_ENV) as (keyof typeof CAPABILITY_ENV)[]) {
      expect(isCapabilityEnabled(cap, env)).toBe(false);
    }
  });
  it("treats only the literal string 'true' as enabled", () => {
    expect(isCapabilityEnabled("itsme", { CAPABILITY_ITSME: "true" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isCapabilityEnabled("itsme", { CAPABILITY_ITSME: "1" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isCapabilityEnabled("itsme", { CAPABILITY_ITSME: "TRUE" } as NodeJS.ProcessEnv)).toBe(false);
  });
  it("maps each capability to its CAPABILITY_* env name", () => {
    expect(CAPABILITY_ENV.payments_escrow).toBe("CAPABILITY_PAYMENTS_ESCROW");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test capabilities`
Expected: FAIL — cannot resolve `@/lib/capabilities`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/capabilities.ts
/**
 * Decision 3 (activation-ready): every company-gated capability is built now but
 * gated OFF here. Flip a capability on by setting its CAPABILITY_* env var to the
 * literal string "true" (in Vercel/.env) — no code change, no deploy.
 */
export type Capability =
  | "pro_subscriptions"
  | "stripe_identity"
  | "itsme"
  | "whatsapp_otp"
  | "payments_escrow";

export const CAPABILITY_ENV: Record<Capability, string> = {
  pro_subscriptions: "CAPABILITY_PRO_SUBSCRIPTIONS",
  stripe_identity: "CAPABILITY_STRIPE_IDENTITY",
  itsme: "CAPABILITY_ITSME",
  whatsapp_otp: "CAPABILITY_WHATSAPP_OTP",
  payments_escrow: "CAPABILITY_PAYMENTS_ESCROW",
};

export function isCapabilityEnabled(
  cap: Capability,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env[CAPABILITY_ENV[cap]] === "true";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test capabilities`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/capabilities.ts apps/web/src/lib/__tests__/capabilities.test.ts
git commit -m "feat(foundation): capability-flag registry (Decision 3, default OFF)"
```

---

## Task 2: Provider-adapter seams (identity / OTP / payments)

**Files:**
- Create: `apps/web/src/lib/adapters/types.ts`
- Create: `apps/web/src/lib/adapters/index.ts`
- Test: `apps/web/src/lib/adapters/__tests__/adapters.test.ts`

**Interfaces:**
- Consumes: `isCapabilityEnabled`, `Capability` (Task 1).
- Produces: `interface IdentityAdapter { verify(input:{subjectId:string}): Promise<{status:"unsupported"}> }`, `interface OtpAdapter { send(input:{toE164:string}): Promise<{status:"unsupported"}> }`, `interface PaymentsAdapter { createPayout(input:{businessId:string;amountCents:number}): Promise<{status:"unsupported"}> }`; `function getIdentityAdapter(): IdentityAdapter | null` (null when its capability is OFF); same for `getOtpAdapter()`, `getPaymentsAdapter()`. The seam exists now; concrete providers are wired in Phase B by replacing the disabled default and flipping the flag.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/adapters/__tests__/adapters.test.ts
import { describe, it, expect } from "vitest";
import { getIdentityAdapter, getOtpAdapter, getPaymentsAdapter } from "@/lib/adapters";

describe("provider adapter seams", () => {
  it("returns null for every adapter when its capability is OFF (default)", () => {
    const env = {} as NodeJS.ProcessEnv;
    expect(getIdentityAdapter(env)).toBeNull();
    expect(getOtpAdapter(env)).toBeNull();
    expect(getPaymentsAdapter(env)).toBeNull();
  });
  it("returns the disabled default adapter when the capability is ON but no provider is wired", async () => {
    const env = { CAPABILITY_STRIPE_IDENTITY: "true" } as NodeJS.ProcessEnv;
    const adapter = getIdentityAdapter(env);
    expect(adapter).not.toBeNull();
    await expect(adapter!.verify({ subjectId: "u1" })).resolves.toEqual({ status: "unsupported" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test adapters`
Expected: FAIL — cannot resolve `@/lib/adapters`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/adapters/types.ts
export interface IdentityAdapter {
  verify(input: { subjectId: string }): Promise<{ status: "unsupported" | "started" | "verified" | "failed" }>;
}
export interface OtpAdapter {
  send(input: { toE164: string }): Promise<{ status: "unsupported" | "sent" | "failed" }>;
}
export interface PaymentsAdapter {
  createPayout(input: { businessId: string; amountCents: number }): Promise<{ status: "unsupported" | "queued" | "failed" }>;
}
```

```ts
// apps/web/src/lib/adapters/index.ts
import { isCapabilityEnabled, type Capability } from "@/lib/capabilities";
import type { IdentityAdapter, OtpAdapter, PaymentsAdapter } from "./types";

// Disabled defaults: the seam is live, but until a real provider is wired in Phase B
// (a contract + credentials), every call resolves "unsupported". Swapping in a provider
// = replace the default below + flip the capability flag; call sites never change.
const disabledIdentity: IdentityAdapter = { verify: async () => ({ status: "unsupported" }) };
const disabledOtp: OtpAdapter = { send: async () => ({ status: "unsupported" }) };
const disabledPayments: PaymentsAdapter = { createPayout: async () => ({ status: "unsupported" }) };

function gated<T>(cap: Capability, adapter: T, env: NodeJS.ProcessEnv): T | null {
  return isCapabilityEnabled(cap, env) ? adapter : null;
}

export function getIdentityAdapter(env: NodeJS.ProcessEnv = process.env): IdentityAdapter | null {
  return gated("stripe_identity", disabledIdentity, env);
}
export function getOtpAdapter(env: NodeJS.ProcessEnv = process.env): OtpAdapter | null {
  return gated("whatsapp_otp", disabledOtp, env);
}
export function getPaymentsAdapter(env: NodeJS.ProcessEnv = process.env): PaymentsAdapter | null {
  return gated("payments_escrow", disabledPayments, env);
}

export type { IdentityAdapter, OtpAdapter, PaymentsAdapter } from "./types";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test adapters`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/adapters
git commit -m "feat(foundation): provider-adapter seams (identity/otp/payments), disabled by default"
```

---

## Task 3: Migration — `businesses` + `business_members` + helper + RPC + RLS

**Files:**
- Create: `supabase/migrations/20260626170000_businesses_core.sql`
- Modify: `supabase/types/database.types.ts` (add `businesses`, `business_members` rows/insert/update)

**Interfaces:**
- Produces (SQL): tables `public.businesses`, `public.business_members`; functions `public.normalize_kbo(text) returns text`, `public.is_business_member(uuid, text default 'member') returns boolean`, `public.create_business(p_legal_name text, p_kbo text, p_vat text) returns uuid`. Consumed by Tasks 4–7 and later onboarding.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260626170000_businesses_core.sql
-- Phase A0 foundation: business legal entity + team + bootstrap RPC. Spec §6.2, §6.3, §6.8.

create or replace function public.normalize_kbo(p text)
  returns text language sql immutable as $$
  select case when p is null then null else regexp_replace(p, '[^0-9]', '', 'g') end;
$$;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  legal_form text,
  kbo_number text unique,
  vat_number text unique,
  vat_liable boolean not null default false,
  email text not null,
  phone_e164 text,
  address_line text, postcode text, city text, country text default 'BE',
  status text not null default 'draft' check (status in ('draft','active','suspended')),
  entity_verified boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_vat_format check (vat_number is null or validate_belgian_vat(vat_number)),
  constraint businesses_kbo_format check (kbo_number is null or kbo_number ~ '^[01][0-9]{9}$')
);
alter table public.businesses enable row level security;
drop trigger if exists set_updated_at_businesses on public.businesses;
create trigger set_updated_at_businesses before update on public.businesses
  for each row execute function public.set_updated_at();

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
alter table public.business_members enable row level security;

create or replace function public.is_business_member(b_id uuid, min_role text default 'member')
  returns boolean language sql security definer stable
  set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = b_id and m.user_id = auth.uid() and m.accepted_at is not null
      and case m.role when 'owner' then 3 when 'admin' then 2 else 1 end
        >= case min_role when 'owner' then 3 when 'admin' then 2 else 1 end);
$$;

create or replace function public.create_business(p_legal_name text, p_kbo text, p_vat text)
  returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  insert into public.businesses (legal_name, kbo_number, vat_number, email, created_by, status)
    values (p_legal_name, public.normalize_kbo(p_kbo), p_vat,
            (select email from auth.users where id = auth.uid()), auth.uid(), 'draft')
    returning id into v_id;
  insert into public.business_members (business_id, user_id, role, accepted_at)
    values (v_id, auth.uid(), 'owner', now());
  return v_id;
end; $$;

-- businesses RLS
drop policy if exists biz_public_read on public.businesses;
create policy biz_public_read on public.businesses for select using (status = 'active');
drop policy if exists biz_member_read on public.businesses;
create policy biz_member_read on public.businesses for select to authenticated using (is_business_member(id));
drop policy if exists biz_owner_write on public.businesses;
create policy biz_owner_write on public.businesses for update to authenticated
  using (is_business_member(id,'owner') or created_by = auth.uid())
  with check (is_business_member(id,'owner') or created_by = auth.uid());
drop policy if exists biz_admin_all on public.businesses;
create policy biz_admin_all on public.businesses for all using (is_admin()) with check (is_admin());

-- business_members RLS
drop policy if exists bm_self_read on public.business_members;
create policy bm_self_read on public.business_members for select to authenticated
  using (user_id = auth.uid() or is_business_member(business_id,'member'));
drop policy if exists bm_invitee_accept on public.business_members;
create policy bm_invitee_accept on public.business_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = (select b.role from public.business_members b
            where b.business_id = business_members.business_id and b.user_id = auth.uid()));
drop policy if exists bm_admin_manage on public.business_members;
create policy bm_admin_manage on public.business_members for insert to authenticated
  with check (is_business_member(business_id,'admin') and role <> 'owner');
drop policy if exists bm_admin_remove on public.business_members;
create policy bm_admin_remove on public.business_members for delete to authenticated
  using (is_business_member(business_id,'admin') and role <> 'owner');
drop policy if exists bm_admin_all on public.business_members;
create policy bm_admin_all on public.business_members for all using (is_admin()) with check (is_admin());
```

- [ ] **Step 2: Dry-run in a rolled-back transaction (the test gate)**

```bash
set -a; source /c/LyvoxMarketPlace/.env.local; set +a
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1 <<'SQL'
\i supabase/migrations/20260626170000_businesses_core.sql
do $$ begin
  if not (select relrowsecurity from pg_class where oid='public.businesses'::regclass) then raise exception 'businesses RLS not enabled'; end if;
  if not (select relrowsecurity from pg_class where oid='public.business_members'::regclass) then raise exception 'business_members RLS not enabled'; end if;
  if (select count(*) from pg_policies where tablename='businesses') < 4 then raise exception 'businesses policies missing'; end if;
  if (select count(*) from pg_policies where tablename='business_members') < 5 then raise exception 'business_members policies missing'; end if;
  perform public.normalize_kbo('0123.456.749');
  if public.normalize_kbo('0123.456.749') <> '0123456749' then raise exception 'normalize_kbo wrong'; end if;
end $$;
ROLLBACK;
SQL
```
Expected: prints the `\i` notices then `ROLLBACK`, **no exception**. Any `raise exception` aborts (ON_ERROR_STOP) → fix and re-run.

- [ ] **Step 3: Apply for real**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/20260626170000_businesses_core.sql
```
Expected: completes with no error (`CREATE TABLE`, `CREATE FUNCTION`, `CREATE POLICY` …).

- [ ] **Step 4: Hand-edit types + typecheck**

Add to `supabase/types/database.types.ts` under `Tables` the `businesses` and `business_members` entries (Row/Insert/Update matching the columns above; `Insert` makes defaulted/nullable columns optional). Then:
Run: `( cd apps/web && pnpm exec tsc -p tsconfig.json --noEmit )`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260626170000_businesses_core.sql supabase/types/database.types.ts
git commit -m "feat(foundation): businesses + business_members tables, is_business_member, create_business RPC, RLS"
```

---

## Task 4: Migration — `profiles.seller_type` + `adverts.business_id` + `'withdrawn'` + adverts team RLS

**Files:**
- Create: `supabase/migrations/20260626171000_seller_type_and_advert_business.sql`
- Modify: `supabase/types/database.types.ts` (add `seller_type` to profiles; `business_id` to adverts)

**Interfaces:**
- Consumes: `public.businesses` (Task 3), `is_business_member` (Task 3).
- Produces: column `profiles.seller_type text not null default 'individual'`; column `adverts.business_id uuid null references businesses(id) on delete restrict`; adverts status value `'withdrawn'` permitted; verb-split adverts team RLS.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260626171000_seller_type_and_advert_business.sql
-- Spec §6.1, §6.8. Additive + behavior-preserving (default 'individual'; business_id NULL = today's private listing).

alter table public.profiles
  add column if not exists seller_type text not null default 'individual'
    check (seller_type in ('individual','business'));

alter table public.adverts
  add column if not exists business_id uuid references public.businesses(id) on delete restrict;

-- allow a 'withdrawn' status without disturbing existing values. If adverts.status has a CHECK,
-- this migration must widen it; if it is free text, this is a no-op guard. Inspect first:
do $$
declare conname text;
begin
  select c.conname into conname from pg_constraint c
   where c.conrelid='public.adverts'::regclass and c.contype='c'
     and pg_get_constraintdef(c.oid) ilike '%status%';
  if conname is not null then
    execute format('alter table public.adverts drop constraint %I', conname);
  end if;
end $$;
-- Re-add a status CHECK that includes the prior values plus 'withdrawn'.
-- NOTE: confirm the exact existing status vocabulary with:
--   select distinct status from public.adverts;
-- and include every value found below before applying.
alter table public.adverts
  add constraint adverts_status_check
  check (status in ('draft','active','sold','archived','withdrawn'));

-- adverts team RLS (business path). Keep existing owner=user_id policies untouched.
drop policy if exists adv_team_read on public.adverts;
create policy adv_team_read on public.adverts for select to authenticated
  using (business_id is not null and is_business_member(business_id,'member'));
drop policy if exists adv_team_insert on public.adverts;
create policy adv_team_insert on public.adverts for insert to authenticated
  with check (business_id is not null and is_business_member(business_id,'member') and user_id = auth.uid());
drop policy if exists adv_team_update on public.adverts;
create policy adv_team_update on public.adverts for update to authenticated
  using (business_id is not null and is_business_member(business_id,'member'))
  with check (business_id is not null and is_business_member(business_id,'member'));
drop policy if exists adv_team_delete on public.adverts;
create policy adv_team_delete on public.adverts for delete to authenticated
  using (business_id is not null and is_business_member(business_id,'admin'));
```

- [ ] **Step 2: Inspect existing status vocabulary, then dry-run**

```bash
set -a; source /c/LyvoxMarketPlace/.env.local; set +a
psql "$SUPABASE_DB_URL" -At -c "select distinct status from public.adverts order by 1;"
```
Edit the `adverts_status_check` list in the migration to include EVERY value printed (plus `'withdrawn'`). Then:
```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1 <<'SQL'
\i supabase/migrations/20260626171000_seller_type_and_advert_business.sql
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='seller_type') then raise exception 'seller_type missing'; end if;
  if not exists (select 1 from information_schema.columns where table_name='adverts' and column_name='business_id') then raise exception 'business_id missing'; end if;
  if (select count(*) from pg_policies where tablename='adverts' and policyname like 'adv_team_%') <> 4 then raise exception 'adverts team policies missing'; end if;
end $$;
ROLLBACK;
SQL
```
Expected: no exception.

- [ ] **Step 3: Apply for real**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/20260626171000_seller_type_and_advert_business.sql
```

- [ ] **Step 4: Hand-edit types + typecheck**

Add `seller_type: string` to profiles Row (and optional in Insert/Update); add `business_id: string | null` to adverts Row (optional in Insert/Update) in `supabase/types/database.types.ts`. Then `( cd apps/web && pnpm exec tsc -p tsconfig.json --noEmit )` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260626171000_seller_type_and_advert_business.sql supabase/types/database.types.ts
git commit -m "feat(foundation): profiles.seller_type + adverts.business_id (RESTRICT) + withdrawn status + adverts team RLS"
```

---

## Task 5: Migration — `verifications` + booleans-sync trigger + backfill + RLS

**Files:**
- Create: `supabase/migrations/20260626172000_verifications.sql`
- Modify: `supabase/types/database.types.ts` (add `verifications`)

**Interfaces:**
- Consumes: `is_business_member`, `is_admin`.
- Produces: table `public.verifications`; trigger `sync_verification_caches` keeping `profiles.verified_email/verified_phone/itsme_verified` and `businesses.entity_verified` in sync.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260626172000_verifications.sql  (Spec §6.4, §6.8)
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user','business')),
  subject_id uuid not null,
  method text not null check (method in ('email','phone','itsme','eid','kbo','vies','manual')),
  status text not null default 'pending' check (status in ('pending','verified','failed','expired','revoked')),
  evidence jsonb,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.verifications enable row level security;
create unique index if not exists uq_ver_active on public.verifications(subject_type, subject_id, method)
  where status in ('pending','verified');

-- Cache-sync: recompute the relevant boolean from the latest verified row for (subject, method).
create or replace function public.sync_verification_caches()
  returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare s_type text; s_id uuid; m text; is_ver boolean;
begin
  s_type := coalesce(new.subject_type, old.subject_type);
  s_id   := coalesce(new.subject_id, old.subject_id);
  m      := coalesce(new.method, old.method);
  is_ver := exists (select 1 from public.verifications v
                    where v.subject_type=s_type and v.subject_id=s_id and v.method=m and v.status='verified');
  if s_type='user' then
    if m='email' then update public.profiles set verified_email=is_ver where id=s_id;
    elsif m='phone' then update public.profiles set verified_phone=is_ver where id=s_id;
    elsif m in ('itsme','eid') then update public.profiles set itsme_verified=is_ver where id=s_id;
    end if;
  elsif s_type='business' then
    if m in ('kbo','vies') then
      update public.businesses set entity_verified=
        exists (select 1 from public.verifications v where v.subject_type='business' and v.subject_id=s_id
                and v.method in ('kbo','vies') and v.status='verified')
        where id=s_id;
    end if;
  end if;
  return null;
end; $$;
drop trigger if exists trg_sync_verification_caches on public.verifications;
create trigger trg_sync_verification_caches
  after insert or update or delete on public.verifications
  for each row execute function public.sync_verification_caches();

-- Backfill: seed verified rows from the existing booleans so the ledger is the source of truth going forward.
insert into public.verifications (subject_type, subject_id, method, status, verified_at)
  select 'user', id, 'email', 'verified', now() from public.profiles where coalesce(verified_email,false)
  on conflict do nothing;
insert into public.verifications (subject_type, subject_id, method, status, verified_at)
  select 'user', id, 'phone', 'verified', now() from public.profiles where coalesce(verified_phone,false)
  on conflict do nothing;
insert into public.verifications (subject_type, subject_id, method, status, verified_at)
  select 'user', id, 'itsme', 'verified', now() from public.profiles where coalesce(itsme_verified,false)
  on conflict do nothing;

-- RLS: owner-of-subject + admin; never public.
drop policy if exists ver_owner_read on public.verifications;
create policy ver_owner_read on public.verifications for select to authenticated using (
  (subject_type='user' and subject_id = auth.uid())
  or (subject_type='business' and is_business_member(subject_id,'admin')));
drop policy if exists ver_admin_all on public.verifications;
create policy ver_admin_all on public.verifications for all using (is_admin()) with check (is_admin());
```

- [ ] **Step 2: Dry-run (rolled back) with a sync-trigger assertion**

```bash
set -a; source /c/LyvoxMarketPlace/.env.local; set +a
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1 <<'SQL'
\i supabase/migrations/20260626172000_verifications.sql
do $$
declare uid uuid;
begin
  if not (select relrowsecurity from pg_class where oid='public.verifications'::regclass) then raise exception 'verifications RLS off'; end if;
  select id into uid from public.profiles limit 1;
  if uid is not null then
    update public.profiles set verified_phone=false where id=uid;
    insert into public.verifications(subject_type,subject_id,method,status,verified_at) values('user',uid,'phone','verified',now())
      on conflict (subject_type,subject_id,method) where status in ('pending','verified') do update set status='verified';
    if not (select verified_phone from public.profiles where id=uid) then raise exception 'sync trigger did not set verified_phone'; end if;
  end if;
end $$;
ROLLBACK;
SQL
```
Expected: no exception (the trigger flipped the cache true).

- [ ] **Step 3: Apply for real**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/20260626172000_verifications.sql
```

- [ ] **Step 4: Reconciliation check + types + typecheck**

```bash
psql "$SUPABASE_DB_URL" -At -c "select count(*) from public.profiles p where coalesce(p.verified_phone,false) <> exists(select 1 from public.verifications v where v.subject_type='user' and v.subject_id=p.id and v.method='phone' and v.status='verified');"
```
Expected: `0` (no cache disagrees with the ledger). Add `verifications` to `database.types.ts`; `( cd apps/web && pnpm exec tsc -p tsconfig.json --noEmit )` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260626172000_verifications.sql supabase/types/database.types.ts
git commit -m "feat(foundation): verifications ledger + booleans-sync trigger + backfill + RLS"
```

---

## Task 6: Migration — `kyc_records` (GDPR-isolated) + RLS + orphan cleanup

**Files:**
- Create: `supabase/migrations/20260626173000_kyc_records.sql`
- Modify: `supabase/types/database.types.ts` (add `kyc_records`)

**Interfaces:**
- Consumes: `is_business_member`, `is_admin`.
- Produces: table `public.kyc_records` (storage-refs only, never inline PII), strict owner/admin RLS, and a cleanup trigger removing rows when a business is deleted (orphan/GDPR safety per spec §6.5 "minimum" fix).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260626173000_kyc_records.sql  (Spec §6.5, §6.8)
create table if not exists public.kyc_records (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user','business')),
  subject_id uuid not null,
  data_class text not null check (data_class in ('dsa_trader_copy','id_document','eid_attributes','aml_screen')),
  document_ref text,
  meta jsonb,
  legal_basis text check (legal_basis in ('consumer_law','dsa_art30','dac7','consent')),
  retention_until timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.kyc_records enable row level security;
create index if not exists kyc_subject_idx on public.kyc_records(subject_type, subject_id);

-- Orphan cleanup (polymorphic table has no FK cascade): drop dependent rows on business delete.
create or replace function public.cleanup_kyc_on_business_delete()
  returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  delete from public.kyc_records where subject_type='business' and subject_id = old.id;
  delete from public.verifications where subject_type='business' and subject_id = old.id;
  delete from public.badges_awarded where subject_type='business' and subject_id = old.id;
  return old;
end; $$;
drop trigger if exists trg_cleanup_business_subjects on public.businesses;
create trigger trg_cleanup_business_subjects before delete on public.businesses
  for each row execute function public.cleanup_kyc_on_business_delete();

drop policy if exists kyc_owner_read on public.kyc_records;
create policy kyc_owner_read on public.kyc_records for select to authenticated using (
  (subject_type='user' and subject_id = auth.uid())
  or (subject_type='business' and is_business_member(subject_id,'owner')));
drop policy if exists kyc_admin_all on public.kyc_records;
create policy kyc_admin_all on public.kyc_records for all using (is_admin()) with check (is_admin());
```

> NOTE: `badges_awarded` is referenced by the cleanup trigger but created in Task 7. Apply Task 6 **before** Task 7 is fine because the trigger body is only parsed at call time (plpgsql late-binding), but to avoid a delete-time error before Task 7 lands, **run Task 7 in the same session/PR**; the cleanup trigger is exercised only on a business delete, which does not happen during these migrations.

- [ ] **Step 2: Dry-run (rolled back)**

```bash
set -a; source /c/LyvoxMarketPlace/.env.local; set +a
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1 <<'SQL'
\i supabase/migrations/20260626173000_kyc_records.sql
do $$ begin
  if not (select relrowsecurity from pg_class where oid='public.kyc_records'::regclass) then raise exception 'kyc RLS off'; end if;
  if (select count(*) from pg_policies where tablename='kyc_records') < 2 then raise exception 'kyc policies missing'; end if;
end $$;
ROLLBACK;
SQL
```
Expected: no exception.

- [ ] **Step 3: Apply for real**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/20260626173000_kyc_records.sql
```

- [ ] **Step 4: Anon-lockdown smoke check + types + typecheck**

```bash
psql "$SUPABASE_DB_URL" -At -c "select count(*) from pg_policies where tablename='kyc_records' and policyname='kyc_owner_read';"
```
Expected: `1` (read is owner/admin-scoped; there is NO `using(true)` select policy → anon/logged-out sees zero rows). Add `kyc_records` to `database.types.ts`; typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260626173000_kyc_records.sql supabase/types/database.types.ts
git commit -m "feat(foundation): kyc_records (GDPR-isolated, RLS-locked) + business-subject orphan cleanup"
```

---

## Task 7: Migration — `badges_awarded` + RLS

**Files:**
- Create: `supabase/migrations/20260626174000_badges_awarded.sql`
- Modify: `supabase/types/database.types.ts` (add `badges_awarded`)

**Interfaces:**
- Produces: table `public.badges_awarded` (manual non-derivable badges only; everything else derived at read time — Task 8).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260626174000_badges_awarded.sql  (Spec §6.6, §6.8)
create table if not exists public.badges_awarded (
  subject_type text not null check (subject_type in ('user','business')),
  subject_id uuid not null,
  badge text not null,
  awarded_by uuid references auth.users(id),
  awarded_at timestamptz not null default now(),
  primary key (subject_type, subject_id, badge)
);
alter table public.badges_awarded enable row level security;
drop policy if exists badge_public_read on public.badges_awarded;
create policy badge_public_read on public.badges_awarded for select using (true);
drop policy if exists badge_admin_write on public.badges_awarded;
create policy badge_admin_write on public.badges_awarded for all using (is_admin()) with check (is_admin());
```

- [ ] **Step 2: Dry-run (rolled back)**

```bash
set -a; source /c/LyvoxMarketPlace/.env.local; set +a
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -1 <<'SQL'
\i supabase/migrations/20260626174000_badges_awarded.sql
do $$ begin
  if not (select relrowsecurity from pg_class where oid='public.badges_awarded'::regclass) then raise exception 'badges RLS off'; end if;
end $$;
ROLLBACK;
SQL
```
Expected: no exception.

- [ ] **Step 3: Apply for real**

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/20260626174000_badges_awarded.sql
```

- [ ] **Step 4: Types + typecheck**

Add `badges_awarded` to `database.types.ts`; `( cd apps/web && pnpm exec tsc -p tsconfig.json --noEmit )` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260626174000_badges_awarded.sql supabase/types/database.types.ts
git commit -m "feat(foundation): badges_awarded table + RLS (public read, admin write)"
```

---

## Task 8: Trust-derivation helper (read-time capability levels)

**Files:**
- Create: `apps/web/src/lib/trust/deriveTrust.ts`
- Test: `apps/web/src/lib/trust/__tests__/deriveTrust.test.ts`

**Interfaces:**
- Produces: `type HumanLevel = 'L0'|'L1'|'L2'|'L3'|'L4'`; `type BusinessLevel = 'B0'|'B1'`; `function deriveHumanLevel(p:{authenticated:boolean;verifiedEmail:boolean;verifiedPhone:boolean;idVerified:boolean}): HumanLevel`; `function deriveBusinessLevel(b:{exists:boolean;entityVerified:boolean}): BusinessLevel`; `function canSellAsBusiness(human:HumanLevel, business:BusinessLevel): boolean` (true iff human≥L3 AND business≥B1). Implements spec §6.7.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/trust/__tests__/deriveTrust.test.ts
import { describe, it, expect } from "vitest";
import { deriveHumanLevel, deriveBusinessLevel, canSellAsBusiness } from "@/lib/trust/deriveTrust";

describe("trust derivation (spec §6.7)", () => {
  it("ladders the human axis by backing fact", () => {
    expect(deriveHumanLevel({ authenticated: false, verifiedEmail: false, verifiedPhone: false, idVerified: false })).toBe("L0");
    expect(deriveHumanLevel({ authenticated: true, verifiedEmail: false, verifiedPhone: false, idVerified: false })).toBe("L1");
    expect(deriveHumanLevel({ authenticated: true, verifiedEmail: true, verifiedPhone: false, idVerified: false })).toBe("L2");
    expect(deriveHumanLevel({ authenticated: true, verifiedEmail: true, verifiedPhone: true, idVerified: false })).toBe("L3");
    expect(deriveHumanLevel({ authenticated: true, verifiedEmail: true, verifiedPhone: true, idVerified: true })).toBe("L4");
  });
  it("ladders the business axis", () => {
    expect(deriveBusinessLevel({ exists: false, entityVerified: false })).toBe("B0");
    expect(deriveBusinessLevel({ exists: true, entityVerified: false })).toBe("B0");
    expect(deriveBusinessLevel({ exists: true, entityVerified: true })).toBe("B1");
  });
  it("sell-as-business requires human≥L3 AND business≥B1", () => {
    expect(canSellAsBusiness("L3", "B1")).toBe(true);
    expect(canSellAsBusiness("L2", "B1")).toBe(false);
    expect(canSellAsBusiness("L4", "B0")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test deriveTrust`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/trust/deriveTrust.ts  (spec §6.7 — two independent axes)
export type HumanLevel = "L0" | "L1" | "L2" | "L3" | "L4";
export type BusinessLevel = "B0" | "B1";

export function deriveHumanLevel(p: {
  authenticated: boolean; verifiedEmail: boolean; verifiedPhone: boolean; idVerified: boolean;
}): HumanLevel {
  if (!p.authenticated) return "L0";
  if (!p.verifiedEmail) return "L1";
  if (!p.verifiedPhone) return "L2";
  if (!p.idVerified) return "L3";
  return "L4";
}

export function deriveBusinessLevel(b: { exists: boolean; entityVerified: boolean }): BusinessLevel {
  return b.exists && b.entityVerified ? "B1" : "B0";
}

const HUMAN_RANK: Record<HumanLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
const BUSINESS_RANK: Record<BusinessLevel, number> = { B0: 0, B1: 1 };

export function canSellAsBusiness(human: HumanLevel, business: BusinessLevel): boolean {
  return HUMAN_RANK[human] >= HUMAN_RANK.L3 && BUSINESS_RANK[business] >= BUSINESS_RANK.B1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test deriveTrust`
Expected: PASS (3 tests).

- [ ] **Step 5: Full suite + typecheck + commit**

Run: `pnpm test` (expect all green, including the new files) and `( cd apps/web && pnpm exec tsc -p tsconfig.json --noEmit )` (exit 0).

```bash
git add apps/web/src/lib/trust/deriveTrust.ts apps/web/src/lib/trust/__tests__/deriveTrust.test.ts
git commit -m "feat(foundation): read-time trust derivation (физ L0-L4 / юр B0-B1, sell-as-business rule)"
```

---

## Self-Review

**1. Spec coverage (§6 of the design doc):**
- §6.1 seller_type + business_id (RESTRICT) + withdrawn → Task 4 ✅
- §6.2 businesses + VAT/KBO checks + normalize_kbo → Task 3 ✅
- §6.3 business_members → Task 3 ✅
- §6.4 verifications + uq_ver_active + booleans-sync trigger + backfill → Task 5 ✅
- §6.5 kyc_records (RLS-isolated) + orphan cleanup (minimum fix) → Task 6 ✅
- §6.6 badges_awarded → Task 7 ✅
- §6.7 trust derivation (two axes) → Task 8 ✅
- §6.8 RLS (is_business_member SECURITY DEFINER + search_path; create_business RPC; verb-split adverts; KYC lockdown) → Tasks 3,4,6 ✅
- §6.9 migration order 1–5 → Tasks 3→7 (in order) ✅
- Decision 3 capability flags + adapter seams → Tasks 1,2 ✅
- **Deferred (next A0 plan, noted in Scope):** §6.9 item 4 retention/orphan **cron**, item 6 erasure procedure (§5.4.1) + appeals wiring; per-subject-FK "preferred" refactor of polymorphic tables. These depend on these tables existing and are operational/compliance surfaces, not the data-model root.

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Task 4 deliberately requires inspecting the live `adverts.status` vocabulary before finalizing the CHECK — that is a concrete inspect-then-fill step with the exact query, not a placeholder.

**3. Type consistency:** `is_business_member(uuid, text)`, `create_business(text,text,text)`, `normalize_kbo(text)`, `seller_type`, `business_id`, `entity_verified`, `subject_type/subject_id/method/status`, `HumanLevel/BusinessLevel` are used identically across tasks. Cache booleans (`verified_email/verified_phone/itsme_verified/entity_verified`) match the trigger in Task 5 and the derivation inputs in Task 8.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-26-phase-a0-foundation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, spec+quality review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints.
