/** Canonical site origin — env value may carry a trailing slash; always normalize. */
export function getBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://www.lyvox.be";
  return raw.replace(/\/+$/, "");
}

/** Join path onto the base origin, guaranteeing exactly one slash. */
export function absoluteUrl(path: string): string {
  return `${getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
