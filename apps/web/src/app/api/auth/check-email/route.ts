import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseService";
import { createRateLimiter, withRateLimit, getClientIp } from "@/lib/rateLimiter";
import { z } from "zod";

const checkEmailSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export const runtime = "nodejs";

// This endpoint is an email-existence oracle, so it must be rate-limited to
// slow down enumeration and prevent the service-role `listUsers()` scan below
// from being used as a DoS amplifier.
const checkEmailIpLimiter = createRateLimiter({
  limit: 20,
  windowSec: 60,
  prefix: "check-email:ip",
});

/**
 * Check if an email is available for registration
 * GET /api/auth/check-email?email=test@example.com
 *
 * Rate-limited per IP to mitigate email enumeration attacks.
 */
async function handleGet(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    // Validate email format
    const validation = checkEmailSchema.safeParse({ email });
    if (!validation.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_EMAIL",
          detail: validation.error.issues[0]?.message || "Invalid email format",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = validation.data.email.trim().toLowerCase();

    // Use service role to check auth.users table
    let supabase;
    try {
      supabase = await supabaseService();
    } catch {
      // If service role is not available, return generic success
      // This prevents revealing infrastructure issues
      return NextResponse.json(
        {
          ok: true,
          available: true,
        },
        { 
          status: 200,
          headers: {
            "Cache-Control": "no-store, must-revalidate",
          },
        }
      );
    }

    // NOTE: `listUsers()` without pagination only returns the first page
    // (~50 users), so this existence check is not reliable once the user base
    // grows. Uniqueness is ultimately enforced by Supabase Auth at signUp, so a
    // false "available" only degrades pre-validation UX. For a correct + indexed
    // lookup, expose a SECURITY DEFINER RPC (e.g. `email_exists(text)`) and call
    // it here instead of scanning the table. Tracked in docs/SECURITY_AUDIT.md.
    const { data: users, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error("Error checking email:", error);
      // Don't reveal the error to the client
      return NextResponse.json(
        {
          ok: true,
          available: true,
        },
        { 
          status: 200,
          headers: {
            "Cache-Control": "no-store, must-revalidate",
          },
        }
      );
    }

    // Check if email exists
    const emailExists = users.users.some(
      (user) => user.email?.toLowerCase() === normalizedEmail
    );

    return NextResponse.json(
      {
        ok: true,
        available: !emailExists,
      },
      { 
        status: 200,
        headers: {
          "Cache-Control": "no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Email check error:", error);
    // Return available: true on error to not block the user
    return NextResponse.json(
      {
        ok: true,
        available: true,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, must-revalidate",
        },
      }
    );
  }
}

export const GET = withRateLimit(handleGet, {
  limiter: checkEmailIpLimiter,
  makeKey: (req, _userId, ip) => ip ?? getClientIp(req) ?? "anonymous",
});

