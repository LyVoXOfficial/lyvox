import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
export const runtime = "nodejs";

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
        set(name: string, value: string, options: any) {
          const opts = options ?? {};
          cookieStore.set({ name, value, ...opts });
        },
        remove(name: string, options: any) {
          const opts = options ?? {};
          cookieStore.set({ name, value: "", ...opts, maxAge: 0 });
        },
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = String(body?.code || "").trim();
    const phone = String(body?.phone || "").trim();

    const supabase = supaFromRoute();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok:false, error:"UNAUTH" }, { status: 401 });

    // берём последний неиспользованный OTP к этому номеру
    const { data: otps, error } = await supabase
      .from("phone_otps")
      .select("*")
      .eq("user_id", user.id)
      .eq("e164", phone)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !otps?.length) {
      return NextResponse.json({ ok:false, error:"OTP_NOT_FOUND" }, { status: 400 });
    }

    const otp = otps[0];
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ ok:false, error:"OTP_EXPIRED" }, { status: 400 });
    }
    if (otp.attempts >= 5) {
      return NextResponse.json({ ok:false, error:"OTP_LOCKED" }, { status: 429 });
    }
    if (otp.code !== code) {
      await supabase.from("phone_otps").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
      return NextResponse.json({ ok:false, error:"OTP_INVALID" }, { status: 400 });
    }

    // успех
    await supabase.from("phone_otps").update({ used: true }).eq("id", otp.id);
    await supabase.from("phones").update({ verified: true }).eq("user_id", user.id);

    await supabase.from("logs").insert({
      user_id: user.id,
      action: "phone_verify",
      details: { e164: phone }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('PHONE_VERIFY_ERROR', e);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR', detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
