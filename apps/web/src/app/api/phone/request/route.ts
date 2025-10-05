import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";

export const runtime = "nodejs";

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const OTP_USER_ATTEMPTS = parsePositiveInt(process.env.RATE_LIMIT_OTP_USER_PER_15M, 5);
const OTP_WINDOW_SEC = 15 * 60;
const OTP_FALLBACK_ATTEMPTS = OTP_USER_ATTEMPTS;
const OTP_IP_ATTEMPTS = parsePositiveInt(process.env.RATE_LIMIT_OTP_IP_PER_60M, 20);
const OTP_IP_WINDOW_SEC = 60 * 60;

const otpUserLimiter = createRateLimiter({
  limit: OTP_USER_ATTEMPTS,
  windowSec: OTP_WINDOW_SEC,
  prefix: "otp:user",
});

const otpFallbackLimiter = createRateLimiter({
  limit: OTP_FALLBACK_ATTEMPTS,
  windowSec: OTP_WINDOW_SEC,
  prefix: "otp:ip",
  bucketId: "fallback",
});

const otpIpLimiter = createRateLimiter({
  limit: OTP_IP_ATTEMPTS,
  windowSec: OTP_IP_WINDOW_SEC,
  prefix: "otp:ip",
  bucketId: "global",
});

function supaFromRoute() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: Record<string, unknown>) {
          const opts = options ?? {};
          cookieStore.set({ name, value, ...opts });
        },
        remove(name: string, options?: Record<string, unknown>) {
          const opts = options ?? {};
          cookieStore.set({ name, value: "", ...opts, maxAge: 0 });
        },
      },
    },
  );
}

type SupabaseClient = ReturnType<typeof supaFromRoute>;
type SupabaseUser = Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"];
type RequestContext = { supabase: SupabaseClient; user: SupabaseUser };

const contextCache = new WeakMap<Request, Promise<RequestContext>>();

const getRequestContext = (req: Request): Promise<RequestContext> => {
  let cached = contextCache.get(req);
  if (!cached) {
    const supabase = supaFromRoute();
    cached = supabase.auth.getUser().then(({ data }) => ({ supabase, user: data.user ?? null }));
    contextCache.set(req, cached);
  }
  return cached;
};

const resolveUserId = (req: Request) => getRequestContext(req).then(({ user }) => user?.id ?? null);

const e164 = (s: string) => /^\+\d{8,15}$/.test(s);

const baseHandler = async (req: Request) => {
  try {
    const body = await req.json();
    const phone: string = (body?.phone || "").trim();

    if (!e164(phone)) {
      return NextResponse.json({ ok: false, error: "INVALID_FORMAT" }, { status: 400 });
    }

    const { supabase, user } = await getRequestContext(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });
    }

    let lookup: unknown = null;
    try {
      const url = `${process.env.TWILIO_LOOKUP_URL}/${encodeURIComponent(phone)}?Type=carrier`;
      const res = await fetch(url, {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
        },
      });
      lookup = await res.json();
    } catch {
      // Lookup failures should not block OTP issuance.
    }

    await supabase.from("phones").upsert({
      user_id: user.id,
      e164: phone,
      verified: false,
      lookup,
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from("phone_otps").insert({
      user_id: user.id,
      e164: phone,
      code,
      expires_at: expires,
    });

    try {
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: process.env.TWILIO_FROM!,
            To: phone,
            Body: `LyVoX: ваш код подтверждения ${code}. Действителен 10 минут.`,
          }),
        },
      );
    } catch {
      return NextResponse.json({ ok: false, error: "SMS_SEND_FAIL" }, { status: 500 });
    }

    await supabase.from("logs").insert({
      user_id: user.id,
      action: "phone_request",
      details: { e164: phone, lookup },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("PHONE_REQUEST_ERROR", error);
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
};

const withFallbackLimit = withRateLimit(baseHandler, {
  limiter: otpFallbackLimiter,
  getUserId: resolveUserId,
  makeKey: (_req, userId, ip) => (!userId && ip ? ip : null),
});

const withUserLimit = withRateLimit(withFallbackLimit, {
  limiter: otpUserLimiter,
  getUserId: resolveUserId,
  makeKey: (_req, userId) => (userId ? userId : null),
});

export const POST = withRateLimit(withUserLimit, {
  limiter: otpIpLimiter,
  makeKey: (_req, _userId, ip) => (ip ? ip : null),
});
