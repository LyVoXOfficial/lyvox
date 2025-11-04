import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createErrorResponse, ApiErrorCode } from "@/lib/apiErrors";

type RateLimiterOptions = {
  limit: number;
  windowSec: number;
  prefix: string;
  bucketId?: string;
};

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfterSec: number;
};

type RateLimiterFn = (key: string) => Promise<RateLimitResult>;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisClient = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const disabledLogger = (() => {
  let didWarn = false;
  return () => {
    if (!didWarn && process.env.NODE_ENV !== "test") {
      console.warn(
        "Rate limiting disabled: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not set.",
      );
      didWarn = true;
    }
  };
})();

type UpstashLimitResponse = Awaited<ReturnType<InstanceType<typeof Ratelimit>["limit"]>>;

type InternalResult = UpstashLimitResponse & { reset: number };

export function createRateLimiter({
  limit,
  windowSec,
  prefix,
  bucketId = "default",
}: RateLimiterOptions): RateLimiterFn {
  if (!redisClient) {
    disabledLogger();
    return async () => ({
      success: true,
      limit,
      remaining: limit,
      reset: Math.floor(Date.now() / 1000) + windowSec,
      retryAfterSec: 0,
    });
  }

  const namespace = ["rl", prefix, bucketId, String(limit), String(windowSec)].join(":");

  const ratelimit = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    analytics: process.env.NODE_ENV === "production",
    prefix: namespace,
  });

  return async (key: string) => {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      return {
        success: true,
        limit,
        remaining: limit,
        reset: Math.floor(Date.now() / 1000) + windowSec,
        retryAfterSec: 0,
      };
    }

    const result = (await ratelimit.limit(normalizedKey)) as InternalResult;
    const resetSeconds = normalizeReset(result.reset);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const retryAfterSec = result.success ? 0 : Math.max(0, resetSeconds - nowSeconds);

    return {
      success: result.success,
      limit: result.limit,
      remaining: Math.max(result.remaining, 0),
      reset: resetSeconds,
      retryAfterSec,
    };
  };
}

const normalizeReset = (reset: number | Date): number => {
  if (typeof reset === "number") {
    return reset;
  }
  return Math.floor(reset.getTime() / 1000);
};

type MaybeArray<T> = T | T[] | null | undefined;

type WithRateLimitOptions = {
  limiter: RateLimiterFn;
  makeKey: (req: Request, userId: string | null, ip: string | null) => MaybeArray<string>;
  getUserId?: (req: Request) => Promise<string | null>;
  onLimited?: (payload: {
    req: Request;
    userId: string | null;
    ip: string | null;
    key: string;
    result: RateLimitResult;
  }) => void | Promise<void>;
};

type RouteHandler = (req: Request) => Promise<Response>;

export function withRateLimit(handler: RouteHandler, options: WithRateLimitOptions): RouteHandler {
  return async (req: Request) => {
    const ip = getClientIp(req);
    const userId = options.getUserId ? await options.getUserId(req) : null;
    const keys = toKeyArray(options.makeKey(req, userId, ip));

    let headerResult: RateLimitResult | null = null;

    for (const key of keys) {
      const result = await options.limiter(key);
      if (!result.success) {
        await options.onLimited?.({ req, userId, ip, key, result });
        return build429(result);
      }
      headerResult = pickStricterResult(headerResult, result);
    }

    const response = await handler(req);
    if (headerResult) {
      response.headers.set("RateLimit-Limit", String(headerResult.limit));
      response.headers.set("RateLimit-Remaining", String(Math.max(headerResult.remaining, 0)));
      response.headers.set("RateLimit-Reset", String(headerResult.reset));
    }
    return response;
  };
}

const toKeyArray = (value: MaybeArray<string>): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  const trimmed = value.trim();
  return trimmed ? [trimmed] : [];
};

const pickStricterResult = (
  current: RateLimitResult | null,
  next: RateLimitResult,
): RateLimitResult => {
  if (!current) return next;

  const currentRatio = current.remaining / current.limit;
  const nextRatio = next.remaining / next.limit;

  if (nextRatio < currentRatio) return next;
  if (nextRatio === currentRatio && next.limit <= current.limit) return next;
  return current;
};

const build429 = ({ limit, reset, retryAfterSec }: RateLimitResult): Response => {
  // Используем стандартизированный формат, но сохраняем дополнительные поля для обратной совместимости
  const resetAt = new Date(reset * 1000).toISOString();
  const detail = `Rate limit exceeded. Retry after ${retryAfterSec} seconds. Reset at ${resetAt}. Limit: ${limit}`;
  
  const response = createErrorResponse(ApiErrorCode.RATE_LIMITED, {
    status: 429,
    detail,
  });

  // Добавляем дополнительные поля в заголовки для стандарта Rate Limit и обратной совместимости
  response.headers.set("Retry-After", String(retryAfterSec));
  response.headers.set("RateLimit-Limit", String(limit));
  response.headers.set("RateLimit-Remaining", "0");
  response.headers.set("RateLimit-Reset", String(reset));

  return response;
};

export function getClientIp(req: Request): string | null {
  const headers = req.headers;

  const forwarded = headers.get("x-forwarded-for") ?? headers.get("X-Forwarded-For");
  const forwardedIp = firstIpFromList(forwarded);
  if (forwardedIp) return forwardedIp;

  const realIp =
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-client-ip") ??
    headers.get("fastly-client-ip") ??
    headers.get("true-client-ip");
  if (realIp) return realIp.trim();

  const reqAny = req as unknown as { ip?: string | string[] | null };
  if (typeof reqAny.ip === "string" && reqAny.ip) {
    return reqAny.ip;
  }
  if (Array.isArray(reqAny.ip)) {
    return reqAny.ip.find((item) => item)?.toString() ?? null;
  }

  return null;
};

const firstIpFromList = (value: string | null): string | null => {
  if (!value) return null;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[0] ?? null;
};
