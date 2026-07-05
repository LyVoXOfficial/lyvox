import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveLocale, type Locale } from "@/lib/i18n";
import { validateRequest, setLocaleSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "INVALID_LOCALE" },
        { status: 400 }
      );
    }

    const validation = validateRequest(setLocaleSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { ok: false, error: "INVALID_LOCALE" },
        { status: 400 }
      );
    }

    const resolvedLocale = resolveLocale(validation.data.locale);
    const cookieStore = await cookies();

    // Set cookie with locale
    cookieStore.set("locale", resolvedLocale, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      sameSite: "lax",
      httpOnly: false, // Allow client-side access
    });

    return NextResponse.json({ ok: true, locale: resolvedLocale });
  } catch (error) {
    console.error("Error setting locale:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

