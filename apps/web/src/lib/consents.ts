export const CONSENT_VERSION = {
  terms: "2025-10-01",
  privacy: "2025-10-01",
  marketing: "2025-10-01",
} as const;

export type ConsentEntry = {
  accepted: boolean;
  version: string;
  accepted_at: string | null;
};

export type ConsentSnapshot = {
  terms: ConsentEntry;
  privacy: ConsentEntry;
  marketing: ConsentEntry;
} & Record<string, unknown>;

export function coerceConsentSnapshot(value: unknown): ConsentSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Record<string, unknown>;
  const parseEntry = (entryValue: unknown, fallbackVersion: string, fallbackAccepted = true): ConsentEntry => {
    if (
      entryValue &&
      typeof entryValue === "object" &&
      "accepted" in entryValue &&
      "version" in entryValue
    ) {
      const entry = entryValue as Record<string, unknown>;
      const accepted = typeof entry.accepted === "boolean" ? entry.accepted : fallbackAccepted;
      const version = typeof entry.version === "string" ? entry.version : fallbackVersion;
      const acceptedAt =
        typeof entry.accepted_at === "string" || entry.accepted_at === null
          ? (entry.accepted_at as string | null)
          : accepted
            ? new Date().toISOString()
            : null;
      return { accepted, version, accepted_at: acceptedAt };
    }

    return {
      accepted: fallbackAccepted,
      version: fallbackVersion,
      accepted_at: fallbackAccepted ? new Date().toISOString() : null,
    };
  };

  return {
    ...snapshot,
    terms: parseEntry(snapshot.terms, CONSENT_VERSION.terms, true),
    privacy: parseEntry(snapshot.privacy, CONSENT_VERSION.privacy, true),
    marketing: parseEntry(snapshot.marketing, CONSENT_VERSION.marketing, false),
  };
}

export function composeMarketingSnapshot(
  current: ConsentSnapshot | null,
  marketingOptIn: boolean,
  timestampIso: string,
): ConsentSnapshot {
  const base = current ?? coerceConsentSnapshot({})!;
  const ensureCore = (entry: ConsentEntry | undefined, key: "terms" | "privacy"): ConsentEntry => {
    const fallback: ConsentEntry = {
      accepted: true,
      version: CONSENT_VERSION[key],
      accepted_at: timestampIso,
    };

    if (!entry) return fallback;
    return {
      accepted: entry.accepted ?? true,
      version: entry.version ?? CONSENT_VERSION[key],
      accepted_at: entry.accepted_at ?? timestampIso,
    };
  };

  return {
    ...base,
    terms: ensureCore(base.terms, "terms"),
    privacy: ensureCore(base.privacy, "privacy"),
    marketing: {
      accepted: marketingOptIn,
      version: base.marketing?.version ?? CONSENT_VERSION.marketing,
      accepted_at: marketingOptIn ? timestampIso : null,
    },
  };
}
