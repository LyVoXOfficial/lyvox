import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const otpGraceMinutes = Number(Deno.env.get("OTP_PURGE_GRACE_MINUTES") ?? "0");
const logRetentionMonths = Number(Deno.env.get("LOG_RETENTION_MONTHS") ?? "18");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

serve(async (req) => {
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "SERVICE_ROLE_NOT_CONFIGURED" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const now = new Date();
  const otpCutoff = new Date(now);
  if (otpGraceMinutes > 0) {
    otpCutoff.setMinutes(otpCutoff.getMinutes() - otpGraceMinutes);
  }
  const otpCutoffIso = otpCutoff.toISOString();

  const { error: otpError, count: otpDeleted } = await supabase
    .from("phone_otps")
    .delete({ count: "exact" })
    .lte("expires_at", otpCutoffIso);

  if (otpError) {
    console.error("Failed to purge OTPs", otpError);
    return new Response(
      JSON.stringify({ ok: false, error: "OTP_PURGE_FAILED", detail: otpError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const logCutoff = new Date(now);
  logCutoff.setMonth(logCutoff.getMonth() - logRetentionMonths);
  const logCutoffIso = logCutoff.toISOString();

  const anonymisedDetails = {
    redacted: true,
    anonymised_at: now.toISOString(),
  };

  const { error: logError, count: logsAnonymised } = await supabase
    .from("logs")
    .update({
      user_id: null,
      details: anonymisedDetails,
    })
    .lt("created_at", logCutoffIso)
    .not("details", "is", null)
    .select("id", { head: true, count: "exact" });

  if (logError) {
    console.error("Failed to anonymise logs", logError);
    return new Response(
      JSON.stringify({ ok: false, error: "LOG_ANONYMISATION_FAILED", detail: logError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      deletedOtps: otpDeleted ?? 0,
      anonymisedLogs: logsAnonymised ?? 0,
      otpCutoff: otpCutoffIso,
      logCutoff: logCutoffIso,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
