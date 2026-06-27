import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { createErrorResponse, createSuccessResponse, ApiErrorCode } from "@/lib/apiErrors";
import { isCapabilityEnabled } from "@/lib/capabilities";
import { getStripe } from "@/lib/stripe/client";

export const runtime = "nodejs";

const SUBSCRIBE_USER_ATTEMPTS = 10; // 10 subscribe attempts per minute per user
const SUBSCRIBE_USER_WINDOW_SEC = 60;
const SUBSCRIBE_IP_ATTEMPTS = 20; // 20 subscribe attempts per hour per IP
const SUBSCRIBE_IP_WINDOW_SEC = 60 * 60;

const subscribeUserLimiter = createRateLimiter({
  limit: SUBSCRIBE_USER_ATTEMPTS,
  windowSec: SUBSCRIBE_USER_WINDOW_SEC,
  prefix: "billing:subscribe:user",
});

const subscribeIpLimiter = createRateLimiter({
  limit: SUBSCRIBE_IP_ATTEMPTS,
  windowSec: SUBSCRIBE_IP_WINDOW_SEC,
  prefix: "billing:subscribe:ip",
  bucketId: "global",
});

const baseHandler = async (req: Request): Promise<Response> => {
  // Step 1: Feature gate — both flag AND price must be set
  if (
    !isCapabilityEnabled("pro_subscriptions") ||
    !process.env.STRIPE_PRO_PRICE_ID
  ) {
    return createErrorResponse(ApiErrorCode.FEATURE_DISABLED, { status: 404 });
  }

  // Step 2: Auth
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  // Step 3: Resolve or create Stripe customer
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to fetch profile for stripe_customer_id:", profileError);
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, { status: 500 });
  }

  const stripe = getStripe();
  let customerId: string;

  if (profile?.stripe_customer_id) {
    customerId = profile.stripe_customer_id;
  } else {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;

    // Persist via service-role (RLS blocks user writing stripe_customer_id)
    const svc = await supabaseService();
    const { error: updateError } = await svc
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to persist stripe_customer_id:", updateError);
      // Non-fatal: checkout can still proceed — the webhook will set it again
    }
  }

  // Step 4: Create Stripe subscription checkout session
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const successUrl = `${baseUrl}/pro?sub=success`;
  const cancelUrl = `${baseUrl}/pro?sub=cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: process.env.STRIPE_PRO_PRICE_ID,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user.id,
    metadata: {
      user_id: user.id,
      plan: "pro",
    },
  });

  // Step 5: Return the checkout URL
  return createSuccessResponse({ url: session.url });
};

const withUserLimit = withRateLimit(baseHandler, {
  limiter: subscribeUserLimiter,
  getUserId: async (_req) => {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  },
  makeKey: (_req, userId) => (userId ? userId : null),
});

export const POST = withRateLimit(withUserLimit, {
  limiter: subscribeIpLimiter,
  makeKey: (_req, _userId, ip) => (ip ? ip : null),
});
