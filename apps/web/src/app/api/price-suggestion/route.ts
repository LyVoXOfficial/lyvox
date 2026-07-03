import { z } from "zod";
import { supabaseService } from "@/lib/supabaseService";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import {
  ApiErrorCode,
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
} from "@/lib/apiErrors";
import { requireAuthenticatedUser, resolveUserId } from "../media/_shared";

export const runtime = "nodejs";

const MIN_SAMPLE_SIZE = 8;

const priceSuggestionLimiter = createRateLimiter({
  limit: 30,
  windowSec: 60,
  prefix: "price:suggestion",
});

const buildRateLimitKey = (_req: Request, userId: string | null, ip: string | null) =>
  userId ?? ip ?? "anonymous";

const querySchema = z.object({
  categoryId: z.string().uuid(),
  condition: z.preprocess(
    (value) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().max(64).optional(),
  ),
});

export type PriceSuggestionResult =
  | {
      status: "ready";
      currency: "EUR";
      low: number;
      median: number;
      high: number;
      label: "low" | "ok" | "high";
      confidence: "low" | "medium" | "high";
      sampleSize: number;
      backoffLevel: string;
      explanationKey: string;
    }
  | {
      status: "insufficient_data";
      reason: "too_few_comparables" | "missing_attributes" | "unsupported_category";
    };

type EstimatePriceRow = {
  sample_size: number | null;
  p25: number | string | null;
  median: number | string | null;
  p75: number | string | null;
  backoff_level: string | null;
};

type EstimatePriceRpcClient = {
  rpc(
    name: "estimate_price",
    args: { p_category_id: string; p_condition: string | null },
  ): Promise<{
    data: EstimatePriceRow[] | null;
    error: { message?: string; code?: string } | null;
  }>;
};

async function handleGet(request: Request) {
  const authResult = await requireAuthenticatedUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }

  const searchParams = new URL(request.url).searchParams;
  const validation = querySchema.safeParse({
    categoryId: searchParams.get("categoryId"),
    condition: searchParams.get("condition"),
  });

  if (!validation.success) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Invalid price suggestion query",
    });
  }

  const service = (await supabaseService()) as unknown as EstimatePriceRpcClient;
  const { data, error } = await service.rpc("estimate_price", {
    p_category_id: validation.data.categoryId,
    p_condition: validation.data.condition ?? null,
  });

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  }

  return createSuccessResponse(toPriceSuggestion(data?.[0] ?? null));
}

function toPriceSuggestion(row: EstimatePriceRow | null): PriceSuggestionResult {
  if (!row) {
    return { status: "insufficient_data", reason: "too_few_comparables" };
  }

  if (row.backoff_level === "unsupported_category") {
    return { status: "insufficient_data", reason: "unsupported_category" };
  }

  const sampleSize = row.sample_size ?? 0;
  const low = toFinitePrice(row.p25);
  const median = toFinitePrice(row.median);
  const high = toFinitePrice(row.p75);

  if (sampleSize < MIN_SAMPLE_SIZE || low === null || median === null || high === null) {
    return { status: "insufficient_data", reason: "too_few_comparables" };
  }

  return {
    status: "ready",
    currency: "EUR",
    low: roundMoney(low),
    median: roundMoney(median),
    high: roundMoney(high),
    label: "ok",
    confidence: confidenceFor(sampleSize, row.backoff_level),
    sampleSize,
    backoffLevel: row.backoff_level ?? "category",
    explanationKey: "priceSuggestion.ready",
  };
}

function toFinitePrice(value: number | string | null): number | null {
  if (value === null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function confidenceFor(sampleSize: number, backoffLevel: string | null): "low" | "medium" | "high" {
  if (sampleSize >= 50 && backoffLevel === "category_condition") return "high";
  if (sampleSize >= 20) return "medium";
  return "low";
}

export const GET = withRateLimit(handleGet, {
  limiter: priceSuggestionLimiter,
  getUserId: resolveUserId,
  makeKey: buildRateLimitKey,
});
