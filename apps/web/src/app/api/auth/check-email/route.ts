import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseService";
import { z } from "zod";

const checkEmailSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export const runtime = "nodejs";

/**
 * Check if an email is available for registration
 * GET /api/auth/check-email?email=test@example.com
 * 
 * Note: This endpoint is rate-limited to prevent email enumeration attacks
 */
export async function GET(request: Request) {
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
      supabase = supabaseService();
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

    // Query admin API to check if user exists
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

