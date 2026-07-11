/**
 * SEC-AUTHZ-GUARD — static analyzer for the authorization posture of SQL migrations.
 *
 * Pure, dependency-free, and side-effect-free so it can be unit-tested against both the
 * real migration corpus and synthetic "bad migration" fixtures. The vitest guard
 * (authz-migration-guard.test.ts) wires this to supabase/migrations and fails CI when a
 * NEW migration ships an authz hole of the RULE-01 / RULE-02 class.
 *
 * It enforces three invariants that this project learned the hard way (see the master-TZ
 * error journal + RULE-01/RULE-02):
 *
 *   RULE-A (RLS coverage): every created public table has RLS enabled somewhere in the corpus.
 *   RULE-01 (no explicit table-wide writes): no INSERT/UPDATE/ALL grant to authenticated/anon
 *           without a column list (RLS gates ROWS, not COLUMNS — a table-wide write lets an owner
 *           set trust/entitlement/tax columns via direct PostgREST, bypassing the API's zod strip).
 *   RULE-01b (default-grant column exposure): the COMMON vector. Supabase auto-grants table-wide
 *           INSERT/UPDATE to authenticated on every new table — a grant that never appears in
 *           migration text. So a new table with a trust/entitlement column + an authenticated/public
 *           write POLICY, but no explicit `revoke <op> ... from authenticated`, silently exposes that
 *           column (this is exactly how profiles-INSERT stayed open). The only migration-level lock is
 *           an explicit revoke, so we require one whenever a sensitive-column table gets a reachable
 *           write policy. Discriminator against service-managed tables: a write POLICY must exist.
 *   RULE-02 (privileged functions locked): every SECURITY DEFINER function
 *           revokes EXECUTE from BOTH authenticated AND anon in the same migration (Supabase grants
 *           EXECUTE to authenticated+anon by default; `revoke ... from public` alone is NOT enough).
 *
 * Historical exceptions are grandfathered by an explicit allowlist (authzGuardExemptions.ts),
 * exactly like the SEC-VALID route guard — each entry carries a documented reason.
 *
 * This is a STATIC guard: it protects migration *authoring*. It does not prove the live database
 * is compliant (RULE-01/02 fixes were historically applied out-of-band). That gap is closed by the
 * complementary live audit, scripts/audit-authz-live.mjs.
 */

export interface PseudoMigration {
  /** File name (e.g. "20260627240000_erasure.sql"), used in violation messages + allowlist keys. */
  name: string;
  /** Raw SQL text. */
  sql: string;
}

export type ViolationKind =
  | "table-no-rls"
  | "table-wide-grant"
  | "unlocked-column-policy"
  | "unlocked-definer-fn";

export interface AuthzExemption {
  kind: ViolationKind;
  /**
   * The normalized identifier being grandfathered:
   *  - table-no-rls          → table name (e.g. "catalog_fields")
   *  - table-wide-grant      → "<table>:<priv>:<role>" (e.g. "adverts:update:authenticated")
   *  - unlocked-column-policy→ "<table>:<op>" (e.g. "profiles:insert")
   *  - unlocked-definer-fn   → function name (e.g. "is_business_member")
   */
  identifier: string;
  /** Optional exact migration filename; scopes a historical exception so future redefinitions are still gated. */
  migration?: string;
  /** > 10 chars. Why this historical exception is safe / intentional. */
  reason: string;
}

export interface Violation {
  kind: ViolationKind;
  identifier: string;
  migration: string;
  message: string;
}

// ── SQL preprocessing ────────────────────────────────────────────────────────

/**
 * Strip line (`--`) and block (`/* *\/`) comments and BLANK OUT dollar-quoted bodies
 * (`$$ ... $$`, `$tag$ ... $tag$`). Comments are stripped so that a `revoke ... from public`
 * written in a COMMENT (see erasure.sql) is not mistaken for a real revoke, and a `grant` in a
 * comment does not false-fail. Dollar-quoted function bodies are blanked so the words
 * "grant"/"revoke" appearing as data inside a plpgsql body never match a top-level rule.
 * Single-quoted string literals are preserved (short, harmless, and rarely contain DDL).
 */
