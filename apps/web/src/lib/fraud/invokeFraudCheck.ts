import "server-only";
import { supabaseService } from "@/lib/supabaseService";

type CheckType = "user" | "advert";

export interface FraudCheckParams {
  /** "user" evaluates velocity/behavior rules on the actor.
   *  "advert" evaluates pattern/price-anomaly rules on the listing. */
  check_type: CheckType;
  user_id?: string;
  advert_id?: string;
}

export interface FraudCheckResult {
  blocked: boolean;
  flagged: boolean;
}

// 5-second cap: a slow or unavailable Edge Function must not stall the HTTP
// response. @vercel/functions waitUntil() is not installed, so we await with
// a timeout instead — the check completes before the response is sent.
const FRAUD_CHECK_TIMEOUT_MS = 5_000;

const FALLBACK: FraudCheckResult = { blocked: false, flagged: false };

/**
 * Invokes the fraud-detection Supabase Edge Function and returns the
 * highest-severity action taken. Contract (from supabase/functions/fraud-detection):
 *   POST { check_type: "user"|"advert", user_id?, advert_id? }
 *   → { ok: boolean, data: { results, actions_taken: [{action}] } }
 *
 * Never throws — any error (network, config, timeout) resolves to FALLBACK so
 * the fraud engine stays non-critical for the happy path. Callers must still
 * gate on checkUserBlocked() for hard-stop enforcement.
 */
export async function invokeFraudCheck(
  params: FraudCheckParams,
): Promise<FraudCheckResult> {
  const run = async (): Promise<FraudCheckResult> => {
    try {
      const service = await supabaseService();
      const { data, error } = await service.functions.invoke<{
        ok: boolean;
        data?: { actions_taken?: Array<{ action: string }> };
      }>("fraud-detection", { body: params });

      if (error || !data?.ok) return FALLBACK;

      const actions = data.data?.actions_taken ?? [];
      return {
        blocked: actions.some((a) => a.action === "blocked"),
        flagged: actions.some((a) => a.action === "flagged"),
      };
    } catch {
      return FALLBACK;
    }
  };

  const timeout = new Promise<FraudCheckResult>((resolve) =>
    setTimeout(() => resolve(FALLBACK), FRAUD_CHECK_TIMEOUT_MS),
  );

  return Promise.race([run(), timeout]);
}
