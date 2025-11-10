import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Checks if a user is currently blocked
 * @param userId - User ID to check
 * @returns Object with isBlocked boolean and blockedUntil timestamp if blocked
 */
export async function checkUserBlocked(userId: string): Promise<{
  isBlocked: boolean;
  blockedUntil: string | null;
  reason?: string;
}> {
  const supabase = await supabaseServer();
  
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("blocked_until, flags")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    // If we can't fetch profile, allow operation (fail open)
    return { isBlocked: false, blockedUntil: null };
  }

  const blockedUntil = profile.blocked_until;
  if (!blockedUntil) {
    return { isBlocked: false, blockedUntil: null };
  }

  const now = new Date();
  const blockedUntilDate = new Date(blockedUntil);

  if (blockedUntilDate > now) {
    // User is still blocked
    const flags = (profile.flags as Record<string, unknown>) || {};
    const reason = flags.fraud_suspected
      ? "Account flagged for fraud"
      : flags.spam_detected
        ? "Account flagged for spam"
        : "Account temporarily blocked";

    return {
      isBlocked: true,
      blockedUntil,
      reason,
    };
  } else {
    // Block has expired, but we don't clear it here (let the database function handle it)
    return { isBlocked: false, blockedUntil: null };
  }
}

/**
 * Checks if a user has any fraud-related flags
 * @param userId - User ID to check
 * @returns Object with hasFlags boolean and flagNames array
 */
export async function checkUserFlags(userId: string): Promise<{
  hasFlags: boolean;
  flagNames: string[];
}> {
  const supabase = await supabaseServer();
  
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("flags")
    .eq("id", userId)
    .single();

  if (error || !profile || !profile.flags) {
    return { hasFlags: false, flagNames: [] };
  }

  const flags = profile.flags as Record<string, unknown>;
  const flagNames = Object.keys(flags).filter(
    (key) => flags[key] === true && ["fraud_suspected", "spam_detected", "high_risk", "manual_review"].includes(key),
  );

  return {
    hasFlags: flagNames.length > 0,
    flagNames,
  };
}

