// SEC-ENV: STRIPE_SECRET_KEY is a server-only secret (a restricted key, per rotation
// procedure in docs/security/SEC-ENV-key-rotation.md). This throws at build time if
// ever imported into a client bundle, mirroring the supabaseService.ts guard.
import "server-only";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  });

  return stripeClient;
}
