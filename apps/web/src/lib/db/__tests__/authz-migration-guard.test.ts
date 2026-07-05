/**
 * SEC-AUTHZ-GUARD — CI guard (rides `pnpm test`, gated by the existing CI test job).
 *
 * Fails when a migration under supabase/migrations ships an authz hole of the RULE-A / RULE-01 /
 * RULE-02 class that is not grandfathered in AUTHZ_GUARD_EXEMPTIONS. The analysis lives in the pure,
 * unit-tested authzMigrationGuard module; this file wires it to the real corpus and to synthetic
 * fixtures that PROVE the guard actually red-flags bad migrations (a guard that only ever passes is
 * worthless).
 *
 * Scope: this guards migration *authoring*. It does not prove the live DB is compliant — run the
 * complementary live audit (scripts/audit-authz-live.mjs) for that.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  analyzeMigrations,
  preprocessSql,
  isTableWideWrite,
  extractDefinerFns,
  type PseudoMigration,
} from "../authzMigrationGuard";
import { AUTHZ_GUARD_EXEMPTIONS } from "../authzGuardExemptions";

// ── locate supabase/migrations by walking up from this file ──────────────────
function migrationsDir(): string {
  let dir =
    typeof __dirname !== "undefined" ? __dirname : path.resolve(process.cwd());
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, "supabase", "migrations");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // last resort: assume repo root is cwd
  return path.resolve(process.cwd(), "supabase/migrations");
}

function loadRealMigrations(): PseudoMigration[] {
  const dir = migrationsDir();
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((name) => ({
    name,
    sql: fs.readFileSync(path.join(dir, name), "utf8"),
  }));
}

// ── the guard proper ─────────────────────────────────────────────────────────

describe("SEC-AUTHZ-GUARD · migration authz guard", () => {
  const migrations = loadRealMigrations();

  it("scans a plausible number of migrations (walk didn't silently find nothing)", () => {
    expect(migrations.length).toBeGreaterThanOrEqual(80);
  });

  it("every migration satisfies RULE-A / RULE-01 / RULE-02 or is grandfathered", () => {
    const { violations, createdTableCount } = analyzeMigrations(
      migrations,
      AUTHZ_GUARD_EXEMPTIONS
    );

    // Sanity: the table extractor actually saw the schema (not a broken walk).
    expect(createdTableCount).toBeGreaterThanOrEqual(40);

    if (violations.length > 0) {
      const grouped = violations
        .map(
          (v) =>
            `  [${v.kind}] ${v.identifier}  (in ${v.migration})\n      ${v.message}`
        )
        .join("\n\n");
      throw new Error(
        `SEC-AUTHZ-GUARD found ${violations.length} unguarded authorization issue(s) in migrations:\n\n` +
          `${grouped}\n\n` +
          `Fix the migration, or — if this is an intentional, documented exception — add an entry to\n` +
          `apps/web/src/lib/db/authzGuardExemptions.ts with a reason (> 10 chars).`
      );
    }
  });

  it("every allowlist entry has a documented reason (> 10 chars)", () => {
    const bad = AUTHZ_GUARD_EXEMPTIONS.filter(
      (e) => !e.reason || e.reason.trim().length <= 10
    );
    expect(bad.map((e) => `${e.kind}:${e.identifier}`)).toEqual([]);
  });

  it("no allowlist entry is stale — each still corresponds to a real violation without the allowlist", () => {
    // Re-run with an EMPTY allowlist and collect the identifiers that actually violate.
    const { violations } = analyzeMigrations(migrations, []);
    const realKeys = new Set(violations.map((v) => `${v.kind} ${v.identifier}`));
    const stale = AUTHZ_GUARD_EXEMPTIONS.filter(
      (e) => !realKeys.has(`${e.kind} ${e.identifier}`)
    );
    if (stale.length > 0) {
      const msg = stale
        .map((e) => `  [${e.kind}] ${e.identifier}`)
        .join("\n");
      throw new Error(
        `The following AUTHZ_GUARD_EXEMPTIONS no longer match any real violation (migration fixed or ` +
          `renamed?). Remove them from authzGuardExemptions.ts:\n\n${msg}`
      );
    }
  });
});

// ── positive-detection: the guard MUST red-flag synthetic bad migrations ──────

describe("SEC-AUTHZ-GUARD · detects bad migrations (positive controls)", () => {
  const run = (name: string, sql: string) =>
    analyzeMigrations([{ name, sql }], []).violations;

  it("flags a table with no RLS", () => {
    const v = run("x.sql", `create table public.secrets (id uuid primary key);`);
    expect(v.some((x) => x.kind === "table-no-rls" && x.identifier === "secrets")).toBe(true);
  });

  it("does NOT flag a table that enables RLS", () => {
    const v = run(
      "x.sql",
      `create table public.ok (id uuid primary key);
       alter table public.ok enable row level security;`
    );
    expect(v.some((x) => x.kind === "table-no-rls")).toBe(false);
  });

  it("counts RLS enabled in a LATER migration (cross-file)", () => {
    const v = analyzeMigrations(
      [
        { name: "a.sql", sql: `create table public.late (id uuid);` },
        { name: "b.sql", sql: `alter table if exists public.late enable row level security;` },
      ],
      []
    ).violations;
    expect(v.some((x) => x.kind === "table-no-rls")).toBe(false);
  });

  it("flags a table-wide UPDATE grant to authenticated (RULE-01)", () => {
    const v = run("x.sql", `grant update on public.wallets to authenticated;`);
    expect(v.some((x) => x.kind === "table-wide-grant")).toBe(true);
  });

  it("flags a combined `select, insert` grant (no column list) — the chat_offers shape", () => {
    const v = run("x.sql", `grant select, insert on public.things to authenticated;`);
    expect(v.some((x) => x.kind === "table-wide-grant" && x.identifier.includes("insert"))).toBe(true);
  });

  it("flags `grant all privileges` (not just the bare `all` token)", () => {
    const v = run("x.sql", `grant all privileges on public.payouts to authenticated;`);
    expect(v.some((x) => x.kind === "table-wide-grant")).toBe(true);
  });

  it("flags a blanket `grant ... on all tables in schema` to anon", () => {
    const v = run("x.sql", `grant insert on all tables in schema public to anon;`);
    expect(v.some((x) => x.kind === "table-wide-grant")).toBe(true);
  });

  it("does NOT flag a column-scoped UPDATE grant", () => {
    const v = run("x.sql", `grant update (title, price) on public.adverts to authenticated;`);
    expect(v.some((x) => x.kind === "table-wide-grant")).toBe(false);
  });

  it("does NOT flag a table-wide grant to service_role", () => {
    const v = run("x.sql", `grant all on public.stuff to service_role;`);
    expect(v.some((x) => x.kind === "table-wide-grant")).toBe(false);
  });

  it("does NOT flag a table-wide DELETE-only grant (no columns to scope)", () => {
    const v = run("x.sql", `grant delete on public.things to authenticated;`);
    expect(v.some((x) => x.kind === "table-wide-grant")).toBe(false);
  });

  it("flags a SECURITY DEFINER fn(uuid) with no revoke (RULE-02)", () => {
    const v = run(
      "x.sql",
      `create function public.danger(p_id uuid) returns void language sql security definer as $$ select 1 $$;`
    );
    expect(v.some((x) => x.kind === "unlocked-definer-fn" && x.identifier === "danger")).toBe(true);
  });

  it("flags a fn revoked only FROM authenticated (missing anon)", () => {
    const v = run(
      "x.sql",
      `create function public.half(p_id uuid) returns void language sql security definer as $$ select 1 $$;
       revoke execute on function public.half(uuid) from authenticated;`
    );
    expect(v.some((x) => x.kind === "unlocked-definer-fn" && x.identifier === "half")).toBe(true);
  });

  it("flags a fn revoked only FROM public (Supabase grants execute to authenticated+anon)", () => {
    const v = run(
      "x.sql",
      `create function public.pubonly(p_id uuid) returns void language sql security definer as $$ select 1 $$;
       revoke execute on function public.pubonly(uuid) from public;`
    );
    expect(v.some((x) => x.kind === "unlocked-definer-fn" && x.identifier === "pubonly")).toBe(true);
  });

  it("does NOT flag a fn(uuid) properly revoked from public, authenticated, anon", () => {
    const v = run(
      "x.sql",
      `create function public.safe(p_id uuid) returns void language sql security definer as $$ select 1 $$;
       revoke execute on function public.safe(uuid) from public, authenticated, anon;
       grant execute on function public.safe(uuid) to service_role;`
    );
    expect(v.some((x) => x.kind === "unlocked-definer-fn")).toBe(false);
  });

  it("flags a fn revoked then RE-GRANTED to authenticated (undoes the lock)", () => {
    const v = run(
      "x.sql",
      `create function public.reopened(p_id uuid) returns void language sql security definer as $$ select 1 $$;
       revoke execute on function public.reopened(uuid) from public, authenticated, anon;
       grant execute on function public.reopened(uuid) to authenticated;`
    );
    expect(v.some((x) => x.kind === "unlocked-definer-fn" && x.identifier === "reopened")).toBe(true);
  });

  it("does NOT flag a SECURITY DEFINER fn with NO uuid arg", () => {
    const v = run(
      "x.sql",
      `create function public.refresh_it() returns void language sql security definer as $$ select 1 $$;`
    );
    expect(v.some((x) => x.kind === "unlocked-definer-fn")).toBe(false);
  });

  it("multi-line function signature: uuid on a continuation line is still detected", () => {
    const v = run(
      "x.sql",
      `create function public.multi(
         p_actor text,
         p_target uuid
       ) returns void language sql security definer as $$ select 1 $$;`
    );
    expect(v.some((x) => x.kind === "unlocked-definer-fn" && x.identifier === "multi")).toBe(true);
  });

  it("comment containing `revoke ... from public, authenticated, anon` does NOT satisfy the lock", () => {
    const v = run(
      "x.sql",
      `-- revoke execute on function public.tricky(uuid) from public, authenticated, anon;
       create function public.tricky(p_id uuid) returns void language sql security definer as $$ select 1 $$;`
    );
    expect(v.some((x) => x.kind === "unlocked-definer-fn" && x.identifier === "tricky")).toBe(true);
  });

  it("`grant`/`revoke` words inside a $$ function body are ignored (not parsed as statements)", () => {
    const v = run(
      "x.sql",
      `create function public.bodytext() returns text language sql security definer as $$
         select 'grant update on public.x to authenticated'::text $$;
       alter table public.dummy enable row level security;
       create table public.dummy (id uuid);`
    );
    // the string inside the body must not create a table-wide-grant violation
    expect(v.some((x) => x.kind === "table-wide-grant")).toBe(false);
  });
});

// ── unit tests for the primitives (fast, targeted) ───────────────────────────

describe("SEC-AUTHZ-GUARD · primitives", () => {
  it("preprocessSql strips line comments", () => {
    expect(preprocessSql(`grant x; -- revoke y\nselect 1`)).not.toMatch(/revoke y/);
  });
  it("preprocessSql strips block comments", () => {
    expect(preprocessSql(`a /* grant all */ b`)).not.toMatch(/grant all/);
  });
  it("preprocessSql blanks dollar-quoted bodies", () => {
    expect(preprocessSql(`create fn as $$ grant all on t to anon; $$;`)).not.toMatch(/grant all/);
  });
  it("isTableWideWrite: 'update' bare is table-wide", () => {
    expect(isTableWideWrite("update")).toBe(true);
  });
  it("isTableWideWrite: 'update (a,b)' is column-scoped", () => {
    expect(isTableWideWrite("update (a, b)")).toBe(false);
  });
  it("isTableWideWrite: 'select' is not a write", () => {
    expect(isTableWideWrite("select")).toBe(false);
  });
  it("extractDefinerFns: detects uuid arg across newlines", () => {
    const fns = extractDefinerFns(
      preprocessSql(
        `create function public.f(\n a text,\n b uuid\n) returns void security definer as '' ;`
      )
    );
    expect(fns[0]?.hasUuidArg).toBe(true);
  });
});
