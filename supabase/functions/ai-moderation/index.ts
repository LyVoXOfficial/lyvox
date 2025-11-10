import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

interface ModerationRequest {
  advert_id: string;
  title: string;
  description: string | null;
  category?: string;
}

interface ModerationResponse {
  ok: boolean;
  score?: number; // 0-100, где 0 = полностью безопасно, 100 = критично нарушение
  reason?: string;
  recommendation?: "approve" | "reject" | "review";
  error?: string;
}

const SYSTEM_PROMPT = `You are a content moderation AI for a marketplace platform (LyVoX) that operates in Belgium, Netherlands, France, Germany, and Russia. Your task is to analyze advertisements and determine if they comply with platform rules.

Platform Rules:
1. No illegal items (drugs, weapons, stolen goods, etc.)
2. No adult content or explicit material
3. No spam, scams, or misleading information
4. No hate speech, discrimination, or offensive content
5. No personal information trading
6. Items must be legal to sell in the listed country
7. Descriptions must be accurate and not misleading

Analyze the advertisement and respond with a JSON object containing:
- "score": A number from 0-100 where 0 = completely safe, 100 = critical violation
- "reason": A brief explanation of your assessment
- "recommendation": One of "approve", "reject", or "review" (for borderline cases)

Be strict but fair. Consider context and cultural differences between countries.`;

serve(async (req: Request): Promise<Response> => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "SERVICE_ROLE_NOT_CONFIGURED" } as ModerationResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!openaiApiKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "OPENAI_API_KEY_NOT_CONFIGURED" } as ModerationResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" } as ModerationResponse),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body: ModerationRequest = await req.json();

    if (!body.advert_id || !body.title) {
      return new Response(
        JSON.stringify({ ok: false, error: "MISSING_REQUIRED_FIELDS" } as ModerationResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Prepare content for analysis
    const contentToAnalyze = `
Title: ${body.title}
Description: ${body.description || "No description provided"}
Category: ${body.category || "Unknown"}
`.trim();

    // Call OpenAI API
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Using mini for cost efficiency
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analyze this advertisement:\n\n${contentToAnalyze}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3, // Lower temperature for more consistent moderation
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ ok: false, error: "OPENAI_API_ERROR" } as ModerationResponse),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiData = await openaiResponse.json();
    const moderationResult = JSON.parse(openaiData.choices[0]?.message?.content || "{}");

    // Validate and normalize response
    const score = Math.max(0, Math.min(100, Number(moderationResult.score) || 50));
    const reason = String(moderationResult.reason || "No reason provided");
    const recommendation = moderationResult.recommendation === "approve" || 
                          moderationResult.recommendation === "reject" || 
                          moderationResult.recommendation === "review"
      ? moderationResult.recommendation
      : score < 30 ? "approve" : score > 70 ? "reject" : "review";

    // Log moderation result to database
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    await supabase.from("moderation_logs").insert({
      advert_id: body.advert_id,
      moderation_type: "ai",
      score,
      reason,
      recommendation,
      metadata: {
        model: "gpt-4o-mini",
        openai_response_id: openaiData.id,
      },
    });

    // Update advert with moderation results
    await supabase
      .from("adverts")
      .update({
        ai_moderation_score: score,
        ai_moderation_reason: reason,
        moderation_status: recommendation === "approve" ? "approved" : 
                          recommendation === "reject" ? "rejected" : "pending_review",
      })
      .eq("id", body.advert_id);

    const response: ModerationResponse = {
      ok: true,
      score,
      reason,
      recommendation,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Moderation error:", error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR" 
      } as ModerationResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

