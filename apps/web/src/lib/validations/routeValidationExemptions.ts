/**
 * SEC-VALID: mutating routes that legitimately do NOT need a zod body
 * schema (no request body is read, or the body must stay raw for a
 * signature/HMAC check). Each entry must be justified — this file is
 * read by lib/validations/__tests__/route-validation-completeness.test.ts,
 * which fails CI if a new mutating route.ts appears that is neither zod'd
 * nor listed here.
 *
 * `path` is the route.ts location relative to apps/web/src/app/api/,
 * using forward slashes, e.g. "locale/route.ts".
 */
export type RouteValidationExemption = {
  path: string;
  reason: string;
};

export const ROUTE_VALIDATION_EXEMPTIONS: RouteValidationExemption[] = [
  { path: "admin/business/[id]/approve/route.ts", reason: "No request body — target business comes from the [id] path param, action is implicit (approve)." },
  { path: "adverts/[id]/route.ts", reason: "PATCH already validates via updateAdvertSchema (zod import present, satisfies the guard at file level); DELETE reads no body — advert id comes from the path param." },
  { path: "auth/signout/route.ts", reason: "No request body — signs out the current session cookie only." },
  { path: "billing/subscribe/route.ts", reason: "No request body — plan/price are derived server-side from capability flags/env, never client input." },
  { path: "billing/webhook/route.ts", reason: "Must read the RAW request body for Stripe signature (HMAC) verification — parsing/validating it as JSON before verification would defeat the signature check." },
  { path: "business/[id]/members/accept/route.ts", reason: "No request body — invitation target comes from the [id] path param + the authenticated user." },
  { path: "business/[id]/members/[userId]/route.ts", reason: "No request body — DELETE removes the member identified by the [id]/[userId] path params." },
  { path: "business/[id]/verify/route.ts", reason: "No request body — triggers verification for the business identified by the [id] path param." },
  { path: "csp-report/route.ts", reason: "Receives best-effort, unauthenticated browser CSP violation reports in a non-standardized shape; intentionally permissive (logs raw text, tolerates malformed JSON) rather than schema-validated." },
  { path: "media/[id]/route.ts", reason: "No request body — DELETE removes the media row identified by the [id] path param." },
  { path: "notifications/[id]/read/route.ts", reason: "No request body — marks the notification identified by the [id] path param as read." },
  { path: "phone/confirm-native/route.ts", reason: "No request body — reads only the authenticated session." },
  { path: "trust/refresh/route.ts", reason: "No request body — recomputes trust level for the authenticated session's user." },
];
