import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type ConsentEntry = {
  accepted?: boolean | null;
  version?: string | null;
  accepted_at?: string | null;
};

type ConsentSnapshot = {
  terms?: ConsentEntry;
  privacy?: ConsentEntry;
  marketing?: ConsentEntry;
} & Record<string, unknown>;

type ProfileRecord = {
  display_name: string | null;
  phone: string | null;
  verified_email: boolean | null;
  verified_phone: boolean | null;
  consents: ConsentSnapshot | null;
};

type PhoneRecord = {
  e164: string | null;
  verified: boolean | null;
};

export async function GET() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      user: null,
      profile: null,
      phone: null,
      verifiedPhone: false,
      verifiedEmail: false,
      consents: null,
    });
  }

  const [profileResult, phoneResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, phone, verified_email, verified_phone, consents")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("phones")
      .select("e164, verified")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const profileRecord = profileResult.error ? null : ((profileResult.data ?? null) as ProfileRecord | null);
  const phoneRecord = phoneResult.error ? null : ((phoneResult.data ?? null) as PhoneRecord | null);

  const phoneNumber = phoneRecord?.e164 ?? profileRecord?.phone ?? null;
  const verifiedPhone = phoneRecord?.verified ?? profileRecord?.verified_phone ?? false;
  const verifiedEmail = Boolean(user.email_confirmed_at ?? profileRecord?.verified_email ?? false);
  const consents = profileRecord?.consents ?? null;

  return NextResponse.json({
    user,
    profile: profileRecord,
    phone: phoneNumber
      ? {
          number: phoneNumber,
          verified: verifiedPhone,
        }
      : null,
    verifiedPhone: !!verifiedPhone,
    verifiedEmail,
    consents,
  });
}
