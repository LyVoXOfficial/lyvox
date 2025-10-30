import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabaseTypes";

export const runtime = "nodejs";

type PhoneOtpRow = Tables<"phone_otps">;

const sanitize = (value: unknown) => String(value ?? "").trim();

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const code = sanitize((payload as Record<string, unknown>).code);
  const phone = sanitize((payload as Record<string, unknown>).phone);

  if (!code || !phone) {
    return NextResponse.json({ ok: false, error: "BAD_INPUT" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTH" }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("phone_otps")
    .select("*")
    .eq("user_id", user.id)
    .eq("e164", phone)
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !rows?.length) {
    return NextResponse.json({ ok: false, error: "OTP_NOT_FOUND" }, { status: 400 });
  }

  const otp = rows[0] as PhoneOtpRow;
  const now = Date.now();
  const expiresAt = otp.expires_at ? new Date(otp.expires_at).getTime() : 0;

  if (expiresAt < now) {
    return NextResponse.json({ ok: false, error: "OTP_EXPIRED" }, { status: 400 });
  }

  if ((otp.attempts ?? 0) >= 5) {
    return NextResponse.json({ ok: false, error: "OTP_LOCKED" }, { status: 429 });
  }

  const computedHash = createHmac("sha256", otp.code_salt).update(code).digest("hex");
  if (otp.code_hash !== computedHash) {
    const updateAttempt: TablesUpdate<"phone_otps"> = { attempts: (otp.attempts ?? 0) + 1 };
    await supabase.from("phone_otps").update(updateAttempt).eq("id", otp.id);
    return NextResponse.json({ ok: false, error: "OTP_INVALID" }, { status: 400 });
  }

  const markUsed: TablesUpdate<"phone_otps"> = { used: true };
  await supabase.from("phone_otps").update(markUsed).eq("id", otp.id);

  const phoneUpdate: TablesUpdate<"phones"> = { verified: true };
  const { error: phoneUpdateError } = await supabase.from("phones").update(phoneUpdate).eq("user_id", user.id);
  if (phoneUpdateError) {
    return NextResponse.json(
      { ok: false, error: "PHONE_UPDATE_FAILED", message: phoneUpdateError.message },
      { status: 400 },
    );
  }

  const logEntry: TablesInsert<"logs"> = {
    user_id: user.id,
    action: "phone_verify",
    details: { e164: phone, otp_last_four: otp.code_last_four },
  };
  const { error: logError } = await supabase.from("logs").insert(logEntry);
  if (logError) {
    console.warn("PHONE_VERIFY_LOG_FAILED", logError.message);
  }

  return NextResponse.json({ ok: true });
}
