import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface FraudRule {
  id: string;
  name: string;
  rule_type: string;
  condition: Record<string, unknown>;
  action: "block" | "flag" | "review" | "warn";
  severity: string;
  priority: number;
}

interface DetectionResult {
  rule_id: string;
  rule_name: string;
  match_score: number;
  action_taken: string;
  details: Record<string, unknown>;
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "SERVICE_ROLE_NOT_CONFIGURED" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();
    const { user_id, advert_id, check_type } = body;

    if (!check_type || !["user", "advert"].includes(check_type)) {
      return new Response(
        JSON.stringify({ ok: false, error: "INVALID_CHECK_TYPE" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (check_type === "user" && !user_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "MISSING_USER_ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (check_type === "advert" && !advert_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "MISSING_ADVERT_ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Get enabled fraud rules, ordered by priority
    const { data: rules, error: rulesError } = await supabase
      .from("fraud_rules")
      .select("*")
      .eq("enabled", true)
      .order("priority", { ascending: false });

    if (rulesError) {
      console.error("Failed to fetch fraud rules:", rulesError);
      return new Response(
        JSON.stringify({ ok: false, error: "RULES_FETCH_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, data: { results: [], actions_taken: [] } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: DetectionResult[] = [];
    const actionsTaken: Array<{ action: string; details: Record<string, unknown> }> = [];

    // Evaluate each rule
    for (const rule of rules as FraudRule[]) {
      let matchScore = 0;
      let matched = false;
      let details: Record<string, unknown> = {};

      try {
        // Evaluate rule based on type
        switch (rule.rule_type) {
          case "threshold": {
            const evaluation = await evaluateThresholdRule(
              supabase,
              rule,
              check_type === "user" ? user_id : undefined,
              check_type === "advert" ? advert_id : undefined,
            );
            matchScore = evaluation.score;
            matched = evaluation.matched;
            details = evaluation.details;
            break;
          }
          case "pattern": {
            const evaluation = await evaluatePatternRule(
              supabase,
              rule,
              check_type === "user" ? user_id : undefined,
              check_type === "advert" ? advert_id : undefined,
            );
            matchScore = evaluation.score;
            matched = evaluation.matched;
            details = evaluation.details;
            break;
          }
          case "behavior": {
            const evaluation = await evaluateBehaviorRule(
              supabase,
              rule,
              check_type === "user" ? user_id : undefined,
            );
            matchScore = evaluation.score;
            matched = evaluation.matched;
            details = evaluation.details;
            break;
          }
          default:
            console.warn(`Unknown rule type: ${rule.rule_type}`);
            continue;
        }

        if (matched && matchScore > 0) {
          results.push({
            rule_id: rule.id,
            rule_name: rule.name,
            match_score: matchScore,
            action_taken: rule.action,
            details,
          });

          // Log the detection
          await supabase.from("fraud_detection_logs").insert({
            user_id: check_type === "user" ? user_id : undefined,
            advert_id: check_type === "advert" ? advert_id : undefined,
            rule_id: rule.id,
            rule_name: rule.name,
            match_score: matchScore,
            action_taken: rule.action,
            details,
          });

          // Apply action
          if (rule.action !== "warn") {
            const actionResult = await applyAction(
              supabase,
              rule.action,
              check_type === "user" ? user_id : undefined,
              check_type === "advert" ? advert_id : undefined,
              rule.severity,
              details,
            );
            if (actionResult) {
              actionsTaken.push(actionResult);
            }
          }
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.name}:`, error);
        // Continue with other rules
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          results,
          actions_taken: actionsTaken,
          checked_type: check_type,
          checked_id: check_type === "user" ? user_id : advert_id,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Fraud detection error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// Helper functions for rule evaluation
async function evaluateThresholdRule(
  supabase: ReturnType<typeof createClient>,
  rule: FraudRule,
  userId?: string,
  advertId?: string,
): Promise<{ score: number; matched: boolean; details: Record<string, unknown> }> {
  const condition = rule.condition;
  const type = condition.type as string;

  // This is a simplified implementation - in production, you'd have more sophisticated evaluation
  let score = 0;
  let matched = false;
  const details: Record<string, unknown> = {};

  if (type === "advert_count" && userId) {
    const timeWindow = (condition.time_window_hours as number) || 24;
    const maxAdverts = (condition.max_adverts as number) || 5;
    const cutoff = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

    const { count } = await supabase
      .from("adverts")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", userId)
      .gte("created_at", cutoff.toISOString());

    const advertCount = count || 0;
    if (advertCount > maxAdverts) {
      score = Math.min(100, ((advertCount - maxAdverts) / maxAdverts) * 100);
      matched = true;
      details.advert_count = advertCount;
      details.max_allowed = maxAdverts;
    }
  }

  return { score, matched, details };
}

async function evaluatePatternRule(
  supabase: ReturnType<typeof createClient>,
  rule: FraudRule,
  userId?: string,
  advertId?: string,
): Promise<{ score: number; matched: boolean; details: Record<string, unknown> }> {
  const condition = rule.condition;
  const type = condition.type as string;

  let score = 0;
  let matched = false;
  const details: Record<string, unknown> = {};

  if (type === "verification_check" && userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("verified_email, verified_phone")
      .eq("id", userId)
      .single();

    if (profile) {
      const requireEmail = (condition.require_email as boolean) || false;
      const requirePhone = (condition.require_phone as boolean) || false;

      if ((requireEmail && !profile.verified_email) || (requirePhone && !profile.verified_phone)) {
        score = 50;
        matched = true;
        details.verification_status = {
          email: profile.verified_email,
          phone: profile.verified_phone,
        };
      }
    }
  }

  return { score, matched, details };
}

async function evaluateBehaviorRule(
  supabase: ReturnType<typeof createClient>,
  rule: FraudRule,
  userId?: string,
): Promise<{ score: number; matched: boolean; details: Record<string, unknown> }> {
  const condition = rule.condition;
  const type = condition.type as string;

  let score = 0;
  let matched = false;
  const details: Record<string, unknown> = {};

  if (type === "account_age_activity" && userId) {
    const maxAgeDays = (condition.max_age_days as number) || 7;
    const maxAdverts = (condition.max_adverts as number) || 10;

    const { data: profile } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("id", userId)
      .single();

    if (profile) {
      const accountAge = (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (accountAge <= maxAgeDays) {
        const { count } = await supabase
          .from("adverts")
          .select("id", { head: true, count: "exact" })
          .eq("user_id", userId);

        const advertCount = count || 0;
        if (advertCount > maxAdverts) {
          score = Math.min(100, ((advertCount - maxAdverts) / maxAdverts) * 100);
          matched = true;
          details.account_age_days = accountAge;
          details.advert_count = advertCount;
        }
      }
    }
  }

  return { score, matched, details };
}

async function applyAction(
  supabase: ReturnType<typeof createClient>,
  action: string,
  userId?: string,
  advertId?: string,
  severity?: string,
  details?: Record<string, unknown>,
): Promise<{ action: string; details: Record<string, unknown> } | null> {
  if (action === "block" && userId) {
    // Block user for a duration based on severity
    const blockHours = severity === "critical" ? 168 : severity === "high" ? 72 : 24; // 7 days, 3 days, or 1 day
    const blockedUntil = new Date(Date.now() + blockHours * 60 * 60 * 1000);

    await supabase
      .from("profiles")
      .update({ blocked_until: blockedUntil.toISOString() })
      .eq("id", userId);

    return {
      action: "blocked",
      details: { blocked_until: blockedUntil.toISOString(), severity },
    };
  }

  if (action === "flag" && userId) {
    // Add flag to user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("flags")
      .eq("id", userId)
      .single();

    const flags = (profile?.flags as Record<string, unknown>) || {};
    flags.fraud_suspected = true;
    flags.flagged_at = new Date().toISOString();

    await supabase.from("profiles").update({ flags }).eq("id", userId);

    return {
      action: "flagged",
      details: { flags },
    };
  }

  if (action === "review" && advertId) {
    // Mark advert for review
    await supabase
      .from("adverts")
      .update({ moderation_status: "pending_review" })
      .eq("id", advertId);

    return {
      action: "marked_for_review",
      details: { advert_id: advertId },
    };
  }

  return null;
}

