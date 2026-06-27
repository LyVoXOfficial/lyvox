import { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { supabaseService } from "@/lib/supabaseService";
import {
  createErrorResponse,
  createSuccessResponse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import Stripe from "stripe";

export const runtime = "nodejs";

/**
 * Returns the ISO string for the end of the current billing period.
 * In Stripe v19, current_period_end lives on the first SubscriptionItem,
 * not on the Subscription object itself.
 *
 * Returns null (and logs) when current_period_end is missing or not a number
 * (e.g. the subscription has no items yet) so callers can skip the DB write
 * gracefully instead of propagating an exception to the POST try/catch.
 */
function periodEndISO(sub: Stripe.Subscription): string | null {
  const ts = sub.items.data[0]?.current_period_end;
  if (typeof ts !== "number") {
    console.error(`periodEndISO: no current_period_end on sub ${sub.id}`);
    return null;
  }
  return new Date(ts * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Missing stripe-signature header",
    });
  }

  if (!webhookSecret) {
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
      status: 500,
      detail: "Webhook secret not configured",
    });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const error = err as Error;
    console.error("Webhook signature verification failed:", error.message);
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: `Webhook signature verification failed: ${error.message}`,
    });
  }

  const supabase = await supabaseService();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // ── Pro subscription checkout ────────────────────────────────────────
        if (
          session.mode === "subscription" ||
          session.metadata?.plan === "pro"
        ) {
          const userId =
            session.client_reference_id ?? session.metadata?.user_id;
          if (!userId) {
            console.error(
              "Pro subscription checkout: missing user id (client_reference_id / metadata.user_id)"
            );
            break;
          }

          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          const proUntil = periodEndISO(sub);

          if (proUntil === null) {
            console.error(
              `checkout.session.completed: skipping pro_until update for sub ${session.subscription} — no current_period_end`
            );
            break;
          }

          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              stripe_customer_id: session.customer as string,
              pro_until: proUntil,
            })
            .eq("id", userId);

          if (profileError) {
            console.error(
              "Failed to update profile for pro subscription:",
              profileError
            );
          }
          break;
        }

        // ── One-time boost / payment checkout (existing logic) ───────────────
        const purchaseId = session.client_reference_id;
        const metadata = session.metadata || {};

        if (!purchaseId) {
          console.error("Missing client_reference_id in checkout session");
          break;
        }

        // Check if purchase already processed (idempotency)
        const { data: existingPurchase } = await supabase
          .from("purchases")
          .select("id, status")
          .eq("id", purchaseId)
          .maybeSingle();

        if (existingPurchase?.status === "completed") {
          console.log(`Purchase ${purchaseId} already processed`);
          break;
        }

        // Update purchase status
        const { error: updateError } = await supabase
          .from("purchases")
          .update({
            status: "completed",
            provider_payment_intent_id: session.payment_intent as string,
          })
          .eq("id", purchaseId);

        if (updateError) {
          console.error("Failed to update purchase:", updateError);
          break;
        }

        // Get purchase details
        const { data: purchase } = await supabase
          .from("purchases")
          .select("user_id, product_code, amount_cents, currency")
          .eq("id", purchaseId)
          .single();

        if (!purchase) {
          console.error(`Purchase ${purchaseId} not found`);
          break;
        }

        // Get product details
        const { data: product } = await supabase
          .from("products")
          .select("code")
          .eq("code", purchase.product_code)
          .single();

        if (!product) {
          console.error(`Product ${purchase.product_code} not found`);
          break;
        }

        // Create benefits based on product type
        const benefitType = product.code.startsWith("boost") ? "boost" :
                          product.code.startsWith("premium") ? "premium" :
                          product.code.startsWith("hide_phone") ? "hide_phone" :
                          product.code.startsWith("reserve") ? "reserve" :
                          product.code.startsWith("highlight") ? "highlight" : null;

        if (benefitType) {
          // Calculate valid_until based on product code
          let validUntil = new Date();
          if (product.code.includes("7d")) {
            validUntil.setDate(validUntil.getDate() + 7);
          } else if (product.code.includes("30d")) {
            validUntil.setDate(validUntil.getDate() + 30);
          } else if (product.code.includes("90d")) {
            validUntil.setDate(validUntil.getDate() + 90);
          } else {
            // Default to 30 days
            validUntil.setDate(validUntil.getDate() + 30);
          }

          const benefitData: {
            purchase_id: string;
            user_id: string;
            advert_id?: string;
            benefit_type: string;
            valid_until: string;
          } = {
            purchase_id: purchaseId,
            user_id: purchase.user_id,
            benefit_type: benefitType,
            valid_until: validUntil.toISOString(),
          };

          // Add advert_id if provided in metadata
          if (metadata.advert_id) {
            benefitData.advert_id = metadata.advert_id;
          }

          const { error: benefitError } = await supabase
            .from("benefits")
            .insert(benefitData);

          if (benefitError) {
            console.error("Failed to create benefit:", benefitError);
          }
        }

        // Log action
        await supabase.from("logs").insert({
          user_id: purchase.user_id,
          action: "purchase_completed",
          details: { purchase_id: purchaseId, product_code: purchase.product_code } as never,
        });

        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const activeStatuses: Stripe.Subscription.Status[] = [
          "active",
          "trialing",
        ];

        let proUntil: string | null;
        if (activeStatuses.includes(sub.status)) {
          proUntil = periodEndISO(sub);
          if (proUntil === null) {
            console.error(
              `customer.subscription.updated: skipping pro_until update for sub ${sub.id} — no current_period_end`
            );
            break;
          }
        } else {
          proUntil = null;
        }

        const { error: profileError } = await supabase
          .from("profiles")
          .update({ pro_until: proUntil })
          .eq("stripe_customer_id", customerId);

        if (profileError) {
          console.error(
            "Failed to update profile on subscription.updated:",
            profileError
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { error: profileError } = await supabase
          .from("profiles")
          .update({ pro_until: null })
          .eq("stripe_customer_id", customerId);

        if (profileError) {
          console.error(
            "Failed to update profile on subscription.deleted:",
            profileError
          );
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef =
          invoice.parent?.subscription_details?.subscription;
        if (!subRef) {
          // Not a subscription invoice — ignore
          break;
        }

        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(subRef as string);
        const proUntil = periodEndISO(sub);
        const customerId = invoice.customer as string;

        if (proUntil === null) {
          console.error(
            `invoice.paid: skipping pro_until update for sub ${subRef} — no current_period_end`
          );
          break;
        }

        const { error: profileError } = await supabase
          .from("profiles")
          .update({ pro_until: proUntil })
          .eq("stripe_customer_id", customerId);

        if (profileError) {
          console.error(
            "Failed to update profile on invoice.paid:",
            profileError
          );
        }
        break;
      }

      case "payment_intent.succeeded": {
        // This is handled by checkout.session.completed, but we can log it
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`Payment intent succeeded: ${paymentIntent.id}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        // Try to find purchase by payment_intent_id
        const { data: purchase } = await supabase
          .from("purchases")
          .select("id, user_id")
          .eq("provider_payment_intent_id", paymentIntent.id)
          .maybeSingle();

        if (purchase) {
          await supabase
            .from("purchases")
            .update({ status: "failed" })
            .eq("id", purchase.id);

          await supabase.from("logs").insert({
            user_id: purchase.user_id,
            action: "purchase_failed",
            details: { purchase_id: purchase.id, payment_intent_id: paymentIntent.id } as never,
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return createSuccessResponse({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
      status: 500,
      detail: "Webhook processing failed",
    });
  }
}
