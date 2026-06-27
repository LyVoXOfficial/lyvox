import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { hasAdminRole } from "@/lib/adminRole";
import {
  createErrorResponse,
  createSuccessResponse,
  ApiErrorCode,
} from "@/lib/apiErrors";

export const runtime = "nodejs";

// §8.3 public DSA trader-panel subset — explicit whitelist (never spread full row)
const PUBLIC_FIELDS = [
  "legal_name",
  "trade_name",
  "legal_form",
  "address_line",
  "postcode",
  "city",
  "country",
  "kbo_number",
  "vat_number",
  "vat_liable",
  "email",
  "phone_e164",
  "withdrawal_terms",
  "self_certified_at",
  "entity_verified",
] as const;

type BusinessRow = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  legal_form: string | null;
  address_line: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  kbo_number: string | null;
  vat_number: string | null;
  vat_liable: boolean;
  email: string;
  phone_e164: string | null;
  withdrawal_terms: string | null;
  self_certified_at: string | null;
  entity_verified: boolean;
  status: string;
  created_by: string | null;
  returns_url: string | null;
  self_certified_ip: string | null;
  created_at: string;
  updated_at: string;
};

type VerificationRow = {
  method: string;
  status: string;
  verified_at: string | null;
  created_at: string;
};

function computeBadges(row: { entity_verified: boolean; vat_number: string | null }) {
  return {
    verified_business: row.entity_verified,
    vat_registered: !!row.vat_number && row.entity_verified,
  };
}

function buildPublicSubset(row: BusinessRow) {
  const pub: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) {
    pub[key] = row[key as keyof BusinessRow] ?? null;
  }
  return pub;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  // ── Identify viewer (anon allowed) ─────────────────────────────────────────
  const cookieClient = await supabaseServer();
  const {
    data: { user },
  } = await cookieClient.auth.getUser();

  // ── Fetch full business row via service-role (bypasses RLS) ────────────────
  const service = await supabaseService();
  const { data: row, error: fetchError } = await service
    .from("businesses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !row) {
    return createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, { status: 404 });
  }

  const business = row as BusinessRow;

  // ── Determine viewer privilege ──────────────────────────────────────────────
  const isAdminUser = hasAdminRole(user);

  let isMember = false;
  if (user && !isAdminUser) {
    // is_business_member is not in generated types — cast via unknown
    const { data: memberResult } = await (
      cookieClient as unknown as {
        rpc: (
          fn: string,
          args: { b_id: string; min_role: string },
        ) => Promise<{ data: boolean | null; error: null }>;
      }
    ).rpc("is_business_member", { b_id: id, min_role: "member" });
    isMember = memberResult === true;
  }

  const isPrivileged = isAdminUser || isMember;

  // ── Member/admin branch: full private row + verifications summary ───────────
  if (isPrivileged) {
    // Fetch latest verification per method
    const { data: verRows } = await service
      .from("verifications")
      .select("method, status, verified_at, created_at")
      .eq("subject_type", "business")
      .eq("subject_id", id)
      .order("created_at", { ascending: false });

    // Reduce to latest row per method
    const latestByMethod: Record<string, VerificationRow> = {};
    for (const v of (verRows ?? []) as VerificationRow[]) {
      if (!latestByMethod[v.method]) {
        latestByMethod[v.method] = v;
      }
    }
    const verifications = Object.values(latestByMethod).map((v) => ({
      method: v.method,
      status: v.status,
      verified_at: v.verified_at,
    }));

    return createSuccessResponse({
      business: business,
      badges: computeBadges(business),
      verifications,
    });
  }

  // ── Public branch: only if active; return §8.3 subset ─────────────────────
  if (business.status !== "active") {
    // Don't reveal drafts/suspended to non-members
    return createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, { status: 404 });
  }

  return createSuccessResponse({
    business: buildPublicSubset(business),
    badges: computeBadges(business),
  });
}
