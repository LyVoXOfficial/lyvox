# Pro Subscriptions (Stripe `mode:"subscription"`) — Build Note

**Status:** Build-ready slice. Money flow ① (Decision 1) → **company-free**: LyVoX sells its own service
to the seller; Stripe is already live for boosts. Built fully now, gated by the `pro_subscriptions`
capability flag + a `STRIPE_PRO_PRICE_ID` env. Founder activates by: creating a recurring Price in Stripe,
setting `STRIPE_PRO_PRICE_ID` + `CAPABILITY_PRO_SUBSCRIPTIONS=true` in Vercel. No company needed.

## 0. Decisions
- **Entitlement = `profiles.pro_until timestamptz` + `profiles.stripe_customer_id text`.** `isPro` ⇔
  `pro_until != null && pro_until > now`. The webhook sets `pro_until = subscription.current_period_end`
  on active/renewal, and `pro_until = null` on cancel/unpaid. Minimal, no extra table.
- **Plan = one Stripe recurring Price** referenced by env `STRIPE_PRO_PRICE_ID` (the founder sets the
  amount/interval in the Stripe dashboard — pricing is NOT in code, §10.1). One "Pro" tier for now.
- **Hard gate:** the subscribe route + the cabinet CTA require BOTH `isCapabilityEnabled('pro_subscriptions')`
  AND `STRIPE_PRO_PRICE_ID` set. Either missing → disabled/hidden. So nothing ships active until the
  founder configures it.
- Reuse the existing Stripe client (`lib/stripe/client.ts` `getStripe()`), webhook signature pattern, and
  rate-limiter conventions from `api/billing/checkout` + `api/billing/webhook`.

## 1. Pieces

### 1.1 Migration — `profiles.pro_until` + `stripe_customer_id`
- `alter table public.profiles add column if not exists pro_until timestamptz;`
  `alter table public.profiles add column if not exists stripe_customer_id text;`
- Both nullable, additive, behavior-neutral. Add to `database.types.ts` profiles Row/Insert/Update.
- `profiles` RLS SELECT is `using(true)` (world-readable) — `pro_until`/`stripe_customer_id` are not
  secret per se, but `stripe_customer_id` is best not exposed publicly. The API layer already controls
  which profile fields are selected publicly (the public profile page selects an explicit list and does
  NOT include these) — keep it that way. Writes to these columns go via SERVICE-role (webhook) only.

### 1.2 `lib/billing/proStatus.ts` (pure)
- `export function isPro(p: { pro_until: string | null | undefined }, now?: Date): boolean` →
  `!!p.pro_until && new Date(p.pro_until) > (now ?? new Date())`. Unit-tested (active future, past, null).

### 1.3 `POST /api/billing/subscribe` — start a subscription checkout
- File: `apps/web/src/app/api/billing/subscribe/route.ts` (`runtime="nodejs"`).
- Gate: if `!isCapabilityEnabled('pro_subscriptions')` OR `!process.env.STRIPE_PRO_PRICE_ID` →
  `createErrorResponse(ApiErrorCode.NOT_FOUND/FEATURE_DISABLED, { status: 404 })` (feature off).
- Auth: signed-in required → 401. (Optionally require phone-verified — keep it simple: just auth.)
- Reuse/create a Stripe customer: if `profiles.stripe_customer_id` set, reuse; else create
  `stripe.customers.create({ email, metadata:{ user_id } })` and store it on the profile via SERVICE-role.
- `stripe.checkout.sessions.create({ mode:"subscription", customer, line_items:[{ price: STRIPE_PRO_PRICE_ID, quantity:1 }], success_url, cancel_url, client_reference_id: user.id, metadata:{ user_id, plan:"pro" } })`.
- Return `createSuccessResponse({ url: session.url })`. Rate-limited (per-user + per-IP) like checkout.
- **TDD** `…/__tests__/subscribe-route.test.ts`: feature-off (flag unset OR price unset) → 404; no user → 401; happy → 200 with `url`, asserts `mode:"subscription"` + the price id used (mock getStripe + supabase + env).

### 1.4 Webhook extension — `apps/web/src/app/api/billing/webhook/route.ts`
- In the existing `switch (event.type)`, ADD cases (keep the existing `checkout.session.completed` boost
  logic — branch by `session.mode` or `metadata.plan`):
  - `checkout.session.completed` with `mode==='subscription'` (or `metadata.plan==='pro'`): read the
    subscription, set `profiles.pro_until = current_period_end`, `stripe_customer_id = customer` (service-role),
    keyed by `client_reference_id`/`metadata.user_id`.
  - `customer.subscription.updated`: set `pro_until = current_period_end` if status ∈ {active,trialing},
    else `pro_until = null` (past_due/canceled/unpaid). Find the user via `stripe_customer_id`.
  - `customer.subscription.deleted`: `pro_until = null`.
  - `invoice.paid` (renewal): set `pro_until = subscription.current_period_end`.
  - Existing default/boost cases unchanged.
- All profile writes via SERVICE-role (the webhook is a system actor; RLS would block otherwise).
- **TDD** extend the webhook test (mock constructEvent): a subscription `checkout.session.completed` sets
  `pro_until`; a `customer.subscription.deleted` clears it; the existing boost path still works.

### 1.5 Cabinet — wire the CTA + show status
- In `BusinessCabinet.tsx` (the flag-gated CTA block from the cabinet slice): when `proSubscriptionsEnabled`,
  render the "Upgrade to Pro" button → a small client component `UpgradeProButton.tsx` that POSTs to
  `/api/billing/subscribe` and redirects to `result.data.url`. If the viewer is already Pro
  (`isPro(profile)`), show "Pro active until <date>" instead. Pass `isPro` + `proUntil` from the page.
- i18n `pro.cabinet.upgrade.*` ×5 (CTA label, active-until, error).

## 2. Task breakdown (TDD, dependency order)
- **T1** migration (`profiles.pro_until` + `stripe_customer_id`) + types.
- **T2** `lib/billing/proStatus.ts` `isPro` + tests; new `ApiErrorCode.FEATURE_DISABLED` (or reuse NOT_FOUND).
- **T3** `POST /api/billing/subscribe` (flag+price gated, customer reuse/create, mode:subscription) + tests.
- **T4** webhook subscription cases (set/clear `pro_until`, service-role) + tests; existing boost path intact.
- **T5** cabinet `UpgradeProButton` + Pro-status display + i18n.
- **T6** review + deploy + prod verify (subscribe route 404 while flag/price unset; webhook still verifies signature; boosts unaffected).

## 3. Founder activation (no company)
1. In Stripe: create a "Pro" product + a recurring Price (set the amount/interval). Copy the Price ID.
2. In Vercel: set `STRIPE_PRO_PRICE_ID=price_…` and `CAPABILITY_PRO_SUBSCRIPTIONS=true`. Ensure the Stripe
   webhook endpoint includes the `customer.subscription.*` + `invoice.paid` events.
3. The "Upgrade to Pro" CTA appears in the business cabinet and works end-to-end.
