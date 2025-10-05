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

  const { app_metadata, user_metadata } = user as {
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
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

  if (user_metadata) {
    const { role } = user_metadata as { role?: unknown };
    candidates.push(...normalize(role));
  }

  return candidates.some((value) => value.toLowerCase() === "admin");
}
