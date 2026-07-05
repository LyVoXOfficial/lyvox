import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import {
  createErrorResponse,
  createSuccessResponse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { assertSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";

type CookieClient = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => {
          not: (col: string, op: string, val: unknown) => {
            in: (col: string, vals: unknown[]) => {
              maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
            };
          };
        };
      };
    };
  };
};

type ServiceClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{ data: { role: string } | null; error: unknown }>;
        };
      };
    };
    delete: () => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => Promise<{ error: unknown }>;
      };
    };
  };
};

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string; userId: string }> },
): Promise<Response> {
  const csrfError = assertSameOrigin(_req);
  if (csrfError) return csrfError;

  const { id, userId } = await context.params;

  // 1. Auth
  const cookieClient = (await supabaseServer()) as unknown as CookieClient;
  const {
    data: { user },
  } = await cookieClient.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  // 2. Requester must be accepted admin/owner
  const { data: adminRow } = await cookieClient
    .from("business_members")
    .select("role")
    .eq("business_id", id)
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!adminRow) {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, { status: 403 });
  }

  // 3. Load the target row
  const service = (await supabaseService()) as unknown as ServiceClient;
  const { data: targetRow } = await service
    .from("business_members")
    .select("role")
    .eq("business_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!targetRow) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404 });
  }

  // 4. Cannot remove an owner
  if (targetRow.role === "owner") {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, {
      status: 403,
      detail: "cannot remove an owner",
    });
  }

  // 5. Cannot remove self (use leave-business flow)
  if (userId === user.id) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "cannot remove yourself; use the leave-business flow",
    });
  }

  // 6. Delete via service-role (after gate passes)
  const { error: deleteError } = await service
    .from("business_members")
    .delete()
    .eq("business_id", id)
    .eq("user_id", userId);

  if (deleteError) {
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, { status: 500 });
  }

  return createSuccessResponse({ removed: true });
}
