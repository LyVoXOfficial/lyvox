import { sanitizeInternalReturnTo } from "@/lib/security/safeReturnTo";

export const ACCESS_GATE_PATH = "/coming-soon";
export const ACCESS_GATE_COOKIE_NAME = "__Host-lyvox-preview";
export const ACCESS_GATE_COOKIE_TTL_SECONDS = 12 * 60 * 60;

const ACCESS_GATE_CONTEXT = "lyvox-production-access-v1";
const MAX_COOKIE_LENGTH = 512;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type EnvMap = Record<string, string | undefined>;

export type AccessGateRuntime = {
  active: boolean;
  configured: boolean;
  rateLimitConfigured: boolean;
  turnstileConfigured: boolean;
  accessCode: string | null;
  signingSecret: string | null;
};

export const accessGateCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: ACCESS_GATE_COOKIE_TTL_SECONDS,
};

function gateExplicitlyDisabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "false" || normalized === "0";
}

export function isAccessGateRuntimeActive(env: EnvMap = process.env): boolean {
  const vercelEnv = env.VERCEL_ENV;
  const deployedRuntime = vercelEnv
    ? vercelEnv === "production" || vercelEnv === "preview"
    : env.NODE_ENV === "production";
  if (!deployedRuntime) return false;

  // Preview deployments remain private even if a production GO flag was copied
  // into their environment. Only production/self-hosted runtime can be opened.
  if (vercelEnv === "preview") return true;
  return !gateExplicitlyDisabled(env.PRODUCTION_ACCESS_GATE_ENABLED);
}

/**
 * The preview wall is active on publicly reachable production and preview
 * deployments. Local development and tests remain open.
 */
export function getAccessGateRuntime(
  env: EnvMap = process.env,
): AccessGateRuntime {
  const active = isAccessGateRuntimeActive(env);
  const rawCode = env.PRODUCTION_ACCESS_CODE;
  const rawSigningSecret = env.PRODUCTION_ACCESS_GATE_SECRET;
  const accessCode =
    rawCode &&
    rawCode.trim().length > 0 &&
    encoder.encode(rawCode).byteLength >= 16
      ? rawCode
      : null;
  const signingSecret =
    rawSigningSecret &&
    rawSigningSecret.trim().length > 0 &&
    encoder.encode(rawSigningSecret).byteLength >= 32
      ? rawSigningSecret
      : null;
  const turnstileConfigured = Boolean(
    env.TURNSTILE_SECRET_KEY?.trim() &&
      env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim(),
  );
  const rateLimitConfigured = Boolean(
    env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );

  return {
    active,
    configured:
      accessCode !== null &&
      signingSecret !== null &&
      turnstileConfigured &&
      rateLimitConfigured,
    rateLimitConfigured,
    turnstileConfigured,
    accessCode,
    signingSecret,
  };
}

/**
 * Site UI and ordinary browser APIs are private. Only machine endpoints with
 * their own authentication plus public boot assets remain reachable.
 */
export function shouldProtectWithAccessGate(
  pathname: string,
  method = "GET",
): boolean {
  const normalizedMethod = method.toUpperCase();
  const safeRead = normalizedMethod === "GET" || normalizedMethod === "HEAD";

  if (safeRead && pathname === ACCESS_GATE_PATH) {
    return false;
  }
  if (
    (normalizedMethod === "POST" &&
      [
        "/api/access-gate/unlock",
        "/api/access-gate/lock",
        "/api/billing/webhook",
        "/api/csp-report",
      ].includes(pathname)) ||
    (normalizedMethod === "GET" && pathname === "/auth/callback") ||
    (normalizedMethod === "GET" &&
      [
        "/api/cron/translate-adverts",
        "/api/cron/saved-search-alerts",
        "/api/cron/business-verify",
      ].includes(pathname))
  ) {
    return false;
  }
  if (
    safeRead &&
    [
      "/favicon.ico",
      "/favicon.svg",
      "/favico.svg",
      "/icon.svg",
      "/apple-icon.png",
      "/file.svg",
      "/globe.svg",
      "/lyvox.svg",
      "/placeholder.png",
      "/placeholder.svg",
      "/window.svg",
      "/manifest.webmanifest",
      "/robots.txt",
      "/opengraph-image",
      "/twitter-image",
    ].includes(pathname)
  ) {
    return false;
  }

  return true;
}

/** Keep redirects on this origin and out of the access-gate loop. */
export function sanitizeAccessGateReturnTo(value: unknown): string {
  const safe = sanitizeInternalReturnTo(value);
  const pathname = sanitizeInternalReturnTo(safe.split(/[?#]/u, 1)[0] || "/");
  if (
    pathname === ACCESS_GATE_PATH ||
    pathname.startsWith(`${ACCESS_GATE_PATH}/`)
  ) {
    return "/";
  }
  return pathname;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;

  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    // Reject alternate encodings that decode to the same bytes. A cookie has
    // one canonical representation, so even an unused-bit mutation is invalid.
    return bytesToBase64Url(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

async function signPayload(
  payload: string,
  secret: string,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${ACCESS_GATE_CONTEXT}.${payload}`),
    ),
  );
}

/** Compare fixed-length digests so a wrong code never takes an early-return path. */
export async function verifyAccessGateCode(
  candidate: string,
  secret: string,
): Promise<boolean> {
  const [candidateDigest, expectedDigest] = await Promise.all([
    sha256(candidate),
    sha256(secret),
  ]);
  return constantTimeEqual(candidateDigest, expectedDigest);
}

/** Issue an opaque bearer cookie. The submitted access code is never embedded. */
export async function issueAccessGateCookie(
  secret: string,
  nowMilliseconds = Date.now(),
): Promise<string> {
  const issuedAt = Math.floor(nowMilliseconds / 1_000);
  const expiresAt = issuedAt + ACCESS_GATE_COOKIE_TTL_SECONDS;
  const payload = bytesToBase64Url(
    encoder.encode(`1:${issuedAt}:${expiresAt}`),
  );
  const signature = bytesToBase64Url(await signPayload(payload, secret));
  return `${payload}.${signature}`;
}

export async function verifyAccessGateCookie(
  value: string | undefined,
  secret: string,
  nowMilliseconds = Date.now(),
): Promise<boolean> {
  if (!value || value.length > MAX_COOKIE_LENGTH) return false;

  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [payload, signatureValue] = parts;
  const signature = base64UrlToBytes(signatureValue);
  if (!payload || !signature) return false;

  const expectedSignature = await signPayload(payload, secret);
  if (!constantTimeEqual(signature, expectedSignature)) return false;

  const payloadBytes = base64UrlToBytes(payload);
  if (!payloadBytes) return false;
  const [version, issuedAtValue, expiresAtValue, extra] = decoder
    .decode(payloadBytes)
    .split(":");
  if (version !== "1" || extra !== undefined) return false;

  const issuedAt = Number(issuedAtValue);
  const expiresAt = Number(expiresAtValue);
  const now = Math.floor(nowMilliseconds / 1_000);
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt))
    return false;
  if (expiresAt - issuedAt !== ACCESS_GATE_COOKIE_TTL_SECONDS) return false;
  if (issuedAt > now + 60 || expiresAt <= now) return false;

  return true;
}