export function preprocessSql(sql: string): string {
  let out = "";
  let i = 0;
  const n = sql.length;
  type State = "code" | "line" | "block" | "dollar" | "single";
  let state: State = "code";
  let dollarTag = "";

  while (i < n) {
    const c = sql[i];
    const c2 = i + 1 < n ? sql[i + 1] : "";

    if (state === "code") {
      if (c === "$") {
        const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
        if (m) {
          dollarTag = m[0];
          state = "dollar";
          i += m[0].length;
          continue;
        }
      }
      if (c === "-" && c2 === "-") {
        state = "line";
        i += 2;
        continue;
      }
      if (c === "/" && c2 === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (c === "'") {
        state = "single";
        out += c;
        i += 1;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }

    if (state === "line") {
      if (c === "\n") {
        state = "code";
        out += "\n";
      }
      i += 1;
      continue;
    }

    if (state === "block") {
      if (c === "*" && c2 === "/") {
        state = "code";
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (state === "dollar") {
      if (sql.startsWith(dollarTag, i)) {
        state = "code";
        i += dollarTag.length;
      } else {
        i += 1; // drop body content
      }
      continue;
    }

    // single-quoted string
    out += c;
    if (c === "'") {
      if (c2 === "'") {
        out += c2; // escaped quote
        i += 2;
        continue;
      }
      state = "code";
    }
    i += 1;
  }

  return out;
}

/** Normalize a table/function identifier: strip quotes, strip a leading `public.`, lowercase. */
export function normIdent(raw: string): string {
  return raw
    .trim()
    .replace(/"/g, "")
    .replace(/^public\./i, "")
    .toLowerCase();
}

// ── Extractors ───────────────────────────────────────────────────────────────

const CREATE_TABLE_RE =
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?("?[\w.]+"?)/gi;
const DROP_TABLE_RE = /\bdrop\s+table\s+(?:if\s+exists\s+)?("?[\w.]+"?)/gi;
const ENABLE_RLS_RE =
  /\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?("?[\w.]+"?)\s+enable\s+row\s+level\s+security/gi;

/** All grant statements: captures (privileges, object, roles). */
const GRANT_RE =
  /\bgrant\s+([\s\S]*?)\s+on\s+([\s\S]*?)\s+to\s+([\s\S]*?)(?:;|$)/gi;

/** create [or replace] function NAME( — the `(` is consumed so we can balance from there. */
const CREATE_FUNCTION_RE =
  /\bcreate\s+(?:or\s+replace\s+)?function\s+("?[\w.]+"?)\s*\(/gi;

/** revoke execute on function NAME(...) from ROLES */
const REVOKE_EXECUTE_RE =
  /\brevoke\s+execute\s+on\s+function\s+("?[\w.]+"?)\s*\([^)]*\)\s+from\s+([^;]*)/gi;

/** grant execute on function NAME(...) to ROLES — used to detect an un-doing re-grant. */
const GRANT_EXECUTE_RE =
  /\bgrant\s+execute\s+on\s+function\s+("?[\w.]+"?)\s*\([^)]*\)\s+to\s+([^;]*)/gi;

function rolesInclude(roleList: string, role: string): boolean {
  return new RegExp(`(^|[\\s,])${role}([\\s,]|$)`, "i").test(roleList);
}

/**
 * Given the privilege clause of a grant, does it convey a TABLE-WIDE (no column list) write —
 * i.e. INSERT/UPDATE/ALL not scoped to specific columns? DELETE is excluded: it has no columns to
 * scope, so a table-wide DELETE grant is not a RULE-01 (column-exposure) violation.
 */
export function isTableWideWrite(privClause: string): boolean {
  const p = privClause.toLowerCase();
  // `grant all` / `all privileges` conveys UPDATE+INSERT table-wide (cannot be column-scoped).
  if (/\ball\b/.test(p)) return true;
  // insert/update NOT immediately followed by a `(column list)` = table-wide.
  if (/\binsert\b\s*(?!\()/.test(p) && !/\binsert\s*\(/.test(p)) return true;
  if (/\bupdate\b\s*(?!\()/.test(p) && !/\bupdate\s*\(/.test(p)) return true;
  return false;
}

/** Extract the balanced-paren argument list starting at index `openParen` (points at `(`). */
function readBalancedArgs(sql: string, openParen: number): string {
  let depth = 0;
  let i = openParen;
  const start = openParen + 1;
  for (; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return sql.slice(start, i);
    }
  }
  return sql.slice(start); // unbalanced; return best-effort
}

interface DefinerFn {
  name: string;
  args: string;
  hasUuidArg: boolean;
}

/** Find SECURITY DEFINER functions, capturing name + whether the arg list contains a uuid type. */
export function extractDefinerFns(cleanSql: string): DefinerFn[] {
  const fns: DefinerFn[] = [];
  const matches = [...cleanSql.matchAll(CREATE_FUNCTION_RE)];
  for (let k = 0; k < matches.length; k++) {
    const m = matches[k];
    const nameRaw = m[1];
    const openParen = m.index! + m[0].length - 1; // CREATE_FUNCTION_RE consumes the `(`
    const args = readBalancedArgs(cleanSql, openParen);
    // Definition window = from this create to the next create-function (or end of file).
    const windowEnd =
      k + 1 < matches.length ? matches[k + 1].index! : cleanSql.length;
    const windowText = cleanSql.slice(m.index!, windowEnd);
    if (!/security\s+definer/i.test(windowText)) continue;
    fns.push({
      name: normIdent(nameRaw),
      args: args.trim(),
      // \buuid\b covers `uuid`, `uuid[]`, `p_id uuid`, arrays, etc.
      hasUuidArg: /\buuid\b/i.test(args),
    });
  }
  return fns;
}

// ── RULE-01b primitives: columns, write policies, table revokes ──────────────

/**
 * Trust/entitlement/verification/tax column-name heuristic (mirrors the live audit). A table-wide
 * write to any of these is the RULE-01 hazard; an ordinary attribute column is not.
 */
export const SENSITIVE_COLUMN_RE =
  /(verif|trust|entitle|_tax|vat|kbo|status|role|is_admin|_level|score|badge|plan|pro_|boost|premium|balance|credit|kyc|itsme)/i;

const ADD_COLUMN_RE =
  /\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?("?[\w.]+"?)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?("?\w+"?)/gi;

/** Split a CREATE TABLE body on top-level commas (respecting nested parens). */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

const TABLE_CONSTRAINT_KW =
  /^(constraint|primary|foreign|unique|check|exclude|like)\b/i;

/** Map of table -> set of declared column names, from CREATE TABLE bodies + ALTER TABLE ADD COLUMN. */
export function extractColumnsByTable(
  cleanSql: string,
): Map<string, Set<string>> {
  const cols = new Map<string, Set<string>>();
  const add = (table: string, col: string) => {
    const t = normIdent(table);
    if (!cols.has(t)) cols.set(t, new Set());
    cols.get(t)!.add(col.replace(/"/g, "").toLowerCase());
  };

  for (const m of cleanSql.matchAll(CREATE_TABLE_RE)) {
    const table = m[1];
    const openParen = cleanSql.indexOf(
      "(",
      m.index! + m[0].length - table.length,
    );
    if (openParen === -1) continue;
    const body = readBalancedArgs(cleanSql, openParen);
    for (const raw of splitTopLevel(body)) {
      const def = raw.trim();
      if (!def || TABLE_CONSTRAINT_KW.test(def)) continue;
      const colName = def.split(/\s|\(/)[0];
      if (colName) add(table, colName);
    }
  }
  for (const m of cleanSql.matchAll(ADD_COLUMN_RE)) add(m[1], m[2]);
  return cols;
}

export interface WritePolicy {
  table: string;
  cmd: string; // insert | update | delete | select | all
  roles: string;
  gate: string;
}

/** create policy NAME on TABLE [as ...] [for CMD] [to ROLES] [using(...)] [with check(...)] ; */
const CREATE_POLICY_RE = /\bcreate\s+policy\s+[\s\S]*?;/gi;

export function extractWritePolicies(cleanSql: string): WritePolicy[] {
  const out: WritePolicy[] = [];
  for (const stmtMatch of cleanSql.matchAll(CREATE_POLICY_RE)) {
    const stmt = stmtMatch[0];
    const onM = /\bon\s+("?[\w.]+"?)/i.exec(stmt);
    if (!onM) continue;
    const table = normIdent(onM[1]);
    const cmd = (
      /(\bfor\s+(insert|update|delete|select|all)\b)/i.exec(stmt)?.[2] ?? "all"
    ).toLowerCase();
    const roles = (
      /\bto\s+([\s\S]*?)(?:\busing\b|\bwith\s+check\b|;)/i.exec(stmt)?.[1] ??
      "public"
    ).trim();
    const usingExpr = /\busing\s*\(/i.exec(stmt);
    const checkExpr = /\bwith\s+check\s*\(/i.exec(stmt);
    let gate = "";
    if (usingExpr)
      gate += " " + readBalancedArgs(stmt, stmt.indexOf("(", usingExpr.index));
    if (checkExpr)
      gate += " " + readBalancedArgs(stmt, stmt.indexOf("(", checkExpr.index));
    out.push({ table, cmd, roles, gate: gate.trim() });
  }
  return out;
}

/** revoke PRIVS on TABLE from ROLES — captures which (table, op) had their default grant revoked. */
const REVOKE_TABLE_RE =
  /\brevoke\s+([\s\S]*?)\s+on\s+("?[\w.]+"?)\s+from\s+([^;]*)/gi;

// ── Core analysis ────────────────────────────────────────────────────────────

export interface AnalyzeResult {
  violations: Violation[];
  /** Diagnostics for the guard's own sanity assertions. */
  createdTableCount: number;
  scannedFileCount: number;
}

export function analyzeMigrations(
  files: PseudoMigration[],
  exemptions: AuthzExemption[],
): AnalyzeResult {
  const globalExemptSet = new Set(
    exemptions
      .filter((exemption) => !exemption.migration)
      .map((exemption) => `${exemption.kind}::${exemption.identifier}`),
  );
  const scopedExemptSet = new Set(
    exemptions
      .filter((exemption) => exemption.migration)
      .map(
        (exemption) =>
          `${exemption.kind}::${exemption.identifier}::${exemption.migration}`,
      ),
  );
  const isExempt = (
    kind: ViolationKind,
    identifier: string,
    migration?: string,
  ) =>
    globalExemptSet.has(`${kind}::${identifier}`) ||
    (migration !== undefined &&
      scopedExemptSet.has(`${kind}::${identifier}::${migration}`));

  const created = new Map<string, string>(); // table -> first migration that created it
  const dropped = new Set<string>();
  const rlsEnabled = new Set<string>();
  const violations: Violation[] = [];

  // RULE-01b corpus-wide state (a table's columns/policies/revokes can span migrations).
  const sensitiveColsByTable = new Map<string, Set<string>>();
  const writePoliciesByTable = new Map<string, WritePolicy[]>();
  const revokedOps = new Set<string>(); // "<table>:<op>" where op default-grant was revoked from authenticated
  const policySourceMig = new Map<string, string>(); // table -> migration that first added a write policy

  for (const file of files) {
    const clean = preprocessSql(file.sql);

    // Tables + RLS (corpus-wide).
    for (const m of clean.matchAll(CREATE_TABLE_RE)) {
      const t = normIdent(m[1]);
      if (!created.has(t)) created.set(t, file.name);
    }
    for (const m of clean.matchAll(DROP_TABLE_RE)) dropped.add(normIdent(m[1]));
    for (const m of clean.matchAll(ENABLE_RLS_RE))
      rlsEnabled.add(normIdent(m[1]));

    // RULE-01b inputs (corpus-wide).
    for (const [table, cols] of extractColumnsByTable(clean)) {
      const sens = [...cols].filter((c) => SENSITIVE_COLUMN_RE.test(c));
      if (sens.length) {
        if (!sensitiveColsByTable.has(table))
          sensitiveColsByTable.set(table, new Set());
        sens.forEach((c) => sensitiveColsByTable.get(table)!.add(c));
      }
    }
    for (const wp of extractWritePolicies(clean)) {
      if (!writePoliciesByTable.has(wp.table))
        writePoliciesByTable.set(wp.table, []);
      writePoliciesByTable.get(wp.table)!.push(wp);
      if (!policySourceMig.has(wp.table))
        policySourceMig.set(wp.table, file.name);
    }
    for (const rm of clean.matchAll(REVOKE_TABLE_RE)) {
      const privs = rm[1].toLowerCase();
      const table = normIdent(rm[2]);
      const roles = rm[3];
      // We only care about revokes that pull the default table-wide write from authenticated.
      if (/\bon\s+function\b/i.test(rm[0]) || /\bfunction\b/.test(rm[2]))
        continue;
      if (
        !rolesInclude(roles, "authenticated") &&
        !rolesInclude(roles, "public")
      )
        continue;
      const ops: string[] = [];
      if (/\ball\b/.test(privs)) ops.push("insert", "update");
      if (/\binsert\b/.test(privs)) ops.push("insert");
      if (/\bupdate\b/.test(privs)) ops.push("update");
      for (const op of ops) revokedOps.add(`${table}:${op}`);
    }

    // RULE-01: table-wide write grants (per-statement).
    for (const m of clean.matchAll(GRANT_RE)) {
      const privClause = m[1];
      const object = m[2].toLowerCase();
      const roleList = m[3];
      // Skip function-execute grants (handled by RULE-02); those have `on function`.
      if (
        /\bon\s+function\b/i.test(`on ${object}`) ||
        /\bfunction\b/.test(object)
      )
        continue;
      const toAuthOrAnon =
        rolesInclude(roleList, "authenticated") ||
        rolesInclude(roleList, "anon");
      if (!toAuthOrAnon) continue;

      // Blanket "on all tables in schema ..." is always a table-wide hazard.
      const blanket = /\ball\s+tables\s+in\s+schema\b/i.test(object);
      if (!blanket && !isTableWideWrite(privClause)) continue;

      // Resolve the target table name for the allowlist key.
      const tableName = blanket
        ? "*all-tables*"
        : normIdent(
            object
              .replace(/^table\s+/i, "")
              .trim()
              .split(/\s|,/)[0],
          );
      const role = rolesInclude(roleList, "anon") ? "anon" : "authenticated";
      const priv = /\ball\b/i.test(privClause)
        ? "all"
        : /\binsert\b/i.test(privClause)
          ? "insert"
          : "update";
      const identifier = `${tableName}:${priv}:${role}`;
      if (isExempt("table-wide-grant", identifier)) continue;

      violations.push({
        kind: "table-wide-grant",
        identifier,
        migration: file.name,
        message: blanket
          ? `Blanket grant "${privClause.trim()} on all tables in schema ... to ${role}" — RULE-01: never grant table-wide writes to ${role}. Grant per-table, column-scoped.`
          : `Table-wide ${priv.toUpperCase()} grant to ${role} on public.${tableName} (no column list) — RULE-01: RLS gates ROWS not COLUMNS. revoke it and grant ${priv} (editable_cols) instead, or add a documented allowlist entry "${identifier}".`,
      });
    }

    // RULE-02: every SECURITY DEFINER function must revoke execute from
    // authenticated AND anon IN THE SAME migration (and not re-grant it).
    const definerFns = extractDefinerFns(clean);
    if (definerFns.length) {
      const revokedRolesByFn = new Map<string, string>();
      for (const rm of clean.matchAll(REVOKE_EXECUTE_RE)) {
        const fn = normIdent(rm[1]);
        revokedRolesByFn.set(
          fn,
          (revokedRolesByFn.get(fn) || "") + " " + rm[2].toLowerCase(),
        );
      }
      const regrantedFns = new Set<string>();
      for (const gm of clean.matchAll(GRANT_EXECUTE_RE)) {
        const fn = normIdent(gm[1]);
        if (rolesInclude(gm[2], "authenticated") || rolesInclude(gm[2], "anon"))
          regrantedFns.add(fn);
      }

      for (const fn of definerFns) {
        if (isExempt("unlocked-definer-fn", fn.name, file.name)) continue;
        const revoked = revokedRolesByFn.get(fn.name) || "";
        // `revoke ... from public, authenticated, anon` (one statement) satisfies both.
        const revokesAuth = rolesInclude(revoked, "authenticated");
        const revokesAnon = rolesInclude(revoked, "anon");
        const locked = revokesAuth && revokesAnon && !regrantedFns.has(fn.name);
        if (locked) continue;

        let why: string;
        if (!revoked) why = "no revoke-execute for it in this migration";
        else if (!revokesAuth || !revokesAnon)
          why = `its revoke names [${revoked.trim()}] — must revoke from BOTH authenticated AND anon (revoke from public alone is NOT enough: Supabase grants execute to authenticated+anon by default)`;
        else why = "a later grant execute re-grants it to authenticated/anon";

        violations.push({
          kind: "unlocked-definer-fn",
          identifier: fn.name,
          migration: file.name,
          message: `SECURITY DEFINER function public.${fn.name}(${fn.args}) is not locked: ${why}. RULE-02: revoke execute on function public.${fn.name}(...) from public, authenticated, anon; grant execute only to the required role. If it is an intentional RLS-predicate helper (like is_business_member) that must stay executable, add a documented allowlist entry "${fn.name}".`,
        });
      }
    }
  }

  // RULE-A: created tables (not later dropped) must have RLS enabled somewhere.
  for (const [table, mig] of created) {
    if (dropped.has(table)) continue;
    if (rlsEnabled.has(table)) continue;
    if (isExempt("table-no-rls", table)) continue;
    violations.push({
      kind: "table-no-rls",
      identifier: table,
      migration: mig,
      message: `Table public.${table} is created but never gets "alter table ... enable row level security". Every public table needs RLS (CLAUDE.md). Add the enable-RLS statement, or add a documented allowlist entry "${table}".`,
    });
  }

  // RULE-01b: a sensitive-column table with a reachable authenticated/public write policy but no
  // explicit revoke of the default table-wide grant exposes that column (the profiles-INSERT class).
  // Gate a NON-admin user can actually pass: open (true) or owner-scoped (auth.uid()); an is_admin()
  // -only gate is admin-managed and not a RULE-01 hazard (mirrors the live audit).
  const gateNonAdminReachable = (gate: string) => {
    const g = gate.trim().toLowerCase();
    if (g === "" || g === "true") return true;
    return /auth\.(uid|jwt)\s*\(/i.test(g);
  };
  for (const [table, sensCols] of sensitiveColsByTable) {
    if (dropped.has(table)) continue;
    const policies = writePoliciesByTable.get(table) || [];
    for (const op of ["insert", "update"] as const) {
      const reachable = policies.some(
        (p) =>
          (p.cmd === op || p.cmd === "all") &&
          (rolesInclude(p.roles, "authenticated") ||
            rolesInclude(p.roles, "public")) &&
          gateNonAdminReachable(p.gate),
      );
      if (!reachable) continue;
      if (revokedOps.has(`${table}:${op}`)) continue; // default grant explicitly revoked → locked
      const identifier = `${table}:${op}`;
      if (isExempt("unlocked-column-policy", identifier)) continue;
      violations.push({
        kind: "unlocked-column-policy",
        identifier,
        migration:
          policySourceMig.get(table) ?? created.get(table) ?? "(unknown)",
        message: `public.${table} has trust/entitlement column(s) [${[
          ...sensCols,
        ].join(
          ", ",
        )}] and an authenticated ${op.toUpperCase()} policy, but no "revoke ${op} on public.${table} from authenticated". RULE-01b: Supabase's DEFAULT table-wide ${op} grant (never written in a migration) lets the user set those columns on their own row via direct PostgREST, bypassing the API zod strip. Add "revoke ${op} on public.${table} from authenticated;" then "grant ${op} (editable_cols) on public.${table} to authenticated;", or add a documented allowlist entry "${identifier}".`,
      });
    }
  }

  return {
    violations,
    createdTableCount: created.size,
    scannedFileCount: files.length,
  };
}
