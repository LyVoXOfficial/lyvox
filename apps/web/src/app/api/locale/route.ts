import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveLocale, type Locale } from "@/lib/i18n";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locale } = body;

    if (!locale || typeof locale !== "string") {
      return NextResponse.json(
        { ok: false, error: "INVALID_LOCALE" },
        { status: 400 }
      );
    }

    const resolvedLocale = resolveLocale(locale);
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

