import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  ApiErrorCode,
} from "@/lib/apiErrors";

export const runtime = "nodejs";

type CookieClient = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
  from: (table: string) => {
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => {
          is: (col: string, val: null) => {
            select: (cols: string) => Promise<{ data: unknown[] | null; error: unknown }>;
          };
        };
      };
    };
  };
};

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  // 1. Auth
  const cookieClient = (await supabaseServer()) as unknown as CookieClient;
  const {
    data: { user },
  } = await cookieClient.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  // 2. Update own pending row — only accepted_at, never role (RLS bm_invitee_accept pins role)
  const { data: updated, error: updateError } = await cookieClient
    .from("business_members")
    .update({ accepted_at: new Date().toISOString() })
    .eq("business_id", id)
    .eq("user_id", user.id)
    .is("accepted_at", null)
    .select("user_id");

  if (updateError) {
    return createErrorResponse(ApiErrorCode.UPDATE_FAILED, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, {
      status: 404,
      detail: "no pending invite found",
    });
  }

  return createSuccessResponse({ accepted: true });
}
