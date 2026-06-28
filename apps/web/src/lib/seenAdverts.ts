// Tracks advert ids the swipe deck has already shown, so refreshes don't repeat cards.
// localStorage-backed, FIFO-capped, SSR/private-mode safe (mirrors lib/recentlyViewed.ts).

import { hasConsent } from "@/lib/cookieConsent/store";

const KEY = "lyvox:seenAdverts";
const CAP = 500;

function read(): string[] {
  if (typeof window === "undefined") return [];
  if (!hasConsent("functional")) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  if (typeof window === "undefined") return;
  if (!hasConsent("functional")) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* private mode / quota — degrade silently */
  }
}

export function getSeenAdverts(): Set<string> {
  return new Set(read());
}

export function isSeen(id: string): boolean {
  return read().includes(id);
}

/** Append ids (dedup), keeping at most CAP most-recent (oldest evicted first, FIFO). */
export function addSeenAdverts(ids: string[]): void {
  if (!ids.length) return;
  const existing = read();
  const existingSet = new Set(existing);
  const merged = existing.concat(ids.filter((id) => !existingSet.has(id)));
  const capped = merged.length > CAP ? merged.slice(merged.length - CAP) : merged;
  write(capped);
}

/** Remove a single id from the seen list (for undo). */
export function removeSeen(id: string): void {
  const existing = read();
  const filtered = existing.filter((v) => v !== id);
  if (filtered.length !== existing.length) write(filtered);
}

export function clearSeenAdverts(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
