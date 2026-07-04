/**
 * T18 (LAUNCH-GATE) seed switch.
 *
 * Seed/demo content is an intentional pre-launch showcase. This flag is the
 * single gate that excludes it from aggregates / social-proof / structured-data
 * counts (top sellers, price medians) — flip it with one env var, no code change
 * and no deploy, exactly when the founder opens the site to real traffic.
 *
 * Default OFF → behaviour is byte-for-byte the current showcase (seed visible
 * everywhere, counted everywhere). The founder sets
 * EXCLUDE_SEED_FROM_AGGREGATES=true at launch.
 *
 * This only affects aggregates/social-proof — it never hides or de-indexes the
 * seed listings themselves (see docs/todo/T18-seed-switch.md).
 */
export function excludeSeedFromAggregates(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.EXCLUDE_SEED_FROM_AGGREGATES === "true";
}
