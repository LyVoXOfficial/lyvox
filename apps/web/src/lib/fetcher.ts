export class RateLimitedError extends Error {
  readonly retryAfterSec: number | null;
  readonly resetAt: string | null;
  readonly response: Response;
  readonly payload: unknown;

  constructor(
    response: Response,
    {
      message = "Too many requests",
      retryAfterSec,
      resetAt,
      payload,
    }: {
      message?: string;
      retryAfterSec: number | null;
      resetAt: string | null;
      payload: unknown;
    },
  ) {
    super(message);
    this.name = "RateLimitedError";
    this.retryAfterSec = retryAfterSec;
    this.resetAt = resetAt;
    this.response = response;
    this.payload = payload;
  }
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 429) {
    let payload: unknown = null;
    try {
      payload = await response.clone().json();
    } catch {
      payload = null;
    }

    const retryAfterSec = pickRetryAfter(payload, response.headers.get("Retry-After"));
    const resetAt = pickResetAt(payload, response.headers.get("RateLimit-Reset"));
    const errorLabel = getStringField(payload, "error");

    throw new RateLimitedError(response, {
      retryAfterSec,
      resetAt,
      payload,
      message: errorLabel ? `Too many requests: ${errorLabel}` : "Too many requests",
    });
  }

  return response;
}

const pickRetryAfter = (body: unknown, header: string | null): number | null => {
  const retryAfterValue =
    getNumberField(body, "retry_after_seconds") ?? getNumberField(body, "retryAfter");
  if (retryAfterValue && retryAfterValue > 0) {
    const ceiled = Math.ceil(retryAfterValue);
    return ceiled > 0 ? ceiled : null;
  }

  if (typeof header === "string" && header.trim().length) {
    const parsed = Number.parseFloat(header.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.ceil(parsed);
    }
  }

  return null;
};

const pickResetAt = (body: unknown, resetHeader: string | null): string | null => {
  const resetAtValue = getStringField(body, "resetAt");
  if (resetAtValue) {
    return resetAtValue;
  }

  if (typeof resetHeader === "string" && resetHeader.trim().length) {
    const parsed = Number.parseInt(resetHeader.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return new Date(parsed * 1000).toISOString();
    }
  }

  return null;
};

const getRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
};

const getNumberField = (value: unknown, key: string): number | null => {
  const record = getRecord(value);
  if (!record) return null;
  const candidate = record[key];
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }
  return null;
};

const getStringField = (value: unknown, key: string): string | null => {
  const record = getRecord(value);
  if (!record) return null;
  const candidate = record[key];
  return typeof candidate === "string" && candidate.length ? candidate : null;
};
