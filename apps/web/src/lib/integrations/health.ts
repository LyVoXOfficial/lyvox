import "server-only";

import { supabaseService } from "@/lib/supabaseService";

export type IntegrationHealthState = "healthy" | "degraded" | "unhealthy" | "unknown";

export type IntegrationHealthSnapshot = {
  integrationId: string;
  status: IntegrationHealthState;
  checkedAt: string | null;
  expiresAt: string | null;
  latencyMs: number | null;
  safeErrorCode: string | null;
  stale: boolean;
};

export async function getIntegrationHealthSnapshots(
  integrationIds: readonly string[],
  now = new Date(),
): Promise<IntegrationHealthSnapshot[]> {
  if (integrationIds.length === 0) return [];

  try {
    const supabase = await supabaseService();
    const { data, error } = await supabase
      .from("integration_health")
      .select("integration_id, status, checked_at, expires_at, latency_ms, safe_error_code")
      .in("integration_id", [...integrationIds]);
    if (error) throw error;

    const rows = new Map((data ?? []).map((row) => [row.integration_id, row]));
    return integrationIds.map((integrationId) => {
      const row = rows.get(integrationId);
      if (!row) {
        return {
          integrationId,
          status: "unknown",
          checkedAt: null,
          expiresAt: null,
          latencyMs: null,
          safeErrorCode: null,
          stale: true,
        };
      }
      const expiresAt = new Date(row.expires_at);
      return {
        integrationId,
        status: row.status as IntegrationHealthState,
        checkedAt: row.checked_at,
        expiresAt: row.expires_at,
        latencyMs: row.latency_ms,
        safeErrorCode: row.safe_error_code,
        stale: Number.isNaN(expiresAt.valueOf()) || expiresAt <= now,
      };
    });
  } catch {
    return integrationIds.map((integrationId) => ({
      integrationId,
      status: "unknown",
      checkedAt: null,
      expiresAt: null,
      latencyMs: null,
      safeErrorCode: "HEALTH_STORE_UNAVAILABLE",
      stale: true,
    }));
  }
}
