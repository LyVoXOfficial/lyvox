import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe/client";
import { supabaseService } from "@/lib/supabaseService";
import { revalidateAdvert } from "@/lib/advert/advertDetail";
import type { Database, Json } from "@/lib/supabaseTypes";
import {
  createErrorResponse,
  createSuccessResponse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import Stripe from "stripe";
import { getIntegrationStatus } from "@/lib/integrations/registry";
import { getCommercialBoundary } from "@/lib/settings/platformSettings";

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

/**
 * F1 idempotency gate.
 *
 * Returns "process"  → handle the event (first delivery OR retry of a failure).
 * Returns "skip"     → event already processed successfully; return 200 early.
 *
 * Design: we INSERT the event_id on arrival. processed_at is set to now() ONLY
 * after the business-effect succeeds, so a crash between INSERT and UPDATE leaves
 * processed_at = NULL — Stripe retries will be admitted through the gate and
 * re-run the handler. A successfully completed event has processed_at IS NOT NULL
 * and is immediately skipped on re-delivery.
 *
 * webhook_events is covered by generated DB types after the schema push.
 */
async function idempotencyGate(
  supabase: SupabaseClient<Database>,
  event: Stripe.Event,
): Promise<"process" | "skip"> {
  const we = supabase.from("webhook_events");

  // Attempt to record this event. ignoreDuplicates: true → ON CONFLICT DO NOTHING.
  // data will be [{event_id}] on insert, [] on conflict.
  const { data: newRows, error: insertError } = await we
    .upsert(
      {
        provider: "stripe",
        event_id: event.id,
        type: event.type,
        payload: event as unknown as Json,
        received_at: new Date().toISOString(),
      },
      { onConflict: "event_id", ignoreDuplicates: true },
    )
    .select("event_id");

  if (insertError) {
    throw new Error(
      `Failed to journal webhook ${event.id}: ${insertError.message}`,
    );
  }

  const isFirstDelivery = Array.isArray(newRows) && newRows.length > 0;
  if (isFirstDelivery) {
    return "process";
  }

  // Conflict: event_id already exists. Determine if it was processed successfully.
  const { data: existing, error: readError } = await we
    .select("processed_at")
    .eq("event_id", event.id)
    .maybeSingle();

  if (readError) {
    throw new Error(
      `Failed to read webhook journal ${event.id}: ${readError.message}`,
    );
  }

  if (existing?.processed_at) {
    console.log(`Webhook ${event.id} already processed — skipping`);
    return "skip";
  }

  // processed_at is NULL: prior delivery failed → let this retry through.
  return "process";
}

/** Mark an event as fully processed. Called AFTER business logic succeeds. */
async function markWebhookProcessed(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<void> {
  const { error } = await supabase
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);

  if (error) {
    // Business effects are idempotent. Returning 5xx is safer than acknowledging
    // an event while its journal still says it needs reconciliation.
    throw new Error(
      `Failed to mark webhook ${eventId} processed: ${error.message}`,
    );
  }
}

export async function POST(req: NextRequest) {
  // Cheap DB-authoritative boundary first. In the initial contact-only state,
  // arbitrary public POSTs cannot amplify into health/approval registry reads.
  const { launchMode, reconciliationEnabled } = await getCommercialBoundary();
  if (launchMode === "contact_only" && !reconciliationEnabled) {
    return createErrorResponse(ApiErrorCode.FEATURE_DISABLED, { status: 404 });
  }

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

  const eventCapabilityName = (() => {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      return session.mode === "subscription" || session.metadata?.plan === "pro"
        ? ("pro_subscriptions" as const)
        : ("paid_boosts" as const);
    }
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted" ||
      event.type === "invoice.paid"
    ) {
      return "pro_subscriptions" as const;
    }
    if (
      event.type === "payment_intent.succeeded" ||
      event.type === "payment_intent.payment_failed"
    ) {
      return "paid_boosts" as const;
    }
    return null;
  })();
  const eventCapability = eventCapabilityName
    ? await getIntegrationStatus(eventCapabilityName)
    : null;

  const reconciliationOnly = Boolean(
    eventCapability && !eventCapability.effective,
  );
  if (reconciliationOnly && !reconciliationEnabled) {
    return createSuccessResponse({
      received: true,
      ignored: true,
      reason: "capability_disabled",
    });
  }

  const supabase = await supabaseService();

  // ── F1: Idempotency gate ──────────────────────────────────────────────────
  let gate: "process" | "skip";
  try {
    gate = await idempotencyGate(supabase, event);
  } catch (error) {
    console.error("Webhook journal error:", error);
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
      status: 500,
      detail: "Webhook journal unavailable",
    });
  }
  if (gate === "skip") {
    return createSuccessResponse({ received: true, skipped: true });
  }

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
              "Pro subscription checkout: missing user id (client_reference_id / metadata.user_id)",
            );
            break;
          }

          const customerId =
            typeof session.customer === "string" ? session.customer : null;
          if (!customerId) {
            console.error(
              "Pro subscription checkout: missing Stripe customer id",
            );
            break;
          }

          const { data: knownProfile, error: knownProfileError } =
            await supabase
              .from("profiles")
              .select("id")
              .eq("id", userId)
              .eq("stripe_customer_id", customerId)
              .maybeSingle();
          if (knownProfileError || !knownProfile) {
            console.error(
              "Pro subscription checkout does not match a known LyVoX customer",
            );
            break;
          }

          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string,
          );
          const proUntil = periodEndISO(sub);

          if (proUntil === null) {
            console.error(
              `checkout.session.completed: skipping pro_until update for sub ${session.subscription} — no current_period_end`,
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
              profileError,
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

        // Bind the signed event to the exact immutable purchase snapshot created
        // before redirecting to Stripe. No prefix inference or dashboard-created
        // session can mint a LyVoX entitlement.
        const { data: purchase, error: purchaseError } = await supabase
          .from("purchases")
          .select(
            "id, user_id, advert_id, product_code, product_offer_version, amount_cents, currency, status, provider_session_id",
          )
          .eq("id", purchaseId)
          .maybeSingle();

        if (purchaseError || !purchase) {
          console.error(
            `Purchase ${purchaseId} not found for signed checkout session`,
          );
          break;
        }

        if (purchase.status === "completed") {
          console.log(`Purchase ${purchaseId} already processed`);
          break;
        }

        const expectedAdvertId = purchase.advert_id ?? "";
        const sessionMatchesPurchase =
          purchase.provider_session_id === session.id &&
          session.payment_status === "paid" &&
          session.amount_total === purchase.amount_cents &&
          session.currency?.toLowerCase() ===
            (purchase.currency ?? "EUR").toLowerCase() &&
          metadata.purchase_id === purchase.id &&
          metadata.user_id === purchase.user_id &&
          metadata.product_code === purchase.product_code &&
          (metadata.advert_id ?? "") === expectedAdvertId;

        if (!sessionMatchesPurchase) {
          console.error(
            `Checkout session ${session.id} does not match purchase ${purchaseId}`,
          );
          break;
        }

        // Resolve the versioned offer contract that was accepted at checkout.
        const { data: product } = await supabase
          .from("products")
          .select(
            "code, capability, benefit_type, duration_days, offer_version",
          )
          .eq("code", purchase.product_code)
          .eq("capability", "paid_boosts")
          .single();

        if (
          !product ||
          product.offer_version !== purchase.product_offer_version
        ) {
          console.error(`Product ${purchase.product_code} not found`);
          break;
        }

        if (purchase.user_id) {
          // purchase.user_id is nullable after GDPR erasure; skip benefit
          // creation if the account has been erased (no user to grant it to).
          const validUntil = new Date();
          validUntil.setDate(validUntil.getDate() + product.duration_days);

          const benefitData: {
            purchase_id: string;
            user_id: string;
            advert_id?: string;
            benefit_type: string;
            valid_until: string;
          } = {
            purchase_id: purchaseId,
            user_id: purchase.user_id,
            benefit_type: product.benefit_type,
            valid_until: validUntil.toISOString(),
          };

          if (purchase.advert_id) {
            benefitData.advert_id = purchase.advert_id;
          }

          const { error: benefitError } = await supabase
            .from("benefits")
            .upsert(benefitData, {
              onConflict: "purchase_id,benefit_type",
              ignoreDuplicates: true,
            });

          if (benefitError) {
            throw new Error(
              `Failed to create benefit: ${benefitError.message}`,
            );
          } else if (benefitData.advert_id) {
            // PERF-01: a boost benefit changes the advert's BenefitsBadge — bust
            // the cached /ad/[id] detail so the badge appears without the delay.
            revalidateAdvert(benefitData.advert_id);
          }
        }

        const { error: updateError } = await supabase
          .from("purchases")
          .update({
            status: "completed",
            provider_payment_intent_id: session.payment_intent as string,
          })
          .eq("id", purchaseId)
          .eq("status", "pending");

        if (updateError) {
          throw new Error(
            `Failed to complete purchase: ${updateError.message}`,
          );
        }

        // Log action
        await supabase.from("logs").insert({
          user_id: purchase.user_id,
          action: "purchase_completed",
          details: {
            purchase_id: purchaseId,
            product_code: purchase.product_code,
          } as never,
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
              `customer.subscription.updated: skipping pro_until update for sub ${sub.id} — no current_period_end`,
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
            profileError,
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
            profileError,
          );
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
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
            `invoice.paid: skipping pro_until update for sub ${subRef} — no current_period_end`,
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
            profileError,
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
            details: {
              purchase_id: purchase.id,
              payment_intent_id: paymentIntent.id,
            } as never,
          });
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // ── F1: Mark as fully processed — set AFTER business logic succeeds ──────
    await markWebhookProcessed(supabase, event.id);

    return createSuccessResponse({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // processed_at intentionally NOT set — Stripe will retry and we'll re-run.
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, {
      status: 500,
      detail: "Webhook processing failed",
    });
  }
}
