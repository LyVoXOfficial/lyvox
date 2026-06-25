import type { AdvertCard } from "@/lib/advertCards";

/** Append `incoming` to `prev`, skipping any ids already present. */
export function appendUnique(prev: AdvertCard[], incoming: AdvertCard[]): AdvertCard[] {
  if (incoming.length === 0) return prev;
  const seen = new Set(prev.map((c) => c.id));
  return [...prev, ...incoming.filter((c) => !seen.has(c.id))];
}
