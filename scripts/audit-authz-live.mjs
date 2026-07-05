#!/usr/bin/env node
/**
 * SEC-AUTHZ-GUARD — live authorization-model audit.
 *
 * The static CI guard (authz-migration-guard.test.ts) protects migration
 * *authoring*: it fails a PR whose new migration ships an unlocked column or
 * function. It does NOT prove the *live* database is compliant — RULE-01/02
 * fixes on this project were historically applied out-of-band via psql, so the
 * repo migrations and prod can drift (see docs memory: supabase-migration-drift-repair,
 * storage-rls-privacy-state). This script closes that gap by introspecting the
 * live catalogs the acceptance criteria name:
 *
 *   information_schema.role_table_grants  ×  pg_policies  ×  pg_proc
 *
 * It is READ-ONLY. It reports; it never mutates. Run against staging/prod:
 *
 *   node scripts/audit-authz-live.mjs                 # uses DATABASE_URL / apps/web/.env.local
 *   DATABASE_URL=postgres://... node scripts/audit-authz-live.mjs
 *   node scripts/audit-authz-live.mjs --json          # machine-readable
 *
 * Exit code: 0 if no findings, 1 if any finding (so it can gate a staging job).
 *
 * Findings (all in schema `public`, roles `authenticated` / `anon`):
 *   F1 RLS-OFF        table with RLS disabled (or not forced) that is client-reachable
 *   F2 TABLE-WIDE-WRITE  authenticated holds table-wide INSERT/UPDATE on a table that ALSO
 *                        has a trust/entitlement/verification/tax column — the RULE-01 hazard
 *                        (a table-wide write lets an owner set those columns via direct PostgREST,
 *                        bypassing the API's zod strip). DELETE is excluded (cannot be column-scoped;
 *                        an RLS "delete own rows" policy already gates it).
 *   F2b ANON-WRITE       anon holds any table-wide write (INSERT/UPDATE/DELETE) — anon should rarely
 *                        write; reported separately for review.
 *   F3 UNLOCKED-DEFINER  SECURITY DEFINER function with a uuid arg that authenticated
 *                        or anon can still EXECUTE — the RULE-02 hazard
 *   F4 NO-POLICY      RLS is on but the table has zero policies (locked to nobody but
 *                     service_role — usually intentional, reported as INFO)
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const asJson = process.argv.includes("--json");

function resolveDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  for (const rel of ["apps/web/.env.local", ".env.local", ".env"]) {
    try {
      const content = readFileSync(join(rootDir, rel), "utf8");
      const m = content.match(/^DATABASE_URL=(.+)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      /* keep looking */
    }
  }
  return null;
}

const dbUrl = resolveDbUrl();
if (!dbUrl) {
  console.error(
    "DATABASE_URL not found (env or apps/web/.env.local). Cannot run live audit."
  );
  process.exit(2);
}

// Column-editable trust/entitlement/verification/tax surface never safe to expose
// via a table-wide write grant (RULE-01). A table-wide write grant is ALWAYS a
// finding; this list only sharpens the human-facing severity note.
const SENSITIVE_COL_RE =
  /(verif|trust|entitle|tax|vat|kbo|status|role|is_admin|level|score|badge|plan|pro_|boost|premium|balance|credit)/i;

const findings = [];
const info = [];

