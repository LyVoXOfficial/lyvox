import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { supabaseService } from "@/lib/supabaseService";
import {
  createErrorResponse,
  createSuccessResponse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import Stripe from "stripe";

export const runtime = "nodejs";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  console.warn("STRIPE_WEBHOOK_SECRET is not set. Webhook verification will be disabled.");
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

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

