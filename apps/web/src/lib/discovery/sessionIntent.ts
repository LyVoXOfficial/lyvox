import { hasConsent } from "@/lib/cookieConsent/store";
import type { AdvertCard } from "@/lib/advertCards";

export type PersonalizationMode = "off" | "session_only";

export type SessionIntentState = {
  mode: PersonalizationMode;
  source: "memory" | "sessionStorage";
  updatedAt: number;
  categories: Record<string, number>;
  priceBands: Record<string, number>;
  localRadiusKm: number | null;
};

const KEY = "lyvox:sessionIntent";
export const SESSION_INTENT_CHANGED = "lyvox:session-intent-changed";

const PRICE_BANDS = [
  "free",
  "under_50",
  "50_100",
  "100_250",
  "250_500",
  "500_1000",
  "over_1000",
] as const;

function defaultState(mode: PersonalizationMode): SessionIntentState {
  return {
    mode,
    source: "memory",
    updatedAt: Date.now(),
    categories: {},
    priceBands: {},
    localRadiusKm: null,
  };
}

function canUseFunctionalStorage(): boolean {
  return typeof window !== "undefined" && hasConsent("functional");
}

function sanitizeRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof key !== "string" || !key) continue;
    const score = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    if (score > 0) out[key] = score;
  }
  return out;
}

function normalizeState(value: unknown): SessionIntentState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<SessionIntentState>;
  if (raw.mode !== "session_only" && raw.mode !== "off") return null;
  return {
    mode: raw.mode,
    source: "sessionStorage",
    updatedAt:
      typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : Date.now(),
    categories: sanitizeRecord(raw.categories),
    priceBands: sanitizeRecord(raw.priceBands),
    localRadiusKm:
      typeof raw.localRadiusKm === "number" && Number.isFinite(raw.localRadiusKm)
        ? raw.localRadiusKm
        : null,
  };
}

function writeState(state: SessionIntentState): SessionIntentState {
  if (!canUseFunctionalStorage()) return defaultState("off");
  const next = { ...state, mode: "session_only" as const, source: "sessionStorage" as const };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SESSION_INTENT_CHANGED));
  } catch {
    /* private mode / quota - degrade silently */
  }
  return next;
}

export function getSessionIntent(): SessionIntentState {
  if (!canUseFunctionalStorage()) return defaultState("off");
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return defaultState("session_only");
    return normalizeState(JSON.parse(raw)) ?? defaultState("session_only");
  } catch {
    return defaultState("session_only");
  }
}

export function toPriceBand(price: number | null | undefined): string | null {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  if (price <= 0) return "free";
  if (price < 50) return "under_50";
  if (price < 100) return "50_100";
  if (price < 250) return "100_250";
  if (price < 500) return "250_500";
  if (price < 1000) return "500_1000";
  return "over_1000";
}

function bump(record: Record<string, number>, key: string | null | undefined, amount: number) {
  if (!key) return;
  record[key] = (record[key] ?? 0) + amount;
}

export function recordCategoryClick(categoryId: string | null | undefined): SessionIntentState {
  const state = getSessionIntent();
  if (state.mode === "off") return state;
  const next: SessionIntentState = {
    ...state,
    updatedAt: Date.now(),
    categories: { ...state.categories },
    priceBands: { ...state.priceBands },
  };
  bump(next.categories, categoryId, 1);
  return writeState(next);
}

export function recordAdOpen(
  categoryId: string | null | undefined,
  priceBand: string | null | undefined,
): SessionIntentState {
  const state = getSessionIntent();
  if (state.mode === "off") return state;
  const next: SessionIntentState = {
    ...state,
    updatedAt: Date.now(),
    categories: { ...state.categories },
    priceBands: { ...state.priceBands },
  };
  bump(next.categories, categoryId, 2);
  bump(next.priceBands, priceBand, 1);
  return writeState(next);
}

export function reset(): SessionIntentState {
  if (typeof window === "undefined") return defaultState("off");
  try {
    window.sessionStorage.removeItem(KEY);
    window.dispatchEvent(new Event(SESSION_INTENT_CHANGED));
  } catch {
    /* ignore */
  }
  return getSessionIntent();
}

export function hasSessionSignals(intent: SessionIntentState): boolean {
  return (
    intent.mode === "session_only" &&
    (Object.keys(intent.categories).length > 0 || Object.keys(intent.priceBands).length > 0)
  );
}

function priceBandDistance(a: string, b: string): number | null {
  const left = PRICE_BANDS.indexOf(a as (typeof PRICE_BANDS)[number]);
  const right = PRICE_BANDS.indexOf(b as (typeof PRICE_BANDS)[number]);
  if (left < 0 || right < 0) return null;
  return Math.abs(left - right);
}

function scoreItem(item: AdvertCard, intent: SessionIntentState): number {
  let score = 0;
  if (item.categoryId) score += (intent.categories[item.categoryId] ?? 0) * 10;

  const itemBand = toPriceBand(item.price);
  if (itemBand) {
    for (const [band, weight] of Object.entries(intent.priceBands)) {
      const distance = priceBandDistance(itemBand, band);
      if (distance === null) continue;
      if (distance === 0) score += weight * 4;
      else if (distance === 1) score += weight * 2;
      else if (distance === 2) score += weight;
    }
  }
  return score;
}

export function rankSessionItems<T extends AdvertCard>(items: T[], intent: SessionIntentState): T[] {
  if (intent.mode === "off" || !hasSessionSignals(intent) || items.length < 2) return items;
  return items
    .map((item, index) => ({ item, index, score: scoreItem(item, intent) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}
