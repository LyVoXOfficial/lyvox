import type { AuthzExemption } from "./authzMigrationGuard";

/**
 * SEC-AUTHZ-GUARD historical allowlist.
 *
 * The static migration guard (authz-migration-guard.test.ts) enforces RULE-A / RULE-01 / RULE-02
 * on every migration. Genuine, intentional historical exceptions are grandfathered here — the same
 * escape-hatch pattern as ROUTE_VALIDATION_EXEMPTIONS (SEC-VALID). Every entry MUST carry a reason
 * (> 10 chars) explaining why it is safe/intentional. A NEW migration that trips a rule must either
 * fix the migration or add a justified entry here (which forces a reviewer decision).
 *
 * Keep this list SMALL. Prefer fixing the migration over allowlisting. Do NOT use an allowlist entry
 * to paper over a real hole — a genuinely RLS-missing user table or a genuinely-escalatable function
 * is a bug to fix, not to exempt.
 */
export const AUTHZ_GUARD_EXEMPTIONS: AuthzExemption[] = [
  // ── RULE-02: SECURITY DEFINER functions that are intentional RLS-predicate helpers / RPCs and
  //    MUST stay executable by `authenticated` (they act on auth.uid(), never a caller id, so no
  //    privilege escalation). Revoking their execute would break the RLS policies that call them.
  {
    kind: "unlocked-definer-fn",
    identifier: "is_business_member",
    reason:
      "RLS-predicate helper called from businesses/business_members policies; acts on auth.uid() membership, not a caller-supplied id — must stay EXECUTE-able by authenticated.",
  },
  {
    kind: "unlocked-definer-fn",
    identifier: "is_conversation_participant",
    reason:
      "RLS-predicate helper for chat policies (fixes the self-referential recursion); checks the current user's participation — must stay EXECUTE-able by authenticated.",
  },
  {
    kind: "unlocked-definer-fn",
    identifier: "is_user_blocked",
    reason:
      "Predicate helper used by fraud/publish checks; returns a boolean block status and does not mutate — intentionally callable by authenticated.",
  },
  {
    kind: "unlocked-definer-fn",
    identifier: "user_has_flag",
    reason:
      "Feature-flag predicate helper read by RLS/route checks; returns a boolean and does not mutate — intentionally callable by authenticated.",
  },
  {
    kind: "unlocked-definer-fn",
    identifier: "create_review",
    reason:
      "RPC the buyer calls to create their own review; authorizes on auth.uid() internally (purchase ownership), so authenticated execute is the intended entry point.",
  },
  {
    kind: "unlocked-definer-fn",
    identifier: "start_conversation",
    reason:
      "RPC the user calls to open a chat about an advert; authorizes on auth.uid() internally — authenticated execute is the intended entry point.",
  },
  {
    kind: "unlocked-definer-fn",
    identifier: "search_adverts",
    reason:
      "Public FTS search RPC (fixed 13-arg signature); its uuid arg is a category_id FILTER, not a caller identity — read-only, returns only active adverts, and must stay executable by anon+authenticated so search works logged-out.",
  },

  // ── RULE-01: table-wide write grants that are pre-existing and verified NOT column-exposure holes.
  {
    kind: "table-wide-grant",
    identifier: "chat_offers:insert:authenticated",
    reason:
      "INSERT is gated by policy chat_offers_sender_insert whose with_check PINS the sensitive column (status='sent') plus currency='EUR', sender_id=auth.uid() and conversation participation (verified live); the remaining columns (amount/advert_id/conversation_id) are the buyer's own offer data — no unpinned trust/entitlement column is exposed.",
  },

  // ── RULE-01b: pre-existing sensitive-column tables whose default table-wide write grant is not
  //    yet revoked. The genuine ones are KNOWN and tracked for remediation (column-scope) in
  //    docs/security/SEC-AUTHZ-GUARD-live-audit.md; allowlisted so the guard gates NEW migrations
  //    without being red on the baseline. The staleness test will force removal of each entry once
  //    its "revoke <op> ... from authenticated" lands. RULE-01b now BLOCKS any new such migration.
  {
    kind: "unlocked-column-policy",
    identifier: "profiles:insert",
    reason:
      "KNOWN pre-existing hole (verified_*/itsme_*/pro_until settable on self-insert); UPDATE was column-scoped by the lockdown, INSERT was not. Tracked for remediation in SEC-AUTHZ-GUARD-live-audit.md — remove this entry when the revoke lands.",
  },
  {
    kind: "unlocked-column-policy",
    identifier: "purchases:insert",
    reason:
      "KNOWN pre-existing (status settable on self-insert). Money-flow is F3-gated regardless; tracked for remediation in SEC-AUTHZ-GUARD-live-audit.md — remove when column-scoped.",
  },
  {
    kind: "unlocked-column-policy",
    identifier: "reports:insert",
    reason:
      "KNOWN pre-existing (status settable on insert). Low impact (moderation re-derives status) but tracked for remediation in SEC-AUTHZ-GUARD-live-audit.md — remove when column-scoped.",
  },
  {
    kind: "unlocked-column-policy",
    identifier: "business_members:update",
    reason:
      "Mostly mitigated: the update policy with_check pins user_id=auth.uid() and role=(caller's existing role subquery), preventing self-escalation; still tracked for defense-in-depth column-scoping in SEC-AUTHZ-GUARD-live-audit.md.",
  },
  {
    kind: "unlocked-column-policy",
    identifier: "property_listings:insert",
    reason:
      "Heuristic match on physical-attribute columns (renovation_year/elevator), not trust/entitlement — the owner legitimately sets these on their own listing. No lock needed.",
  },
  {
    kind: "unlocked-column-policy",
    identifier: "property_listings:update",
    reason:
      "Heuristic match on physical-attribute columns (renovation_year/elevator), not trust/entitlement — the owner legitimately edits these on their own listing. No lock needed.",
  },
  {
    kind: "unlocked-column-policy",
    identifier: "job_listings:insert",
    reason:
      "Heuristic match on attribute column education_level, not a trust/entitlement field — the poster legitimately sets it on their own job listing. No lock needed.",
  },
  {
    kind: "unlocked-column-policy",
    identifier: "job_listings:update",
    reason:
      "Heuristic match on attribute column education_level, not a trust/entitlement field — the poster legitimately edits it on their own job listing. No lock needed.",
  },

  // ── RULE-A: created tables intentionally without RLS. Verified live: authenticated/anon hold NO
  //    write grant on these, so RLS-off does not make them user-writable — they are SELECT-only
  //    catalog-schema reference tables, written only by service-role/seed.
  {
    kind: "table-no-rls",
    identifier: "catalog_fields",
    reason:
      "Catalog schema-definition reference table (dynamic per-category form fields); RLS off but authenticated/anon hold NO write grant (verified live) — SELECT-only, service-role managed.",
  },
  {
    kind: "table-no-rls",
    identifier: "catalog_field_options",
    reason:
      "Catalog schema-definition reference table (field option lists); RLS off but authenticated/anon hold NO write grant (verified live) — SELECT-only, service-role managed.",
  },
  {
    kind: "table-no-rls",
    identifier: "catalog_subcategory_schema",
    reason:
      "Catalog schema-definition reference table (subcategory→field mapping); RLS off but authenticated/anon hold NO write grant (verified live) — SELECT-only, service-role managed.",
  },
];
