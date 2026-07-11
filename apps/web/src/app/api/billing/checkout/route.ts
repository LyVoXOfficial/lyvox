import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { createCheckoutSchema } from "@/lib/validations/billing";
import { getStripe } from "@/lib/stripe/client";
import { withCsrfProtection } from "@/lib/security/csrf";
import { getIntegrationStatus } from "@/lib/integrations/registry";

export const runtime = "nodejs";

const CHECKOUT_USER_ATTEMPTS = 10; // 10 checkout sessions per minute
const CHECKOUT_USER_WINDOW_SEC = 60;
const CHECKOUT_IP_ATTEMPTS = 20; // 20 checkout sessions per hour
const CHECKOUT_IP_WINDOW_SEC = 60 * 60;

const checkoutUserLimiter = createRateLimiter({
  limit: CHECKOUT_USER_ATTEMPTS,
  windowSec: CHECKOUT_USER_WINDOW_SEC,
  prefix: "billing:checkout:user",
});

const checkoutIpLimiter = createRateLimiter({
  limit: CHECKOUT_IP_ATTEMPTS,
  windowSec: CHECKOUT_IP_WINDOW_SEC,
  prefix: "billing:checkout:ip",
  bucketId: "global",
});

const baseHandler = async (req: Request) => {
  const capability = await getIntegrationStatus("paid_boosts");
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!capability.effective || !baseUrl) {
    return createErrorResponse(ApiErrorCode.FEATURE_DISABLED, { status: 404 });
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  // checkUserBlocked(failClosed) is sufficient here: checkout = pro-billing boost,
  // NOT escrow money-flow (F3 gate). invoking fraud-detection would re-run velocity
  // rules already triggered on advert create/publish, adding latency for no gain.
  const { checkUserBlocked } = await import("@/lib/fraud/checkUserBlocked");
  const blockCheck = await checkUserBlocked(user.id, { failClosed: true });
  if (blockCheck.isBlocked) {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, {
      status: 403,
      detail:
        blockCheck.reason ||
        "Account is temporarily blocked. Cannot make purchases.",
    });
  }

  const parseResult = await safeJsonParse<{
    product_code?: unknown;
    advert_id?: unknown;
  }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(
    createCheckoutSchema,
    parseResult.data,
  );
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { product_code, advert_id } = validationResult.data;

  // Verify product exists and is active
  const { data: product, error: productError } = await supabase
    .from("products")
    .select(
      "id, code, name, price_cents, currency, capability, benefit_type, duration_days, requires_advert, offer_version, tax_behavior",
    )
    .eq("code", product_code)
    .eq("capability", "paid_boosts")
    .eq("active", true)
    .maybeSingle();

  if (productError) {
    return handleSupabaseError(productError, ApiErrorCode.FETCH_FAILED);
  }

  if (!product) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, {
      status: 404,
      detail: "Product not found or inactive",
    });
  }

  if (product.requires_advert && !advert_id) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "This product requires an advert",
    });
  }

  // If advert_id is provided, verify it belongs to the user
  if (advert_id) {
    const { data: advert, error: advertError } = await supabase
      .from("adverts")
      .select("id, user_id, status")
      .eq("id", advert_id)
      .maybeSingle();

    if (advertError) {
      return handleSupabaseError(advertError, ApiErrorCode.FETCH_FAILED);
    }

    if (!advert) {
      return createErrorResponse(ApiErrorCode.NOT_FOUND, {
        status: 404,
        detail: "Advert not found",
      });
    }

    if (advert.user_id !== user.id) {
      return createErrorResponse(ApiErrorCode.FORBIDDEN, {
        status: 403,
        detail: "You can only boost your own adverts",
      });
    }

    if (advert.status !== "active") {
      return createErrorResponse(ApiErrorCode.BAD_INPUT, {
        status: 400,
        detail: "Only active adverts can receive this benefit",
      });
    }
  }

  // Financial rows are service-owned; authenticated PostgREST INSERT is revoked.
  const service = await supabaseService();
  const { data: purchase, error: purchaseError } = await service
    .from("purchases")
    .insert({
      user_id: user.id,
      product_code: product.code,
      provider: "stripe",
      status: "pending",
      amount_cents: product.price_cents,
      currency: product.currency || "EUR",
      advert_id: advert_id || null,
      product_offer_version: product.offer_version,
    })
    .select("id")
    .single();

  if (purchaseError) {
    return handleSupabaseError(purchaseError, ApiErrorCode.CREATE_FAILED);
  }

  // Create Stripe Checkout Session
  const successUrl = `${baseUrl}/profile/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/profile/billing?checkout=cancel`;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: product.currency?.toLowerCase() || "eur",
            product_data: {
              name: (product.name as Record<string, string>).en || product.code,
            },
            unit_amount: product.price_cents,
            tax_behavior:
              product.tax_behavior === "inclusive" ? "inclusive" : "exclusive",
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: purchase.id,
      metadata: {
        purchase_id: purchase.id,
        user_id: user.id,
        product_code: product.code,
        advert_id: advert_id || "",
      },
    });

    // Update purchase with session ID via service-role (RLS has no UPDATE policy for cookie client)
    const { error: updateError } = await service
      .from("purchases")
      .update({ provider_session_id: session.id })
      .eq("id", purchase.id);

    if (updateError) {
      console.error("Failed to update purchase with session ID:", updateError);
      // Never disclose a Checkout URL that cannot be reconciled to our journal.
      // The session is not yet paid, so expire it at Stripe and fail closed.
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch (expireError) {
        console.error(
          "Failed to expire unreconciled Stripe Checkout session:",
          expireError,
        );
      }
      await service
        .from("purchases")
        .update({ status: "failed" })
        .eq("id", purchase.id);
      return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
        status: 500,
        detail: "Checkout session could not be reconciled",
      });
    }

    return createSuccessResponse({
      session_id: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe checkout session creation failed:", error);

    // Update purchase status to failed via service-role (RLS has no UPDATE policy for cookie client)
    await service
      .from("purchases")
      .update({ status: "failed" })
      .eq("id", purchase.id);

    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
      status: 500,
      detail: "Failed to create checkout session",
    });
  }
};

const withUserLimit = withRateLimit(baseHandler, {
  limiter: checkoutUserLimiter,
  getUserId: async (req) => {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  },
  makeKey: (_req, userId) => (userId ? userId : null),
});

export const POST = withRateLimit(withCsrfProtection(withUserLimit), {
  limiter: checkoutIpLimiter,
  makeKey: (_req, _userId, ip) => (ip ? ip : null),
});
