export type RecentAdvert = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  location: string | null;
  image: string | null;
};

const KEY = "lyvox:recentlyViewed";
const CAP = 20;

function readStore(): RecentAdvert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentAdvert[]) : [];
  } catch {
    return [];
  }
}

function writeStore(items: RecentAdvert[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* private mode / quota — degrade silently */
  }
}

export function getRecentlyViewed(): RecentAdvert[] {
  return readStore();
}

export function addRecentlyViewed(item: RecentAdvert): RecentAdvert[] {
  const next = [item, ...readStore().filter((r) => r.id !== item.id)].slice(0, CAP);
  writeStore(next);
  return next;
}

export function clearRecentlyViewed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