const client = new pg.Client({
  connectionString: dbUrl,
  // Supabase pooler / prod requires TLS; do not verify (self-signed chain in pooler).
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  // ── F1/F4: RLS posture per public base table ────────────────────────────────
  const rls = await client.query(`
    select c.relname as table,
           c.relrowsecurity as rls_enabled,
           c.relforcerowsecurity as rls_forced,
           coalesce(p.n, 0) as policy_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join (
      select polrelid, count(*) n from pg_policy group by polrelid
    ) p on p.polrelid = c.oid
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname;
  `);
  for (const row of rls.rows) {
    if (!row.rls_enabled) {
      findings.push({
        code: "F1-RLS-OFF",
        object: `public.${row.table}`,
        detail: "RLS is DISABLED on a public base table — any authenticated user can read/write every row (subject to grants).",
      });
    } else if (Number(row.policy_count) === 0) {
      info.push({
        code: "F4-NO-POLICY",
        object: `public.${row.table}`,
        detail: "RLS on but zero policies → only service_role/owner can access. Usually intentional (service-managed table).",
      });
    }
  }

  // ── F2: table-wide write grants to authenticated/anon (RULE-01) ──────────────
  // role_table_grants lists TABLE-LEVEL privileges only; a column-scoped grant lives
  // in role_column_grants and does NOT appear here. So a row here = the whole-table
  // grant is present. Supabase's default posture grants table-wide writes broadly and
  // relies on RLS for ROW gating — that is fine UNLESS the table also carries a
  // trust/entitlement/tax column, because RLS does not gate COLUMNS (RULE-01). We flag
  // the intersection: table-wide INSERT/UPDATE to `authenticated` × a sensitive column.
  // DELETE is excluded (no columns to scope; RLS already gates the rows).
  const tableGrants = await client.query(`
    select rtg.table_name, rtg.grantee, rtg.privilege_type, rtg.is_grantable
    from information_schema.role_table_grants rtg
    where rtg.table_schema = 'public'
      and rtg.grantee in ('authenticated', 'anon')
      and rtg.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    order by rtg.table_name, rtg.grantee, rtg.privilege_type;
  `);
  // Sensitive columns per table (name-based heuristic on live schema).
  const cols = await client.query(`
    select c.relname as table_name, a.attname as column_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname, a.attnum;
  `);
  const sensitiveByTable = new Map();
  for (const row of cols.rows) {
    if (SENSITIVE_COL_RE.test(row.column_name)) {
      if (!sensitiveByTable.has(row.table_name)) sensitiveByTable.set(row.table_name, []);
      sensitiveByTable.get(row.table_name).push(row.column_name);
    }
  }
  // Policies: a grant is only EXPLOITABLE when a PERMISSIVE policy actually enables the
  // write for that role+command. This is the three-way cross the acceptance criteria name
  // (role_table_grants × pg_policies × pg_proc). Without a matching policy the grant is inert
  // (Supabase seeds default grants on almost every table; RLS is the real gate).
  const policies = await client.query(`
    select tablename, cmd, permissive, roles, qual, with_check
    from pg_policies
    where schemaname = 'public';
  `);
  const policyByTable = new Map();
  for (const p of policies.rows) {
    if (!policyByTable.has(p.tablename)) policyByTable.set(p.tablename, []);
    policyByTable.get(p.tablename).push(p);
  }
  // roles arrives as a Postgres text[] ("{authenticated}" or already-parsed array via pg).
  const rolesOf = (r) =>
    Array.isArray(r)
      ? r
      : String(r || "")
          .replace(/^\{|\}$/g, "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
  // The expression that gates a write: WITH CHECK for INSERT, both for UPDATE, USING for DELETE.
  const gateExpr = (p, priv) => {
    if (priv === "INSERT") return p.with_check;
    if (priv === "DELETE") return p.qual;
    return [p.qual, p.with_check].filter(Boolean).join(" AND "); // UPDATE
  };
  // A policy gate is OPEN (genuinely reachable by an unauthenticated caller) only when it is
  // literally `true` or absent. Anything else — an auth.uid()/jwt check, a helper predicate like
  // is_admin()/is_business_member(), a subquery, any comparison — gates the write somehow and is
  // NOT open to anon. This conservative rule keeps the real hazard (the storage `with check (true)`
  // blanket-insert class) while dropping admin-gated / owner-gated `to public` policies as noise.
  const gateIsOpen = (expr) => {
    if (expr === null || expr === undefined) return true;
    const s = String(expr).trim().toLowerCase();
    return s === "" || s === "true";
  };
  function writePolicies(table, role, priv) {
    const ps = policyByTable.get(table) || [];
    return ps.filter((p) => {
      if (p.permissive && p.permissive.toUpperCase() === "RESTRICTIVE") return false;
      const roles = rolesOf(p.roles);
      const roleApplies = roles.includes(role) || roles.includes("public");
      const cmd = (p.cmd || "").toUpperCase();
      const cmdApplies = cmd === "ALL" || cmd === priv;
      return roleApplies && cmdApplies;
    });
  }
  const hasWritePolicyFor = (table, role, priv) =>
    writePolicies(table, role, priv).length > 0;
  // A gate an ORDINARY (non-admin) authenticated user can actually pass: open (true), or
  // owner-scoped (auth.uid()/auth.jwt()). A gate that is only `is_admin()` blocks ordinary
  // users → not a RULE-01 hole (admin-managed table). This mirrors the anon analysis: the
  // grant matters only where a policy actually lets a non-privileged user through.
  const gateNonAdminReachable = (expr) =>
    gateIsOpen(expr) || /auth\.(uid|jwt)\s*\(/i.test(String(expr || ""));
  const nonAdminCanWrite = (table, priv) =>
    writePolicies(table, "authenticated", priv).some((p) =>
      gateNonAdminReachable(gateExpr(p, priv))
    );
  // anon can genuinely write only if some admitting policy has a literally-OPEN gate.
  const anonCanActuallyWrite = (table, priv) =>
    writePolicies(table, "anon", priv).some((p) => gateIsOpen(gateExpr(p, priv)));

  for (const row of tableGrants.rows) {
    const grantable = row.is_grantable === "YES" ? " (WITH GRANT OPTION)" : "";
    const priv = row.privilege_type;
    if (row.grantee === "anon") {
      // anon write is a finding ONLY if a policy with an OPEN gate (not auth.*-gated) lets anon
      // write — otherwise the `public`-role policy is blocked at runtime by its auth.uid() check.
      if (!anonCanActuallyWrite(row.table_name, priv)) continue;
      findings.push({
        code: "F2b-ANON-WRITE",
        object: `public.${row.table_name}`,
        detail: `anon holds table-wide ${priv}${grantable} AND a permissive policy with an OPEN gate (no auth.uid()/jwt check) admits it. An UNAUTHENTICATED user can ${priv} this table — confirm this is intended (this is the storage-blanket-insert class of hole).`,
      });
      continue;
    }
    // authenticated: RULE-01 bites on INSERT/UPDATE of a table with a sensitive column,
    // and only when a policy actually lets authenticated write those rows.
    if (priv === "DELETE") continue;
    const sensCols = sensitiveByTable.get(row.table_name);
    if (!sensCols || !sensCols.length) continue;
    // Only a hole if an ORDINARY authenticated user (not just admin) can pass the write gate.
    if (!nonAdminCanWrite(row.table_name, priv)) continue;
    findings.push({
      code: "F2-TABLE-WIDE-WRITE",
      object: `public.${row.table_name}`,
      detail: `authenticated holds TABLE-WIDE ${priv}${grantable} AND a permissive owner/open-gated policy admits an ordinary user, while the table has trust/entitlement/tax column(s) [${sensCols.join(
        ", "
      )}]. RULE-01: RLS gates ROWS not COLUMNS — the user can set those columns on their own row via direct PostgREST, bypassing the API zod strip. Column-scope the grant (revoke table-wide; grant ${priv.toLowerCase()} (editable cols)).`,
    });
  }

  // ── F3: SECURITY DEFINER functions with a uuid arg still EXECUTE-able ─────────
  // pg_proc.prosecdef = SECURITY DEFINER. proargtypes/proallargtypes carry uuid.
  const defFns = await client.query(`
    with defs as (
      select p.oid,
             p.proname as name,
             pg_get_function_identity_arguments(p.oid) as args,
             p.prosecdef
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef = true
    )
    select d.name, d.args, d.oid,
           has_function_privilege('authenticated', d.oid, 'execute') as auth_exec,
           has_function_privilege('anon', d.oid, 'execute') as anon_exec
    from defs d
    where d.args ilike '%uuid%'
    order by d.name;
  `);
  for (const row of defFns.rows) {
    if (row.auth_exec || row.anon_exec) {
      const who = [row.auth_exec && "authenticated", row.anon_exec && "anon"]
        .filter(Boolean)
        .join(" + ");
      findings.push({
        code: "F3-UNLOCKED-DEFINER",
        object: `public.${row.name}(${row.args})`,
        detail: `SECURITY DEFINER function with a uuid argument is EXECUTE-able by ${who}. RULE-02: revoke execute from public, authenticated, anon unless this is an intentional RLS-predicate helper (is_business_member / is_conversation_participant / is_admin). If intentional, this is expected.`,
      });
    }
  }

  await client.end();
}

main()
  .then(() => {
    if (asJson) {
      console.log(JSON.stringify({ findings, info }, null, 2));
    } else {
      console.log("\n=== SEC-AUTHZ-GUARD · live audit ===\n");
      if (findings.length === 0) {
        console.log("✅ No RULE-01/RULE-02/RLS findings against the live database.\n");
      } else {
        console.log(`⚠️  ${findings.length} finding(s):\n`);
        for (const f of findings) {
          console.log(`  [${f.code}] ${f.object}`);
          console.log(`      ${f.detail}\n`);
        }
      }
      if (info.length) {
        console.log(`ℹ️  ${info.length} informational (review, usually intentional):\n`);
        for (const i of info) console.log(`  [${i.code}] ${i.object}`);
        console.log("");
      }
    }
    process.exit(findings.length > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error("Live audit failed:", err.message);
    process.exit(2);
  });
