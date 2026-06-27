import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { createRateLimiter, withRateLimit, getClientIp } from "@/lib/rateLimiter";
import {
  createErrorResponse,
  createSuccessResponse,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { inviteMemberSchema } from "@/lib/validations/teamMembers";

export const runtime = "nodejs";

// Rate limiters: per-user (5/min) and per-IP (10/min)
const userLimiter = createRateLimiter({ limit: 5, windowSec: 60, prefix: "members:invite:user" });
const ipLimiter = createRateLimiter({ limit: 10, windowSec: 60, prefix: "members:invite:ip" });

type ServiceClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: string | null; error: unknown }>;
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
    insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
};

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

const baseHandler = async (
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const { id } = await context.params;

  // 1. Auth
  const cookieClient = (await supabaseServer()) as unknown as CookieClient;
  const {
    data: { user },
  } = await cookieClient.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  // 2. Requester must be accepted admin/owner of the business
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

  // 3. Validate body (role enum excludes 'owner')
  const parseResult = await safeJsonParse<unknown>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(inviteMemberSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { email, role } = validationResult.data;

  // 4. Resolve invitee email → user_id (service-role only RPC)
  const service = (await supabaseService()) as unknown as ServiceClient;
  const { data: inviteeId } = await service.rpc("find_user_by_email", { p_email: email });

  if (!inviteeId) {
    return createErrorResponse(ApiErrorCode.USER_NOT_FOUND, {
      status: 404,
      detail: "invitee must register first",
    });
  }

  // 5. Self-invite guard
  if (inviteeId === user.id) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "cannot invite yourself",
    });
  }

  // 6. Already-member guard (accepted or pending)
  const { data: existingRow } = await service
    .from("business_members")
    .select("user_id")
    .eq("business_id", id)
    .eq("user_id", inviteeId)
    .maybeSingle();

  if (existingRow) {
    return createErrorResponse(ApiErrorCode.ALREADY_MEMBER, { status: 409 });
  }

  // 7. Insert pending invite via service-role
  const { error: insertError } = await service.from("business_members").insert({
    business_id: id,
    user_id: inviteeId,
    role,
    invited_by: user.id,
    accepted_at: null,
  });

  if (insertError) {
    return createErrorResponse(ApiErrorCode.CREATE_FAILED, { status: 500 });
  }

  return createSuccessResponse({ invited: true });
};

export const POST = withRateLimit(
  (req: Request, context: { params: Promise<{ id: string }> }) => baseHandler(req, context),
  {
    limiter: userLimiter,
    makeKey: (_req, userId, ip) => [
      userId ? `user:${userId}` : null,
      ip ? `ip:${ip}` : null,
    ].filter(Boolean) as string[],
    getUserId: async (req) => {
      void req;
      const supabase = await supabaseServer();
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  },
);
