import { hasConsent } from "@/lib/cookieConsent/store";

const KEY = "lyvox:recentSearches";
const CAP = 8;

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

function write(items: string[]): void {
  if (typeof window === "undefined") return;
  if (!hasConsent("functional")) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* degrade silently */
  }
}

export function getRecentSearches(): string[] {
  return read();
}

export function addRecentSearch(q: string): string[] {
  const query = q.trim();
  if (!query) return read();
  const lower = query.toLowerCase();
  const next = [query, ...read().filter((s) => s.toLowerCase() !== lower)].slice(0, CAP);
  write(next);
  return next;
}

export function removeRecentSearch(q: string): string[] {
  const lower = q.trim().toLowerCase();
  const next = read().filter((s) => s.toLowerCase() !== lower);
  write(next);
  return next;
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
