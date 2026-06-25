export type SupabaseUserLike = {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
} | null | undefined;

function normalize(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry : null))
      .filter((entry): entry is string => !!entry);
  }
  return [];
}

export function hasAdminRole(user: SupabaseUserLike): boolean {
  if (!user) return false;

  // SECURITY: Only `app_metadata` may be trusted for authorization.
  // `user_metadata` (raw_user_meta_data) is writable by the user themselves via
  // `supabase.auth.updateUser({ data: { role: 'admin' } })`, so trusting it here
  // would allow any authenticated user to escalate to admin. The database
  // `is_admin()` function (see migration 20251005191500) is the source of truth
  // and also reads `app_metadata.role` only — keep these aligned.
  const { app_metadata } = user as {
    app_metadata?: Record<string, unknown> | null;
  };

  const candidates: string[] = [];

  if (app_metadata) {
    const { role, roles } = app_metadata as {
      role?: unknown;
      roles?: unknown;
    };
    candidates.push(...normalize(role));
    candidates.push(...normalize(roles));
  }

  return candidates.some((value) => value.toLowerCase() === "admin");
}
