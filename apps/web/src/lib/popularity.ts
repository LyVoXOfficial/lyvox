export function popularityScore({
  views = 0,
  likes = 0,
  favorites = 0,
}: {
  views?: number;
  likes?: number;
  favorites?: number;
}): number {
  return views * 0.3 + likes * 3 + favorites * 5;
}
