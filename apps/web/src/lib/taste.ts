// Lightweight, anonymous-friendly taste model for the swipe deck. localStorage-backed.
// Keeps additive weights per dimension (category / seller / location / price-band) from the
// user's likes (+1), favorites (+2) and passes (-1). scoreCard() sums a card's dimension weights;
// the deck reranks candidates by that score. Cold start (no signal) → every score 0 → source order.
// No ML, no server, no new table. SSR/private-mode safe.

export type TasteCard = {
  categoryId: string | null;
  sellerId: string | null;
  location: string | null;
  price: number | null;
};

export type TasteSignal = "like" | "favorite" | "pass";

const KEY = "lyvox:taste";
const PRICE_BAND = 50;

type Weights = Record<string, number>;

function read(): Weights {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Weights) : {};
  } catch {
    return {};
  }
}

function write(weights: Weights): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(weights));
  } catch {
    /* private mode / quota — degrade silently */
  }
}

function dimensionKeys(card: TasteCard): string[] {
  const keys: string[] = [];
  if (card.categoryId) keys.push(`cat:${card.categoryId}`);
  if (card.sellerId) keys.push(`seller:${card.sellerId}`);
  if (card.location) keys.push(`loc:${card.location}`);
  if (card.price != null) keys.push(`price:${Math.floor(card.price / PRICE_BAND)}`);
  return keys;
}

const DELTA: Record<TasteSignal, number> = { like: 1, favorite: 2, pass: -1 };

export function recordSignal(card: TasteCard, kind: TasteSignal): void {
  const delta = DELTA[kind];
  const weights = read();
  for (const k of dimensionKeys(card)) {
    weights[k] = (weights[k] ?? 0) + delta;
  }
  write(weights);
}

export function scoreCard(card: TasteCard): number {
  const weights = read();
  return dimensionKeys(card).reduce((sum, k) => sum + (weights[k] ?? 0), 0);
}

export function getTasteWeights(): Weights {
  return read();
}

export function resetTaste(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
