export type ProcessingActivity = {
  purpose: string;
  lawfulBasis: string;
  dataCategories: string[];
  processors: string[];
  retention: string;
};

/**
 * ROPA — GDPR Art.30 record of processing activities.
 * Processor names must exactly match PROCESSORS[].name entries.
 * Retention values marked "[founder/counsel TODO]" require confirmation.
 */
export const PROCESSING_ACTIVITIES: ProcessingActivity[] = [
  {
    purpose: "Account creation and authentication",
    lawfulBasis: "Art.6(1)(b) — performance of contract (marketplace account)",
    dataCategories: ["Email address", "Hashed password", "Session tokens", "Auth event timestamps"],
    processors: ["Supabase"],
    retention: "Until account deletion by user, then 30 days for soft-delete grace period",
  },
  {
    purpose: "Phone number verification (OTP via SMS)",
    lawfulBasis:
      "Art.6(1)(a) — consent; Art.6(1)(b) — contract (verified phone required for posting)",
    dataCategories: ["Phone number (E.164)", "OTP code hash", "Verification status", "Phone line-type data"],
    processors: ["Twilio", "Supabase"],
    retention: "Phone number retained until account deletion; OTP codes purged after verification (minutes)",
  },
  {
    purpose: "Listing creation, storage, and publication (including media/photos)",
    lawfulBasis: "Art.6(1)(b) — performance of contract",
    dataCategories: [
      "Listing title, description, price, category, location",
      "Listing photos (uploaded files)",
      "Seller contact preferences",
    ],
    processors: ["Supabase"],
    retention: "Retained while listing is active or in draft; deleted on user request or account deletion. [founder/counsel TODO: archive period for sold/expired listings]",
  },
  {
    purpose: "In-platform messaging between buyers and sellers",
    lawfulBasis: "Art.6(1)(b) — performance of contract",
    dataCategories: ["Message text", "Sender/recipient user IDs", "Timestamps", "Listing context"],
    processors: ["Supabase"],
    retention: "[founder/counsel TODO: confirm chat retention period — e.g. 12 months after last message or account deletion]",
  },
  {
    purpose: "Payments for paid listing boosts and Pro subscriptions (Stripe)",
    lawfulBasis:
      "Art.6(1)(b) — performance of contract; Art.6(1)(c) — legal obligation (accounting/tax retention)",
    dataCategories: [
      "Stripe customer ID",
      "Payment intent metadata",
      "Purchase amount and product",
      "Billing event timestamps",
    ],
    processors: ["Stripe", "Supabase"],
    retention: "Payment records retained 7 years to satisfy Belgian/EU accounting obligations (Art.6(1)(c)). Card data held by Stripe only.",
  },
  {
    purpose: "Anti-bot / anti-fraud protection (CAPTCHA challenge on sensitive actions)",
    lawfulBasis: "Art.6(1)(f) — legitimate interests (fraud prevention, platform security)",
    dataCategories: ["IP address", "Cloudflare Turnstile challenge token", "Browser fingerprint signals"],
    processors: ["Cloudflare"],
    retention: "Challenge tokens are ephemeral (request-level). [founder/counsel TODO: confirm Cloudflare log retention in DPA]",
  },
  {
    purpose: "Rate-limiting and abuse prevention (Redis counters per IP/user)",
    lawfulBasis: "Art.6(1)(f) — legitimate interests (platform integrity)",
    dataCategories: ["IP address", "User ID (hashed)", "Request counts and sliding-window timestamps"],
    processors: ["Upstash"],
    retention: "TTL-based; rate-limit keys expire automatically (minutes to hours). [founder/counsel TODO: confirm Upstash log retention]",
  },
  {
    purpose: "Application hosting, serving, and server-side logs",
    lawfulBasis: "Art.6(1)(f) — legitimate interests (service delivery, error diagnostics)",
    dataCategories: ["IP address", "Request URL and method", "HTTP status codes", "User-Agent", "Error stack traces"],
    processors: ["Vercel"],
    retention: "[founder/counsel TODO: confirm Vercel log retention period; default 1–7 days depending on plan tier]",
  },
  {
    purpose: "Business/trader verification (KBO enterprise number + VIES VAT check)",
    lawfulBasis:
      "Art.6(1)(c) — legal obligation (Belgian consumer law; DSA Art.30 trader verification)",
    dataCategories: [
      "KBO enterprise number",
      "VAT number",
      "Company legal name and address",
      "VIES lookup result",
    ],
    processors: ["Supabase"],
    retention: "Retained for the lifetime of the business seller account plus [founder/counsel TODO: confirm legal-hold period post-account closure]",
  },
];

/**
 * Sub-processors (Art.28 / Art.30(1)(d)).
 * US-based processors: DPF/SCC safeguard applicability to be confirmed by founder/counsel.
 */
export const PROCESSORS: { name: string; role: string; location: string }[] = [
  {
    name: "Supabase",
    role: "Database (PostgreSQL), auth, file storage, realtime messaging",
    location: "EU (AWS eu-west-1 / eu-central-1). US-transfer safeguards: confirm DPF/SCC with Supabase DPA.",
  },
  {
    name: "Stripe",
    role: "Payment processing, subscription management, billing",
    location: "US / Ireland. US-transfer safeguards: confirm DPF/SCC with Stripe DPA.",
  },
  {
    name: "Twilio",
    role: "SMS OTP delivery and phone number lookup (line-type check)",
    location: "US. US-transfer safeguards: confirm DPF/SCC with Twilio DPA.",
  },
  {
    name: "Cloudflare",
    role: "CDN, DDoS protection, Turnstile anti-bot CAPTCHA",
    location: "Global (EEA nodes used). US-transfer safeguards: confirm SCC with Cloudflare DPA.",
  },
  {
    name: "Upstash",
    role: "Serverless Redis for rate-limiting and short-lived cache",
    location: "EU (eu-west-1). US-transfer safeguards: confirm DPF/SCC with Upstash DPA.",
  },
  {
    name: "Vercel",
    role: "Application hosting, serverless functions, edge network",
    location: "Global (EEA edge nodes). US-transfer safeguards: confirm SCC with Vercel DPA.",
  },
];
