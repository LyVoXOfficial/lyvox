# LyVoX — Marketplace Accounts, Identity & Trust System Design

**Status:** Decision-oriented system design (not code). Synthesizes six research dossiers into one coherent plan tailored to the live LyVoX stack and the founder's "no company registered yet during dev" constraint.
**Date:** 2026-06-26
**Stack:** Next.js 16 App Router · Supabase (Postgres + RLS + Supabase Auth) · Twilio (Lookup/SMS/Verify) · Stripe (live) · Vercel · Tailwind v4 · 5 locales (en/ru/nl/fr/de)
**Scope:** Account model for both seller types, identity/anti-fraud, EU+Belgian compliance, Supabase data model + RLS, dashboards, public profiles/badges, phased rollout.

---

## The framing decisions that govern this entire document

Before any section: three cross-cutting decisions were resolved up front because every section depends on them. If you read nothing else, read these.

### Decision 1 — There are TWO different "monies," and only one of them is a compliance trip-wire

The single most important architectural fact. The legal dossier (Research 1) concluded LyVoX sits at the *lighter* end of DSA/DAC7/VAT *because it is contact-only*. The dashboard dossier (Research 5) discovered Stripe is *already live in production*. These are not in conflict once you separate two distinct money flows:

| Money flow | What it is | Live today? | Triggers DAC7 / VAT-deemed-supplier / DSA Art. 30 KYBC? |
|---|---|---|---|
| **Money flow ① — Platform ↔ Seller monetization** | LyVoX charges the seller for *its own services*: per-advert boosts (live), pro subscriptions (next). LyVoX is the merchant; the buyer of the service is the seller. | **YES** — `apps/web/src/app/api/billing/checkout/route.ts` + `webhook/route.ts` + `lib/stripe/client.ts`, `mode:"payment"`. | **NO.** LyVoX never sees or facilitates the buyer↔seller *transaction value*. It is selling visibility, not goods. |
| **Money flow ② — Buyer ↔ Seller transaction facilitation** | On-platform checkout, "buy now," escrow, shipping orchestration, **payouts** (LyVoX holds/forwards buyer funds to the seller). | **NO** | **YES — all three regimes switch on simultaneously.** This is Research 1's trip-wire and Research 5's "genuine company gate." |

**Consequence used throughout:** *Adding pro-subscription billing is NOT company-gated and NOT "later"* — it reuses the existing Stripe rail (`mode:"payment"` → `mode:"subscription"`). The thing the founder must not cross while company-less is **money flow ②**, which is conveniently the same line that detonates the heavy compliance burden. Treat "add buyer↔seller payments/payouts" as a **compliance milestone**, not just a feature.

### Decision 2 — Canonical names and the "no status enum" trust model (locked once, used everywhere)

To prevent the data-model, dashboard, and badge sections from contradicting each other, these names and rules are canonical across Sections 6–9:

- **`profiles.seller_type`** `ENUM('individual','business')` — the human's *default* posting identity (физ/particulier vs юр/zakelijk). (Dossiers variously said `seller_kind`/`seller_type`; **`seller_type` wins**.)
- **`businesses`** + **`business_members`** — a business is a *separate legal entity* a human acts on behalf of, with a team/roles join table. (Rejected: R6's 1:1 `business_profiles`, which cannot represent one human with two businesses or multiple staff. **`businesses` + `business_members` wins** because Section 2 and Section 7 both require teams/roles.)
- **`verifications`** — one polymorphic verification table (single live row per subject+method, not an append-only ledger — see §6.4) over `subject_type ∈ {user,business}`. (R6's `seller_verifications` is folded into this single name.)
- **`kyc_records`** — sensitive ID/KYB artefacts, isolated table, owner+admin RLS only.
- **`badges_awarded`** — stores *only* non-derivable manual badges; everything else is derived at read time.
- **No linear status enum.** Trust **level is derived** from `verifications` (+ the already-shipped `verified_email`/`verified_phone`/`itsme_verified` booleans as read-caches). **Suspension is an orthogonal overlay** (`profiles.blocked_until`/`flags`, `businesses.status='suspended'`), never a rung on the ladder. A single `unverified→…→suspended` column is rejected: it would conflate person-identity with entity-identity (two independent axes) and contradict the booleans already in production.

### Decision 3 — Activation-ready by default: build now, flip-a-switch later

The founder's strategy is **validate-first, monetize-later, with zero re-architecture at each gate**: launch FREE (no payments, no subscriptions) to test whether the audience shows up; if it lives, register a **sole proprietorship (eenmanszaak)** and switch on identity + (optionally) paid plans; as profit grows and is journaled, incorporate a **full company** and switch on buyer↔seller payments. The non-negotiable requirement: at each gate, going live must be **"add a credential, flip a flag" — minutes, not a week of building after launch.**

Therefore every company-gated capability is **engineered NOW, gated OFF**, never "deferred to be built later":

- **Capability flags.** A single env/config-driven capability registry — e.g. `PRO_SUBSCRIPTIONS_ENABLED`, `STRIPE_IDENTITY_ENABLED`, `ITSME_ENABLED`, `WHATSAPP_OTP_ENABLED`, `PAYMENTS_ESCROW_ENABLED` — all defaulting **OFF / free**. Server guards and UI both read the flag (features render as hidden or "coming soon" until on). Activation = set the flag + add credentials, **no deploy-time code change**.
- **Provider adapters.** Every contract-gated integration (identity verification, OTP channel, KYB lookup, payments/payouts) sits behind a small adapter interface; the app codes against the interface, the concrete provider is wired when its contract lands. Going live = implement/enable one adapter + set env, not touch the call sites.
- **Schema-complete from day one.** All Phase-B columns/tables (the `verifications` ID axis, `kyc_records`, payout/IBAN, `reviews`) are created in the Phase-A migrations, so there is **no migration scramble** at activation.
- **Honest testability caveat (two speeds of "instant").** *Software-only* capabilities (pro subscriptions on the existing Stripe `mode:"subscription"` rail, business profiles, badges, dashboards, free KBO/VIES checks) are built AND live-testable now — they just default to free/off, so turning them on is truly instant. *Contract-gated* integrations (itsme, WhatsApp-OTP, Stripe Connect payouts, paid KYB) are built to the adapter + flag but **cannot be fully smoke-tested until the credentials exist**; their activation is "add credentials + flip flag + a 10-minute smoke test" — still minutes, not a rebuild.

**Consequence used throughout:** the §9 "phases" are **activation events, not build phases.** The build happens now (Phase A); Phase B / identity / payments are *switched on* when the legal-commercial gate is crossed. Every section below that touches a Phase-B capability must specify its flag name and (if external) its adapter seam.

---

## 1. Overview & Goals; the физ vs юр distinction

### 1.1 Goals
LyVoX is a Belgian (EU) contact-based classifieds marketplace (peer of 2dehands/2ememain, Marktplaats, leboncoin): listings are posted, buyers and sellers make contact, **the transaction happens off-platform**. The system must make **both seller types first-class**:

- **Физ. лица / particulier (C2C private sellers)** — individuals selling their own used goods. Owe no consumer-law withdrawal right; privacy-minimized public profile.
- **Юр. / zakelijk (B2C professional/business "traders")** — companies, sole traders (eenmanszaak/indépendant). Trigger consumer-protection duties (14-day withdrawal, warranty) and DSA trader-traceability; legal identity must be public.

The design must cleanly separate **buildable NOW without registering any company** from **needs a company / a signed contract (later)**, because the founder will not incorporate during development.

### 1.2 The физ-vs-юр distinction is the legal hinge of the whole product
Belgian Code of Economic Law (CEL), as amended by the **Omnibus Directive** (in force **28 May 2022**), requires the marketplace to indicate **per listing whether the third-party seller is a "trader" or not**, based on the seller's self-declaration. This single flag determines:
- whether the buyer has a **14-day withdrawal right** and legal warranty (only against traders);
- whether **DSA Art. 30 trader-traceability** and public trader-info apply (traders only);
- what may be **shown vs minimized** on the public profile (traders cannot hide legal name/address; private sellers must be able to).

Therefore `seller_type` is not cosmetic — it is the spine of compliance, UI, and data model.

### 1.3 What already exists (verified against the live codebase)
- `profiles` (1:1 with `auth.users`; `display_name`, `verified_email`, `verified_phone`, `itsme_verified`, `itsme_kyc_level`, `flags jsonb`, `blocked_until`), `phones`, `adverts`, `trust_score`, `reports`, `fraud_rules`/`fraud_detection_logs`, billing (`products`/`purchases`/`benefits`), chat, notifications.
- Helpers: `is_admin()` (JWT role), `is_user_blocked()`, `set_updated_at()`, `validate_belgian_vat()`, `search_adverts()` (keys "verified" off `verified_email AND verified_phone`).
- RLS: `profiles` SELECT is `using(true)` — **rows are world-readable; field filtering happens in the API layer**. (This is the reason all KYC data must live in a *separate* table — see §6.4.)
- Anti-fraud Tier 1 (real Belgian mobile via Twilio Lookup line-type) deployed; trust gates open(browse)/auth(like)/verified-phone(contact+publish) live.
- **No `seller_type`, `businesses`, or KBO/VAT concept exists in code yet** — greenfield.

---

## 2. Account Model & Lifecycle (upgrade физ→юр, teams/roles)

### 2.1 One human = one profile. A business is a separate entity acted on behalf of.
`profiles.id = auth.users.id` is a fixed 1:1. A business is **never** a second profile (that would fight Supabase Auth and break `adverts.user_id`). Instead:

- A human's **default** posting identity is `profiles.seller_type`.
- A **business** is a `businesses` row; humans are linked via `business_members` (with roles).
- An advert records **who posted** (`adverts.user_id`, unchanged — the audit + RLS anchor) **and on whose behalf** (`adverts.business_id`, nullable). `NULL` = sold privately by the human; set = sold on behalf of that business.

This makes "sell as myself / as Business X" a **per-listing** choice and natively supports one human running multiple businesses and one business with multiple staff.

### 2.2 The физ→юр "upgrade" is NOT a profile mutation
Upgrading to professional means the human **creates or joins a business** — their single profile is untouched, existing private listings stay private, and new listings can be posted as the business. Nothing is migrated or rewritten. `profiles.seller_type='business'` simply records their *default* and unlocks the `/pro` cabinet; the per-advert `business_id` does the real work. The flag is **reversible** (a pro can still sell a private item).

### 2.3 Teams & roles
`business_members(business_id, user_id, role, accepted_at, …)` with a 3-rung ladder:

| Role | Capabilities |
|---|---|
| **owner** | billing, delete business, manage all members, everything below |
| **admin** | manage listings incl. **delete any business listing** + manage members below admin |
| **member** | post/edit listings *as the business*; **may NOT delete other members' listings** |

One user → many businesses; one business → many users. `accepted_at IS NULL` = pending invite. This ladder is **enforced in RLS by verb** (§6.8): read/insert/update at `member`, **delete at `admin`**, owner-management/billing at `owner` — not merely documentary.

### 2.4 Lifecycle states (two independent axes + an overlay)
- **Human identity axis (физ):** L0 anon → L1 auth → L2 email → L3 phone → L4 ID — *derived*, not a column.
- **Business entity axis (юр):** B0 declared (VAT format valid only) → B1 entity-verified (KBO/VIES matched).
- **Suspension overlay (orthogonal):** `blocked` (`blocked_until>now()`), `flagged` (`flags->>'manual_review'`), `business suspended` (`businesses.status='suspended'`, e.g. DSA Art. 30(3) stale trader info). Any overlay disables publish/contact regardless of level.

"**Sell as business**" requires `human ≥ L3 (phone)` **AND** `business ≥ B1` — two axes that a single enum cannot express. (See the full matrix in §6.7.)

---

## 3. Registration Flows (step by step)

### 3.1 Individual (физ) — unchanged from today
1. Sign up (email/password or OAuth) → `profiles` row auto-created, `seller_type='individual'`.
2. **Tier 0 bot/abuse screen** at signup (Turnstile + disposable-email block + velocity/IP — see §4).
3. Verify email → `verified_email=true` (L2).
4. **Tier 1 phone OTP** (Twilio Lookup line-type → real Belgian mobile) → `verified_phone=true` (L3). *Already enforced for contact + publish.*
5. Can browse (L0), like/save (L1), draft (L2), **contact sellers + publish individual adverts (L3)**.

### 3.2 Business (юр) — an "Upgrade to a professional account" wizard
Launched from the Billing tab CTA (it is an *upgrade*, not a second signup):

1. **Choose "I sell as a business / professional"** → sets `profiles.seller_type='business'` (reversible). The business row **and** its first `business_members` `role='owner'` row are created **atomically by the `create_business()` SECURITY DEFINER RPC** (§6.8) — not two client inserts, which RLS cannot bootstrap (chicken-and-egg: no membership row exists yet). New business starts `status='draft'`.
2. **Company identity capture** (consumer-law A2 fields; superset overlaps DAC7/Art. 30): `legal_name`, `trade_name`, `legal_form`, `kbo_number` (normalized to 10 digits), `vat_number`, registered address, public `email`/`phone`. `validate_belgian_vat()` runs as a CHECK (format only — **buildable now**). **No ID-document copy is collected** (Art. 30(1)(b) is deferred — §5.2 bet).
3. **Trader self-declaration + self-certification** (drives the Omnibus public trader label + the legal-compliance self-certification).
4. **Entity verification (Phase A, company-free) — staged & asynchronous (§5.2.1):** *synchronously* validate format (B0) and let the business reach a provisional state; *asynchronously* (queued, retry/backoff) call **VIES** `check-vat-number` (valid + official name/address; store the consultation/request identifier as audit evidence) and **KBO/CBE** lookup (active status, NACE codes, published director names). On clean match → `businesses.entity_verified=true`, `status='active'` (B1), `verifications` rows `method ∈ {vies,kbo}` flip to `verified`. On `MS_UNAVAILABLE`/transient → stays pending (provisional publish per §10.1 or admin manual-approve). On definitive mismatch → `verifications.status='failed'`, publish blocked, routed to support. **VIES is never a hard synchronous gate.**
5. **Soft representation check (company-free proxy for "controls the company"):** require the signing user's name to match a **published KBO director/zaakvoerder**, OR a postal/email control to the registered address/verified domain. Honest UI limitation: this confirms the *company* + a *plausible link*, not a cryptographically-proven representative. (Strong proof = itsme/eID, Phase B.)
6. **Tier 1 phone** if not already done (L3).
7. **Pick a plan** (free/basic, or a paid pro tier — Stripe subscription, money flow ①).
8. Optional now: configure storefront. Deferred (money flow ②): payouts/IBAN shown as "coming soon."

Listing **as the business** is blocked until the **consumer-law fields (a)(d)(e)** are captured and **B1** reached (or provisional-active per §5.2.1). The Art. 30(1)(b) ID copy is **not** part of this gate (corrected — see §5.2/B1).

---

## 4. Identity & Anti-Fraud Architecture (Tier 0–3, both types)

Every layer tagged **[NOW]** = company-free, buildable today · **[LATER]** = needs LyVoX's own company/contract.

### 4.1 The honest threat model (state this plainly to the founder)
- Online SMS-receive / virtual numbers → **defeated now** by Tier 1 (line-type + `sms_pumping_risk`); they are VoIP/non-fixed.
- **SIM-farm / SIM-bank real mobiles → the residual gap.** They use *genuine* mobile lines, so they **pass** line-type and pumping-risk checks (Europol "Operation SIMCARTEL", 2025: 40,000 SIMs → 49M+ fake accounts). The company-free correlation stack (device fingerprint + datacenter/VPN IP + velocity + Turnstile) makes mass fraud **expensive and slow** but does **not close** the gap. What *closes* it is an **identity-binding layer** (document+selfie or eID) tying one account to one human — and that is **mostly [LATER]**, with **Stripe Identity the one exception** the moment a KBO number exists.

### 4.2 The "no company" branch question (founder must pick — see §10)
- **Branch A** — "no company" allows registering a **sole proprietorship (eenmanszaak / KBO number)**. Then **Stripe Identity** turns on: **€1.25 / successful doc+selfie, €0.40 / ID-number lookup, first 50 free**, self-serve, no sales call. This is the cheapest thing that closes the SIM-farm gap.
- **Branch B** — "no company" means **no KBO registration at all**. Then there is **no** company-free document-verification path; identity-binding stays [LATER]. **Design for Branch B now**; treat Stripe Identity as the first switch flipped the instant any KBO number exists.

### 4.3 Layered architecture (both seller types)

| Tier / layer | Mechanism | Provider | Type | Status |
|---|---|---|---|---|
| **T0 bot defense** | Turnstile on signup/login/OTP/publish | **Cloudflare Turnstile** (free ~1M/mo, no billing card) | both | **[NOW]** |
| **T0 disposable-email block** | self-hosted blocklist | VegaStack / Rapid Email Verifier | both | **[NOW]** |
| **T0 velocity / correlation** | in-house rate+correlate by IP/device/email-domain/phone-prefix | — (highest-ROI, zero cost) | both | **[NOW]** |
| **T0 IP / VPN / datacenter reputation** | signup-IP reputation | IPQualityScore (free tier) | both | **[NOW]** |
| **T0 device fingerprint** | reuse correlation | open-source FingerprintJS (Pro = paid, still company-free) | both | **[NOW]** |
| **T1 real mobile** | Lookup `line_type_intelligence` (deployed) **+ add `sms_pumping_risk`** | **Twilio Lookup** | both | **[NOW]** |
| **T1.5 entity check (юр)** | KBO/CBE lookup + VIES VAT validation + name/address match | gov registers (free) | юр | **[NOW]** |
| **T2.5 ATO defense (existing users)** | `sim_swap` + `call_forwarding` before high-value actions | Twilio Lookup | both | **[NOW]**, later-stage need |
| **T2 stronger phone** | WhatsApp-OTP (no SMS fallback) | WhatsApp Business / Meta Business | both | **[LATER]** (registered company) |
| **T3 identity binding** | doc + selfie/liveness | **Stripe Identity** (€1.25/check) | both | **Branch A: [NOW] w/ KBO · Branch B: [LATER]** |
| **T3+ strong identity** | Belgian-grade person identity / legal-rep binding | **itsme** / Belgian eID (via itsme/broker) | both, esp. юр | **[LATER]** (contract) |
| **T4 scale IDV** | doc+biometric at scale | Veriff (~$0.80, self-serve) / Onfido (enterprise) | both | **[LATER]** |

### 4.4 Trust-gate mapping (extends the shipped gates)
open(browse) → no checks · auth(like) → T0 · **verified-phone (contact + publish)** → T0+T1 *(current production gate)* · **new "Verified Identity" badge** (high-value sells, higher limits) → T3 (Stripe Identity now-with-KBO / itsme later) · **"Verified Business" badge** → T1.5 (KBO+VIES) + representative T3.

### 4.5 Immediate recommendation (priority order, all [NOW] unless noted)
1. Turnstile + disposable-email blocklist + in-house velocity/correlation + FingerprintJS + **add Twilio `sms_pumping_risk`**.
2. IPQS free tier; KBO/CBE + VIES for the юр path.
3. *The moment any KBO number exists:* turn on **Stripe Identity** ("Verified Identity" badge) — highest-leverage SIM-farm closer.
4. **[LATER]:** WhatsApp-OTP (T2), itsme (T3, pro tier + premium badge), Veriff/Onfido at scale, `sim_swap`/`call_forwarding` as the base grows.

### 4.6 Buyer-side trust (the named "seller→buyer trust" axis — not just seller verification)
The threat model above is seller-side. The founder's ask names **seller→buyer trust** too, and on a contact-only marketplace the **buyer-initiated scam is a primary vector** (advance-fee/overpayment, fake "courier" payment-link phishing, off-platform redirect, account-takeover of a buyer). This is **not** a separate subsystem — it reuses the same gates and pipes:

- **Buyers are already gated by T0+T1.** Contacting a seller requires `verified_phone` (the current prod gate), so the same anti-bot + real-mobile binding that protects sellers binds buyers initiating contact. State this explicitly: the T0/T1 stack is symmetric.
- **Buyer-risk surface in chat (Phase A, software-only):** scam-pattern detection in messages (off-platform-payment lures, courier/payment-link phishing, "send code to confirm" social-engineering) wired into the existing AI moderation; a **"Report this buyer"** flow (the inverse of "report listing", reusing the reports table); rate-limit/velocity on outbound first-contacts to throttle buyer spam.
- **Seller-facing buyer signal (modest, Phase A):** surface to a seller deciding whether to engage whether the contacting buyer is **phone-verified** and account-age-bucketed (no reputation score yet — buyers have no transaction history on a contact-only board). A buyer "ratings" axis is **deferred with reviews** (§8.4, Phase B) and shares the off-platform-sale eligibility problem.
- **Explicitly deferred:** a full buyer reputation/scoring model. Justification: with no on-platform transactions, there is no reliable buyer-side signal beyond identity + behavior, and over-surfacing weak signals invites discrimination. Revisit if money flow ② (on-platform transactions) ever lands.

---

## 5. Legal / Compliance Checklist (юр vs физ; DSA Art. 30 front-and-center)

Priority: **P0** = launch blocker · **P1** = near-term required · **P2** = at scale / if payments added · **P3** = ongoing.
Reminder (Decision 1): everything below assumes the **contact-only** model. Adding **money flow ②** re-triggers the heavy regimes — see §5.5.

### 5.1 Trader transparency & the физ/юр distinction — Consumer law (applies NOW, payment-independent)
Belgian CEL / Omnibus (28 May 2022). Binds LyVoX *even as pure classifieds*.

| # | Pri | Who | Obligation |
|---|---|---|---|
| A1 | **P0** | юр+физ | Mandatory **"I sell as: private / business" self-declaration**; visible **Private/Professional badge on every listing and profile** (+ JSON-LD). This is the legal hinge for the 14-day right. |
| A2 | **P0** | юр | **Trader pre-contractual identity** (CEL VI.45/VI.83): legal name, geographic address, phone, email, KBO number, VAT where applicable, 14-day withdrawal terms — **published** on the professional profile/listing. |
| A3 | **P0** | физ | Private sellers owe no withdrawal right; platform must prevent a business **masquerading as private**. Concrete v1 (see §5.1.1) — a scored heuristic that **soft-blocks new private listings until re-classified or appealed**, not a silent flag. (#1 EU enforcement risk.) |
| A4 | **P1** | юр | **Omnibus price/ranking transparency:** prior-30-day lowest price on "reductions"; paid placements labelled "sponsored"; ranking parameters disclosed. |
| A5 | **P1** | both | Locale-aware notice "buying from a private seller = no 14-day return." |

#### 5.1.1 Trader-detection heuristic (A3) — a concrete v1, not a hand-wave
A3 is the highest-stated enforcement risk; it needs a buildable first ruleset, not a parenthetical. v1 (all tunable — strictness is a founder dial, §10.1 #3):

- **Signals (per private account, rolling windows):** active-listing count above a threshold (e.g. >X live); listing-creation frequency (e.g. >Y/30d); share of listings marked **new/unused/"in verpakking"**; multiple identical/near-identical SKUs; presence of a VAT/KBO-looking string or business name in free text; high-value-category concentration; same-IBAN/contact reuse across many listings (where known).
- **Scoring & action (graduated, with an appeal hook):** a weighted score crosses two bands → **(band 1, "looks like a trader")** prompt a non-blocking re-classification nudge; **(band 2, strong)** **soft-block new private listings** (existing ones stay) until the user either re-declares as business (→ §3.2 wizard) or appeals. This makes the action *prompt re-classification → soft block*, not silent shadow-handling.
- **Where the flag lives:** `profiles.flags->>'trader_review'` (the existing flags jsonb overlay — no new column), with the score + window snapshot in the flag payload for auditability.
- **Appeal hook:** a band-2 soft block is contestable through the **DSA Art. 20 appeals queue (§5.2.2)** — a human review either lifts the flag or confirms re-classification.
- **Defaults:** ship band thresholds conservative (favor prompting over blocking) and tune from false-positive rate; the strictness dial (§10.1 #3) sets where the bands sit.

### 5.2 DSA — trader traceability & platform baseline

**The Art. 30 applicability bet (explicit — flag for counsel; see §10.2 #5).** DSA Art. 30 effective **17 Feb 2024**. Whether Art. 30 *binds a pure contact-only board at all* is a **grey zone** (Freshfields: contracts concluded merely via chat are likely **out of scope unless the platform actively facilitates the transaction**, e.g. a formal on-platform checkout). **This document makes an explicit bet: Art. 30 does NOT bind LyVoX while it is contact-only (money flow ② absent).** Two consequences flow from making the bet explicit rather than hand-waving "build it anyway as cheap insurance":

1. **The Phase-A trader gate is grounded in CONSUMER LAW (§5.1/A2), not Art. 30.** The fields LyVoX captures and blocks listing on — legal name, address, phone, email, KBO, VAT, withdrawal terms — are independently mandatory under Belgian CEL/Omnibus *regardless of whether Art. 30 applies*. That is the solid legal ground; Art. 30 is treated as confirmatory, not load-bearing.
2. **The Art-30-ONLY artefacts (the ID-document copy (b) and payment-account details (c)) are NOT collected in Phase A.** They are not required by consumer law, they cannot be collected company-free (Stripe Identity needs a KBO; itsme needs a company), and collecting them with no legal obligation would breach GDPR data-minimization (§5.4/E2). They are deferred to the trigger event: **Art. 30 confirmed to bind OR money flow ② added.** This removes the earlier internal contradiction where B1 demanded (b) as a Phase-A gate that the §3.2 wizard never collects.

**Recommendation:** build trader-data capture + free verification + the public trader panel — driven by consumer law — and defer only the Art-30-only ID copy/payment fields. This is exactly the set that flips the day you add money flow ② or counsel confirms Art. 30 binds.

| # | Pri | Who | Obligation |
|---|---|---|---|
| B1 | **P1** | юр | **Art. 30(1) field set, but Phase-A gating is consumer-law-driven:** (a) name/address/phone/email; (b) ID copy / electronic identification — **NOT collected in Phase A** (no company-free path; no consumer-law obligation; collect only if Art. 30 confirmed OR money flow ② added); (c) payment-account details — **NOT collected in Phase A** (only relevant once you facilitate payment); (d) trade register + KBO number; (e) self-certification of legal compliance. **Block listing-as-business until (a)(d)(e)** — all company-free and all mirrored by the CEL/Omnibus duty A2. (Earlier drafts blocked on (b) too; corrected — the wizard cannot and must not collect an ID copy in Phase A.) |
| B2 | **P1** | юр | **Art. 30(2) — "best efforts" verify** via free official DB: **KBO/CBE Public Search** + **VIES**. Store verification timestamp + result. (No company of your own needed to query these.) Verification is **asynchronous with a manual fallback** — VIES is not a hard synchronous publish gate (see §5.2.1 + §3.2 step 4). |
| B3 | **P1** | юр | **Art. 30(3) — swiftly suspend** traders with inaccurate/unremedied info. This is expressed in the document's own two-axis + overlay model (Decision 2), **not** a linear status ladder: **"suspend trader" = set `businesses.status='suspended'`** (the suspension overlay), which **hides/withdraws that business's listings** via RLS (§6.7, §6.8). The trigger is a `verifications` row going `status='failed'`/`'expired'`, or a manual `flags->>'manual_review'`. The suspended trader is owed a statement of reasons (B6) and an appeal channel (§5.2.2). No `pending→verified→flagged→suspended` column exists — verification-row state, business-entity state, and the moderation overlay are three distinct things and were deliberately not merged (Decision 2). |
| B4 | **P2** | юр | **Art. 30(4)/32 — retention + right to information:** keep trader data for the relationship + a reasonable period; be able to answer authority/consumer queries. |
| B5 | **P1** | юр | **Art. 31 — compliance by design:** the listing form must let traders provide required pre-contractual + product-safety/economic-operator info. |
| B6 | **P1** | platform | **DSA all-platforms baseline (applies regardless of marketplace status):** "Report this listing" notice-and-action, **statement of reasons** on removals, single point of contact, T&Cs, repeat-abuser suspension, annual transparency report. (Wire the existing AI moderation to these duties.) |

VLOP duties (Art. 33+) apply only above **45M EU MAU** — **ignore for the foreseeable future.**

#### 5.2.1 Entity verification is asynchronous (VIES is NOT a hard synchronous publish gate)
VIES is notoriously unreliable: per-member-state outages, undocumented rate limits, no SLA, and frequent `MS_UNAVAILABLE`/"service unavailable" for specific countries. KBO additionally has no official free JSON API (§10.2 #4). Making "publish as business" depend on a synchronous VIES success would mean a VIES outage blocks **all** new business verification — unacceptable. The verification flow is therefore staged:

- **B0 (synchronous, instant):** format validation only (`validate_belgian_vat()` CHECK on `vat_number`; KBO regex). On success the business reaches `status='draft'` and a `verifications` row is written `method='vies'/'kbo'`, `status='pending'`.
- **Queued check (async, with retry/backoff):** a background job calls VIES + KBO. On clean match → `verifications.status='verified'`, `businesses.entity_verified=true`, `status='active'` (B1). On a definitive mismatch → `status='failed'` (blocks publish, routes to support). On `MS_UNAVAILABLE`/transient → retry with exponential backoff; the row stays `pending`.
- **Provisional publish (founder decision — §10.1):** either (a) allow a **"pending verification" provisional active** state for format-valid traders whose async check is merely *queued/unavailable* (not failed), with the public trader panel showing "verification pending"; OR (b) require an **admin manual-approve** fallback when VIES is down. Default recommendation: **(a) provisional publish on clean format + queued check**, demote to suspended only on a definitive `failed`. Cache VIES results; store the VIES consultation/request identifier as audit evidence in `verifications.evidence` either way.

#### 5.2.2 Appeals & redress (DSA Art. 20 / Art. 21) — the reciprocal of suspension
Every removal/suspension mechanism above is platform-acts-on-user (B3 suspend, B6 statement of reasons, C3 termination). The **reciprocal redress path is mandatory, not optional**, for a platform that suspends traders and removes listings:

| # | Pri | Who | Obligation |
|---|---|---|---|
| B7 | **P1** | platform | **DSA Art. 20 — internal complaint-handling system.** Any user whose listing was removed, whose account/business was suspended, or whose trader/private classification was changed can lodge a complaint and get a human re-review. Implemented as an **appeals queue** with an `appeal` state and an SLA, wired to the existing reports/moderation tables. A successful appeal **reinstates** (clears the overlay: `blocked_until`/`flags`/`businesses.status='active'`). |
| B8 | **P2** | platform | **DSA Art. 21 — out-of-court dispute settlement.** Point users to a certified out-of-court dispute-settlement body where applicable. Drafting/disclosure obligation; no on-platform build. |

Surfaced in the cabinet IA (§7.3: an "Appeals" view) and the rollout (A0, §9). The appeals queue reuses the moderation infrastructure — it is the inverse direction of the same pipe.

### 5.3 P2B Regulation (EU 2019/1150) — your relationship with BUSINESS sellers (payment-independent)
In force since 12 Jul 2020; mostly drafting.

| # | Pri | Who | Obligation |
|---|---|---|---|
| C1 | **P1** | юр | Plain T&Cs for business users; **≥15 days' notice** of T&C changes (email + in-cabinet banner). |
| C2 | **P1** | юр | **Ranking transparency** page (main parameters; paid-placement effect). |
| C3 | **P1** | юр | Suspension/termination with **statement of reasons**; **30 days' notice** for business-account termination. |
| C4 | **P2** | юр | Internal complaint-handling + name **two mediators** — *SME exemption* (<50 staff & <€10M turnover) likely applies initially (**unverified threshold — confirm with counsel**). |
| C5 | **P2** | юр | Differentiated-treatment / MFN / data-access disclosures in the Business Seller Terms. |

### 5.4 GDPR over the KYC/KYB data

**Lawful basis is PER FIELD, not blanket.** The earlier draft put Art. 6(1)(c) on *all* Art. 30 fields; that is wrong, because the Art-30-only fields (ID copy, payment account) carry no legal obligation under the §5.2 bet — and "cheap insurance" is not a lawful basis. The correct split:

| Field class | Lawful basis | Why |
|---|---|---|
| Consumer-law trader identity (legal name, address, phone, email, KBO, VAT, withdrawal terms — A2) | **Art. 6(1)(c)** legal obligation | Belgian CEL/Omnibus *mandates publication* of these regardless of DSA — a real legal obligation that binds now. |
| Anti-fraud signals (phone line-type, device/IP fingerprint, trader-detection, velocity) | **Art. 6(1)(f)** legitimate interest | Necessary for platform safety; LIA + opt-out where required. |
| ID-document copy (Art. 30(1)(b)), payment-account details (Art. 30(1)(c)) | **NOT COLLECTED in Phase A.** If ever collected: **6(1)(c) only if Art. 30 is confirmed to bind** (or money flow ② makes it mandatory); **otherwise explicit consent (6(1)(a)) only.** | No standing legal obligation under the §5.2 bet → no 6(1)(c); minimization (E2) forbids speculative collection. |

| # | Pri | Obligation |
|---|---|---|
| E1 | **P0** | Apply the **per-field lawful-basis table above** and record it in a ROPA. Do **not** assert 6(1)(c) over the whole Art. 30 set. |
| E2 | **P0** | **Data minimization (Art. 5(1)(c)/25):** prefer **verify-and-discard** over store-the-scan; store a pass/fail + extracted minimal fields, not raw ID images (or encrypted + short retention). This is also *why* (b)/(c) are not collected speculatively in Phase A. |
| E3 | **P1** | **Purpose limitation:** KYC/anti-fraud data must not feed marketing without separate consent → physical table separation (`kyc_records`, RLS-locked, never joined to analytics views). |
| E4 | **P1** | **Retention per data-class:** DSA/consumer-law trader copy = relationship end + ~6 months; DAC7 tax data (if ever) = +5 years. Automated Supabase-cron purge keyed on `retention_until` **AND** orphan-cleanup (purge rows whose subject no longer exists — §6.4/§6.5). (No AML 5-year rule unless you become an obliged entity.) |
| E5 | **P1** | **Right to erasure + account deletion — full flow in §5.4.1.** Plus transparency + data-subject access/portability over profile/KYC/phone/chat; encryption at rest for ID/IBAN. |
| E6 | **P2** | **DPIA** before turning on eID/itsme (T3) or any large-scale ID-doc storage. |

#### 5.4.1 Account deletion & right to erasure (Art. 17) — resolving erasure-vs-retention
The founder's ask names account deletion explicitly. Erasure and the legal-retention clocks (E4, B4) conflict, and the schema must not block the right it promises. The resolution:

- **Two-stage model.** User-initiated delete performs **soft-anonymization first** (profile PII nulled/replaced with a tombstone, handle released, listings withdrawn), then **hard purge** of all non-mandatory PII. Data under a **legal-obligation retention clock survives** anonymization until its `retention_until` (the consumer-law/DSA trader copy in `kyc_records`); everything else (avatar, free-text, optional fields, chat content per its own policy, anti-fraud signals once no longer needed) is purged immediately. State this conflict-resolution rule explicitly: **legal-obligation data outlives erasure; all other PII is purged on request.**
- **Schema must not hard-block deletion.** `businesses.created_by` must **not** be `ON DELETE RESTRICT` (that would make deleting any creator's `auth.users` row fail at the DB and break the very right E5 promises). Use **ownership transfer / anonymize-on-erasure**: on user deletion, either transfer `created_by`/owner-role to another `business_members` owner, or, if the creator is the sole owner, anonymize the business creator reference (set `created_by` to a system/anonymized sentinel and mark the business `status='suspended'` pending takeover) so a business is **never left ownerless-and-unmanageable**. `created_by` is therefore `ON DELETE SET NULL` paired with this transfer procedure (see §6.2). `business_members` rows `ON DELETE CASCADE` (correct). Trader listings are withdrawn, **never silently relabeled private** (see §6.1 — `business_id` is `ON DELETE RESTRICT`/soft-delete, not `SET NULL`).
- **Interaction with the seller_type spine.** Deleting an individual is the simple path. Deleting a business owner triggers the transfer/anonymize procedure above before the `auth.users` row can go. The DSA/consumer trader copy in `kyc_records` is retained to `retention_until` then purged by the E4 cron, independently of the human's deletion.

### 5.5 VAT / DAC7 — DORMANT until money flow ②
| # | Pri | Obligation |
|---|---|---|
| D1 | **P0 (decision/memo)** | Document **why LyVoX is NOT a DAC7 "platform operator"** (no transaction facilitation, deal value unknown), alongside the **§5.2 Art. 30 applicability bet**. Backlog rule: *any* payment/escrow/checkout/shipping/transaction-value feature forces re-assessment of D1–D3 **and triggers collecting B1(b) ID copy + (c) payment account**. |
| D2 | **P2 → P0 if money flow ② added** | **DAC7 annual report** to FOD Financiën/SPF Finances by **31 January**. De-minimis: goods sellers <30 sales **and** <€2,000/yr excluded; no threshold for services/rentals. *Capture* fields now (schema overlaps B/A); *reporting* later. |
| D3 | **P2 → P0 if money flow ② added** | **VAT deemed-supplier** only if facilitating supplies of imported goods ≤€150; **ViDA (from 1 Jul 2028)** abolishes the €150 ceiling and broadens marketplace liability — roadmap watch item. |
| D4 | **P1** | юр sellers must show **their own** VAT number on B2C offers — already captured/rendered by A2. |

### 5.6 Cross-cutting governance
| # | Pri | Obligation |
|---|---|---|
| F1 | **P1** | **5-locale parity** for all legal text (T&Cs, privacy, withdrawal, trader/private notices); Belgium expects FR+NL. Use the existing i18n parity guard test. |
| F2 | **P1** | Single point of contact + abuse reporting (DSA Art. 11–12); published complaints route (overlaps B6). |
| F3 | **P3** | Re-assessment discipline: any money-flow-② feature re-runs D1–D3 + B1(c). |

### 5.7 The founder's split — almost the entire mandatory surface is buildable now
| Buildable NOW (no company) | Needs company/contract (LATER) |
|---|---|
| A1–A5 declaration/badges/price+ranking transparency | Anything making LyVoX a **deemed supplier** (money flow ②) → VAT/IOSS/BTW |
| B1 **(a)(d)(e) only**, B2–B3, B5–B7 trader capture + **free KBO/CBE + VIES** + compliance-by-design + report/SoR + **Art. 20 appeals** | **B1(b) ID copy + (c) payment account** (no company-free path; deferred per §5.2 bet) |
| C1–C5 P2B drafting | DAC7 *reporting* onboarding (only if money flow ② added) · Twilio **WhatsApp OTP** (T2 — Meta Business) |
| E1–E5 GDPR ROPA/per-field-basis/minimization/retention/erasure | **itsme / Belgian eID** (T3 — contract) |
| F1–F3 i18n legal text, contact point, re-assessment rule | Paid **KYC/AML vendor** with full ID-doc storage (+ likely DPIA) |

**Explicitly drop:** UBO-register integration — since CJEU 22 Nov 2022 it is no longer public; a marketplace lacks the "legitimate interest" for access. Not needed unless LyVoX becomes AML-obliged.

---

## 6. Data Model — Supabase tables, RLS, trust derivation (two axes + overlay), capability matrix

This is a **delta** on the live schema; inline DDL is an illustrative sketch, **not** a migration to ship. Every fixed point is respected (`profiles.id=auth.users.id`, `adverts.user_id→auth.users.id`, helpers `is_admin()`/`is_user_blocked()`/`set_updated_at()`/`validate_belgian_vat()`).

### 6.1 New columns on existing tables
```
profiles  + seller_type text NOT NULL DEFAULT 'individual'   -- 'individual' | 'business'
adverts   + business_id uuid NULL REFERENCES businesses(id) ON DELETE RESTRICT
          -- NULL = sold privately by user_id; set = on behalf of a business
          -- RESTRICT (NOT SET NULL): a trader listing must NEVER silently become a private listing.
```
`adverts.user_id` stays the posting human (audit + every existing RLS anchor); `business_id` is the new "on behalf of" axis.

**Why `ON DELETE RESTRICT`, not `SET NULL` (compliance, not nicety).** `SET NULL` would mean deleting/suspending a business silently converts its listings to `business_id=NULL` — which §2.1 defines as *"sold privately by the human."* A trader's live offers would lose their consumer-law trader panel (§8.3), the Omnibus "Professional" badge, and the withdrawal-right notice, and silently present as private-seller listings — a consumer-law regression and the exact opposite of B3's intent to *suspend/hide* a bad trader's listings. Instead: **soft-delete/suspend the business** (`businesses.status='suspended'`/`'closed'`) and **withdraw** its adverts (introduce an advert status `'withdrawn'` for suspended-business listings) rather than nulling them. Hard-deleting a business with live listings is **blocked** by RESTRICT until the listings are withdrawn or reassigned.

### 6.2 `businesses` — the legal entity (юр)
```sql
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  legal_form text,                                  -- 'bv','nv','comm.v','sole_trader',...
  kbo_number text unique,                           -- KBO/CBE 10 digits (== VAT base)
  vat_number text unique,                           -- 'BE0XXXXXXXXX'; NULL if not VAT-liable
  vat_liable boolean not null default false,
  email text not null, phone_e164 text,             -- DSA trader contact
  address_line text, postcode text, city text, country text default 'BE',
  status text not null default 'draft'
    check (status in ('draft','active','suspended')),
  entity_verified boolean not null default false,   -- flips TRUE after KBO/VIES (Phase A)
  created_by uuid references auth.users(id) on delete set null,  -- SET NULL (not RESTRICT): erasure must not be DB-blocked (§5.4.1); paired w/ ownership-transfer
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint businesses_vat_format
    check (vat_number is null or validate_belgian_vat(vat_number)),   -- reuse shipped validator
  constraint businesses_kbo_format
    -- store KBO normalized to 10 digits (strip dots/spaces in app/RPC); see normalization note below
    check (kbo_number is null or kbo_number ~ '^[01][0-9]{9}$')
);
alter table public.businesses enable row level security;   -- REQUIRED: raw-SQL tables ship RLS OFF in Supabase
create trigger set_updated_at_businesses before update on public.businesses
  for each row execute function public.set_updated_at();
```
**`created_by` is `ON DELETE SET NULL`, not `RESTRICT`** (corrected): RESTRICT would make deleting a creator's `auth.users` row fail at the DB and break the §5.4.1 right to erasure. On creator deletion, the §5.4.1 ownership-transfer/anonymize procedure runs *first* (hand the business to another owner, or suspend + sentinel the creator ref) so a business is never left ownerless. The `create_business()` RPC (§6.8) sets `created_by` on insert; the erasure path nulls it only after transfer — the two do not collide.

**KBO/VAT format consistency (caveat — §6 is a sketch).** `businesses_vat_format` reuses `validate_belgian_vat()` (lenient — strips an optional `BE` prefix and all non-digits, so `'BE0123.456.749'` passes), but `businesses_kbo_format` is strict (`^[01][0-9]{9}$` — rejects dots/spaces). The same human-entered number would pass as VAT but be rejected as KBO. **Normalize KBO to 10 bare digits before storing** (strip dots/spaces in the app or the `create_business()` RPC), or relax the regex to tolerate separators. Optionally add a CHECK that, when both are set, the 10 KBO digits equal the VAT base digits (the comment claims `KBO == VAT base` but nothing enforces it).

### 6.3 `business_members` — team & roles
```sql
create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,                          -- NULL = pending invite
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
alter table public.business_members enable row level security;   -- REQUIRED (RLS OFF by default)
```

### 6.4 `verifications` — polymorphic verification table (replaces a status enum; single-row-per-method)
```sql
create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user','business')),
  subject_id uuid not null,                          -- profiles.id OR businesses.id
  method text not null check (method in ('email','phone','itsme','eid','kbo','vies','manual')),
  status text not null default 'pending'
    check (status in ('pending','verified','failed','expired','revoked')),
  evidence jsonb,                                    -- NON-sensitive proof only
                                                     -- (twilio line-type, VIES consultation id, itsme KYC level)
  verified_at timestamptz, expires_at timestamptz,   -- itsme TTL; DAC7 re-verify-every-3y if ever
  created_at timestamptz not null default now()
);
alter table public.verifications enable row level security;   -- REQUIRED (RLS OFF by default)
-- single-row-per-method intent (NOT an append-only ledger — see note): one live row per (subject,method)
create unique index uq_ver_active on public.verifications(subject_type, subject_id, method)
  where status in ('pending','verified');
```
`status='verified'` rows are the **single source of truth** for trust level; `verified_email`/`verified_phone`/`itsme_verified`/`entity_verified` are **denormalized read-caches** (so shipped queries like `search_adverts`'s `verified_email AND verified_phone` keep working untouched).

**The caches are kept in sync by a TRIGGER, not by convention** (corrected). Relying on "the same write updates both" is unenforced — a revoked verification with a stale boolean would leave a revoked seller still showing as verified in `search_adverts`. Add an `AFTER INSERT/UPDATE/DELETE` trigger on `verifications` that recomputes the corresponding boolean cache on `profiles`/`businesses` from the latest `status` for that `(subject, method)`. Add a reconciliation test asserting **no** row where a boolean cache disagrees with the latest `verifications` status.

**"Ledger" vs the unique index — pick one framing (caveat).** `uq_ver_active` permits only one `pending`-or-`verified` row per `(subject, method)`, so re-verification (itsme TTL, DAC7 re-verify) cannot insert a *new* pending row while a verified row exists — it must mutate the existing row, losing history. This is **single-row-per-method**, not a true append-only ledger. The narrative here uses "single source of truth," not "immutable ledger," to match the constraint. If a real history ledger is later wanted, scope the unique predicate to `status='verified'` only (or drop `pending`) and allow stacked historical rows.

### 6.5 `kyc_records` — sensitive, GDPR-isolated (the reason for a separate table: `profiles` is world-readable)
```sql
create table public.kyc_records (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user','business')),
  subject_id uuid not null,
  data_class text not null check (data_class in
    ('dsa_trader_copy','id_document','eid_attributes','aml_screen')),
  document_ref text,                                 -- private-bucket path (signed-URL only), NOT inline
  meta jsonb,                                        -- doc type, issuer, last4 — never a full PII echo
  legal_basis text,                                  -- 'consumer_law' | 'dsa_art30' | 'dac7' | 'consent'
  retention_until timestamptz not null,              -- per-class clock; a cron purges past this
  created_at timestamptz not null default now()
);
alter table public.kyc_records enable row level security;   -- CRITICAL: without this, the world-readable default makes the most sensitive table public — the opposite of its entire purpose
```
**Polymorphic `subject_id` has NO referential integrity — handle cleanup explicitly (applies to `verifications`, `kyc_records`, `badges_awarded`).** `subject_id` is a bare uuid pointing at *either* `profiles.id` *or* `businesses.id`; a column cannot FK to two tables, so there is no cascade. Deleting a business leaves **orphaned** verifications, kyc_records, and badges_awarded rows. Orphaned `kyc_records` is also a GDPR problem (data persists with no owner, evading the E4 purge that keys on `retention_until` but not subject existence). Two acceptable fixes:
- **(preferred) per-subject FKs:** replace `subject_type/subject_id` with nullable `user_id references auth.users(id) on delete cascade` + nullable `business_id references businesses(id) on delete cascade` + a CHECK that **exactly one** is set. This gives native cascades and real integrity. (The §6 sketch keeps the polymorphic shape for brevity; production should adopt this.)
- **(minimum)** `ON DELETE` cleanup triggers that delete dependent polymorphic rows when a profile/business is removed, **and** the E4 purge cron must additionally delete rows whose subject no longer exists.

### 6.6 `badges_awarded` — only non-derivable manual badges
```sql
create table public.badges_awarded (
  subject_type text not null check (subject_type in ('user','business')),
  subject_id uuid not null,
  badge text not null,                               -- 'trusted_partner','charity','staff_pick',...
  awarded_by uuid references auth.users(id),
  awarded_at timestamptz not null default now(),
  primary key (subject_type, subject_id, badge)
);
alter table public.badges_awarded enable row level security;   -- REQUIRED (RLS OFF by default); public-read policy is then deliberate, not accidental
```
Everything else (Phone-verified, ID-verified, Verified Business, VAT-registered, Top Seller) is **derived at read time** — no award engine.

### 6.7 Trust derivation → capability matrix (TWO independent axes + an overlay — per Decision 2)

Per Decision 2 this is **not** one linear status machine. There are three orthogonal things, each on its own column(s):
- **Verification-row lifecycle** (`verifications.status`): `pending → verified / failed / expired / revoked`. This drives the per-method facts below.
- **Business-entity lifecycle** (`businesses.status`): `draft → active → suspended`.
- **Suspension overlay** (moderation): `profiles.blocked_until`, `profiles.flags->>'manual_review'`, `businesses.status='suspended'` — orthogonal to both axes; any overlay disables publish/contact and hides listings regardless of level.

The two capability axes (физ level, юр level) are derived from `verifications`; the overlay is applied on top. No DSA action ("suspend trader") maps to a single ladder rung — it sets `businesses.status='suspended'` (overlay), which §6.8 RLS then uses to hide that business's listings.

**Human (физ) axis**
| Level | Backing fact | Capabilities |
|---|---|---|
| L0 anon | no session | browse / search |
| L1 auth | `auth.users` row | + like, save searches, favorites |
| L2 email | `verified_email` | + start drafts |
| L3 phone | `verified_phone` (Twilio Lookup BE mobile) | **+ contact seller, + publish individual advert** *(current prod gate)* |
| L4 ID | `itsme_verified`/eID (or Stripe Identity) | + high-trust badge; leg for sell-as-business; higher limits / high-value categories |

**Business (юр) axis**
| Level | Backing fact | Capabilities |
|---|---|---|
| B0 declared | `businesses` row, VAT **format**-valid only | create entity, **draft** business listings (buildable now, no company) |
| B1 entity-verified | `entity_verified=true` via VIES/KBO (`verifications.method ∈ {vies,kbo}`) | **publish & sell as business**; pro badge; DSA trader info public |

**Suspension overlay (any level):** `blocked` (`is_user_blocked()`) → publish/contact off; `flagged` → moderation queue; `business suspended` → that business's listings withdrawn.

**Sell-as-business = `human ≥ L3` AND `business ≥ B1`.**

### 6.8 RLS (the recursion footgun, the bootstrap, the role ladder, the KYC lockdown)

**Prerequisite: RLS is ENABLED on all five new tables** (`alter table … enable row level security;` — shown per-table in §6.2–6.6). Raw-SQL tables ship with RLS **OFF** in Supabase and retain default anon/authenticated grants; without enabling, every policy below is **dormant** and `kyc_records` is world-readable — the exact opposite of its purpose. A test must assert RLS is `enabled` on each new table, and a logged-out query must return **zero** rows from `verifications` and `kyc_records`.

**The membership helper — `SECURITY DEFINER` (avoids RLS recursion) + hardened `search_path`:**
```sql
create or replace function public.is_business_member(b_id uuid, min_role text default 'member')
returns boolean language sql security definer stable
set search_path = pg_catalog, public as $$        -- hardening: pin search_path on a DEFINER fn
  select exists (
    select 1 from public.business_members m
    where m.business_id = b_id and m.user_id = auth.uid() and m.accepted_at is not null
      and case m.role when 'owner' then 3 when 'admin' then 2 else 1 end
        >= case min_role when 'owner' then 3 when 'admin' then 2 else 1 end);
$$;
```
*(Retrofit the same `set search_path` onto the existing `is_user_blocked()` DEFINER fn — pre-existing repo idiom, fixed here once.)*

**Bootstrap: create the business + its first owner-member ATOMICALLY via a `SECURITY DEFINER` RPC.** This solves the chicken-and-egg: a plain `biz_create` insert that writes no `business_members` row leaves `is_business_member()` false, so the creator could neither update the draft nor add themselves — and no `business_members` INSERT policy can authorize the *first* owner row. The RPC sidesteps RLS for exactly this two-row transaction (the local pattern; mirrors how chat seeds `conversation_participants`):
```sql
create or replace function public.create_business(p_legal_name text, p_kbo text, ...)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_id uuid;
begin
  insert into public.businesses (legal_name, kbo_number, created_by, status)
    values (p_legal_name, public.normalize_kbo(p_kbo), auth.uid(), 'draft')
    returning id into v_id;
  insert into public.business_members (business_id, user_id, role, accepted_at)
    values (v_id, auth.uid(), 'owner', now());
  return v_id;
end; $$;
```
```sql
-- BUSINESSES ------------------------------------------------------------------
create policy biz_public_read on public.businesses for select using (status = 'active');
create policy biz_member_read on public.businesses for select to authenticated using (is_business_member(id));
-- draft self-edit before any membership matures uses created_by; mature edits use owner role
create policy biz_owner_write on public.businesses for update to authenticated
  using (is_business_member(id,'owner') or created_by = auth.uid())
  with check (is_business_member(id,'owner') or created_by = auth.uid());
-- direct insert is NOT exposed; use create_business() RPC. (Keep an admin insert for support.)
create policy biz_admin_all on public.businesses for all using (is_admin()) with check (is_admin());

-- BUSINESS_MEMBERS (the member-facing policies that were missing) ---------------
create policy bm_self_read on public.business_members for select to authenticated
  using (user_id = auth.uid() or is_business_member(business_id,'member'));   -- see your own + your team
create policy bm_invitee_accept on public.business_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = (select role from public.business_members b
            where b.business_id = business_members.business_id and b.user_id = auth.uid()));
            -- invitee may set accepted_at but MAY NOT change their own role (anti-escalation)
create policy bm_admin_manage on public.business_members for insert to authenticated
  with check (is_business_member(business_id,'admin') and role <> 'owner');     -- admins add admin/member, never owner
create policy bm_admin_remove on public.business_members for delete to authenticated
  using (is_business_member(business_id,'admin') and role <> 'owner');          -- never remove an owner via this path
create policy bm_admin_all on public.business_members for all using (is_admin()) with check (is_admin());

-- ADVERTS: KEEP current owner=user_id policies; ADD the business-team path, VERB-SPLIT by role ----
-- member+ may read/insert/update business listings; DELETE is admin-gated (§2.3 role ladder)
create policy adv_team_read   on public.adverts for select to authenticated
  using (business_id is not null and is_business_member(business_id,'member'));
create policy adv_team_insert on public.adverts for insert to authenticated
  with check (business_id is not null and is_business_member(business_id,'member') and user_id = auth.uid());
create policy adv_team_update on public.adverts for update to authenticated
  using (business_id is not null and is_business_member(business_id,'member'))
  with check (business_id is not null and is_business_member(business_id,'member'));
create policy adv_team_delete on public.adverts for delete to authenticated
  using (business_id is not null and is_business_member(business_id,'admin'));   -- DELETE = admin, not member
-- NOTE: the prior single `for all … with check (business_id is null or …)` is REMOVED — that null branch
-- let ANY authenticated user write any null-business row. Private (null-business) writes stay on the
-- existing owner-only policy keyed on user_id = auth.uid(); the team policies above never touch null-business rows.

-- VERIFICATIONS: owner-of-subject + admin only; NEVER public --------------------
create policy ver_owner_read on public.verifications for select to authenticated using (
  (subject_type='user' and subject_id = auth.uid())
  or (subject_type='business' and is_business_member(subject_id,'admin')));
create policy ver_admin_all on public.verifications for all using (is_admin()) with check (is_admin());

-- KYC_RECORDS: STRICTEST. owner/owner-role + platform admin; writes service-role only; no public/anon ---
create policy kyc_owner_read on public.kyc_records for select to authenticated using (
  (subject_type='user' and subject_id = auth.uid())
  or (subject_type='business' and is_business_member(subject_id,'owner')));
create policy kyc_admin_all on public.kyc_records for all using (is_admin()) with check (is_admin());

-- BADGES_AWARDED: world-readable trust signal, admin-write (RLS still enabled — public read is deliberate) ---
create policy badge_public_read on public.badges_awarded for select using (true);
create policy badge_admin_write on public.badges_awarded for all using (is_admin()) with check (is_admin());
```
**Role-ladder note:** `is_business_member(b_id, min_role)` returns true for any role *at or above* `min_role`, so enforcement lives entirely in *which* `min_role` each verb passes. The split above realizes §2.3: member = read/insert/update listings; **delete = admin**; owner-only = billing/delete-business/owner management. Tests must assert a *member cannot delete another member's business listing* and *an invitee cannot escalate their own role to owner*.

**GDPR summary:** sensitive KYC is physically separated, **RLS-enabled**, owner+admin-locked, stored as storage-refs (not inline PII), purged on a per-class clock + orphan sweep; `verifications.evidence` holds only non-sensitive proof, so the ledger is not a KYC store.

### 6.9 Migration order (each table: `enable row level security` in the SAME migration as its DDL)
1. `businesses` + `business_members` (RLS enabled) + `is_business_member()` (`set search_path`) + `create_business()` RPC + `normalize_kbo()`.
2. `adverts.business_id` (`ON DELETE RESTRICT`) + advert `'withdrawn'` status + verb-split team RLS; `profiles.seller_type`.
3. `verifications` (RLS enabled) + booleans-sync trigger; backfill from existing booleans (keep booleans as caches).
4. `kyc_records` (RLS enabled; private bucket + retention purge **+ orphan-sweep** cron).
5. `badges_awarded` (RLS enabled) + derived-badge views.
6. Erasure procedure (§5.4.1: ownership-transfer/anonymize-on-erasure) + appeals/trader-review wiring on the existing reports tables.

---

## 7. Personal Dashboards / Cabinets — feature map & IA per type

Recommendation: **business cabinet = individual cabinet + conditionally-rendered pro sections** under a `/pro` namespace, gated by `seller_type='business'`, with a persistent "Personal ⇄ Business view" switch — **not** a separate login.

Legend: ✅ MVP · 🔶 later (software, no company) · 🔒 later, money-flow-② / company-gated · ⚖️ legally mandatory once business accounts exist.

### 7.1 Individual (физ) cabinet — extends the live `/profile`
My listings (active/draft/archived) ✅ · Drafts ✅ · Favorites + saved searches ✅ · Messages/chat ✅ · Basic stats (views/likes/favorites) ✅ · Verification status (email/phone/trust score) ✅ · Settings (profile/security) ✅ · **Notification preference toggles** 🔶 (currently hardcoded) · Buy boosts ✅ (live Stripe) · Receipts/purchase history ✅ (`/profile/billing`) · Mark-as-sold 🔶 (also the eligibility gate for Phase-B reviews — §8.5) · Reviews received 🔒 (Phase B — §8.5; hidden until then) · **Appeals status** 🔶 (§5.2.2).

### 7.2 Business (юр) cabinet — all of the above PLUS
| Feature | Status | Note |
|---|---|---|
| **Trader badge + KBO/BTW on listings & profile** | ⚖️✅ | Legally required the instant business accounts exist (Omnibus). Buildable now. |
| **DAC7 identity capture** (legal name, KBO, VAT, address, TIN) | ⚖️✅ | Platform must *collect/verify* seller ID; *reporting* is later (money flow ②). |
| Storefront / shop page (logo, banner, description, hours, link-out, grouped listings) | 🔶 | The defining pro feature (leboncoin E-Vitrine, Marktplaats verkoperspagina). |
| Analytics (impressions/clicks/CTR/response rate/trend) | 🔶 | Marktplaats Pro's core value. |
| Lead / response management (inbox triage, response-time, saved replies, status) | 🔶 | Reuses existing chat. |
| Bulk / CSV listing management (→ feed/API import later) | 🔶 | Software only. |
| **Pro subscription & plan billing** | 🔶 **(rail exists)** | **Money flow ① — NOT company-gated.** Reuse live Stripe, `mode:"subscription"`. |
| Seller-issued **VAT invoices to buyers** (sequential no., KBO+BTW) | 🔶 | *Seller*-as-company gated, **not** LyVoX-gated — seller supplies their own KBO/BTW. |
| Team members & roles (owner/admin/member) | 🔶 | `business_members` + RLS (§6.3/6.8). |
| Account-level promoted/sponsored listings | 🔶 | Extends existing Stripe billing. |
| Order management (brokered) | 🔒 | Only if LyVoX sits in the payment flow (money flow ②). Off-platform sale → just sold-tracking = 🔶. |
| **Payout / IBAN settlement** | 🔒 | **The genuine LyVoX-company gate** (entity + PSP, e.g. Stripe/Mollie Connect). |
| **LyVoX-issued VAT invoices to sellers** (for the subscription fee) | 🔒 | Needs LyVoX VAT registration; Stripe receipts bridge. BE Peppol B2B e-invoicing mandatory **1 Jan 2026** once LyVoX invoices BE businesses. |
| itsme/eID business verification (T3) | 🔒 | Identity-provider contract. |
| WhatsApp-required OTP (T2) | 🔒 | Meta Business / registered company. |

### 7.3 Information architecture
**Individual `/profile`** (keep current tabbed shell): Dashboard · My listings · Favorites · Messages · Reviews (Phase B — §8.5) · **Appeals** (status of any contested removal/suspension/re-classification → DSA Art. 20, §5.2.2) · Settings (Profile / Security / Notifications / Billing & purchases → **"Upgrade to a professional account" CTA**).

**Business `/pro`** (gated by `seller_type='business'`): Dashboard (KPI tiles) · Listings (+ Bulk CSV 🔶, Feed/API 🔶) · Storefront 🔶/⚖️ · Leads/Inbox 🔶 · Orders (sold-tracking 🔶 → brokered 🔒) · Invoices 🔶 · Insights 🔶 · Plan & Billing 🔶 (rail exists) · Payouts 🔒 · Team & Roles 🔶 · **Appeals** (Art. 20, incl. trader-suspension/re-classification) ⚖️ · Business profile/Settings (company identity + DAC7 ⚖️; verification T1 now/T2-3 later; trader declaration ⚖️).

**Admin moderation** (existing): add the **Appeals queue** (the inverse of reports — re-review removals/suspensions, lift overlays on success) and the **trader-review queue** (§5.1.1 band-2 soft-blocks).

### 7.4 Pro plan tiering (competitor pattern; euro pricing **unverified**)
Quota-based monthly **subscription** (leboncoin dropped credits for subscription+deposit-volume in 2025): **Free/Basic** (identity + trader badge + small quota + basic page) → **Standard/Premium** (large quota, storefront, analytics, bulk, top visibility, invoices) → **Custom/Enterprise** (support, CPC/sponsored, API/feed, multi-seat).

---

## 8. Public Profile Cards & Badge Taxonomy (incl. the DSA trader panel)

New public route to build: **`/seller/[handle]`** (handle = opaque slug, **never** the user UUID). No public seller route exists today.

### 8.1 DSA legal baseline for public display
Art. 30(7) requires making **publicly available, on the listing interface**: trader **name, address, phone, email; trade-register details; self-certification statement**. ID copy + payment-account details from Art. 30(1) are **stored, never published**. Privacy minimization therefore applies to **физ only** — traders cannot hide legal name/address. "Best efforts" verification is met **free** via KBO/CBE + VIES (no company needed).

### 8.2 Физ (private) card
- **Shown:** display name/handle (never legal full name unless opted in), avatar, **"Private seller"** chip (neutral), member-since, badges, aggregate rating (when reviews exist), **approx location (city/region only)**, active listings, "Contact/Chat" CTA (already gated behind verified-phone).
- **Hidden / minimized:** legal name, exact address, phone, email — **never rendered as plain text** (redact at the server boundary, not in the child render — RSC prop-serialization leaks otherwise). "Last seen" coarse-bucketed. No VAT panel.

### 8.3 Юр (business) card — everything above + the mandatory trader panel
**"Business / Professional seller"** chip (branded), storefront layout (logo/banner/description). **Trader Information panel (DSA Art. 30(7) — always visible, on profile AND every listing):**

| Field | Source |
|---|---|
| Legal/trading name | `businesses.legal_name` (KBO-matched) |
| Registered address | `businesses.address_*` (full — no minimization for traders) |
| Enterprise number (KBO/CBE) | `businesses.kbo_number` |
| VAT number | `businesses.vat_number` (VIES-validated) |
| Contact email + phone | `businesses.email`/`phone_e164` |
| Legal-compliance self-certification | `verifications`/declaration timestamp |

Stored-not-published (only *if/when* collected — not in Phase A per §5.2): the Art. 30(1)(b) ID-doc copy + (c) payment-account details would live in `kyc_records`, never on the public card. Director's private data not exposed.

### 8.4 Badge taxonomy (each badge = one verifiable signal; earned, never self-asserted; rolling windows for performance; max ~3 shown)
| Badge | Applies | Signal | Earn condition | Status |
|---|---|---|---|---|
| **Phone-verified** | both | `verified_phone` (Twilio Lookup BE mobile) | T1 OTP | **[NOW] deployed** |
| Email-verified | both | `verified_email` | email confirm | [NOW] (low weight, often hidden) |
| **Verified Business** | юр | `businesses.entity_verified` (KBO match) | KBO/CBE lookup | **[NOW] no company** |
| **VAT-registered** | юр | VIES-validated `vat_number` | VIES success | **[NOW] no company** |
| **ID-verified** | физ (+ юр director) | `verifications.method ∈ {itsme,eid}` (or Stripe Identity) | eID/itsme/IDV pass | **[LATER]** (T3); Stripe Identity = Branch A |
| Established Seller | both | `created_at` + activity | age ≥12mo + active listings | [NOW] (cheap) |
| Top Seller | both | rating + volume, rolling 90d | ≥X deals AND avg ≥4.5★ | after reviews/tx |
| Highly Rated | both | reviews, rolling 90d | ≥4.5★ from ≥N | after reviews |
| Fast Replier | both | chat first-response median, rolling 30d | median < N min | after chat metrics |

**Display precedence (top 3):** (1) ID-verified / Verified Business · (2) VAT-registered (юр) / Phone-verified (физ) · (3) best of {Highly Rated, Top Seller, Fast Replier}. Identity/business badges use the existing `lyvox-trust-gradient`; performance badges use a neutral style (so they don't imply platform-verified identity).

### 8.5 Reviews & ratings — scoped OUT of Phase A; designed for Phase B
Three badges (Top Seller, Highly Rated, Fast Replier — except Fast Replier, which derives from chat metrics, not reviews) and the cards' "aggregate rating" depend on a reviews system that **does not exist in Phase A**. To keep the document coherent:

- **Phase A: no rating signal is promised.** Cards render aggregate rating **only when reviews exist** (§8.2/§8.3 already say "when reviews exist") — in Phase A that block is simply absent; the cabinet's "Reviews received" (§7.1) is hidden until Phase B. No card promises a star rating that has no backing data.
- **Phase B reviews model (sketch, not a Phase-A build):** a `reviews(id, reviewer_user_id, subject_type, subject_id, rating, body, source, created_at)` table; **aggregate rating** = a derived/materialized average over moderated rows (mirrors the derived-badge pattern — no award engine).
- **The genuinely hard part — eligibility on a contact-only board.** Because transactions happen **off-platform and are unverifiable**, "verified-purchase" reviews are impossible here. Phase-B options (a founder decision): (i) **interaction-gated** — only a buyer who actually opened a chat thread with the seller may review (cheap, weak, gameable); (ii) **mark-as-sold-gated** — seller marks a listing sold to a specific contacted buyer, who is then invited to review (better signal, requires the sold-tracking feature); (iii) defer reviews until money flow ② gives real transactions. Recommendation: **(ii)** as the Phase-B default. Anti-fake controls: one review per (reviewer, subject, listing), reviewer must be ≥L3 phone-verified, rate-limit, AI-moderation + report-review flow reusing the existing moderation pipe. **A full anti-fake-review system is out of scope for this design** — flagged as a Phase-B work item, not solved here.

---

## 9. Phased Rollout (one timeline; mapped to existing code)

The boundary is set by Decisions 1 & 2: **Phase A** = company-free, contact-only, money flow ① only; **Phase B** = post-incorporation / money flow ②.

### Phase A — NOW, no company (contact-only, money flow ① only)
Phase A is **split into A0 (legal-blocker MVP — must ship before business accounts go live) and A1 (growth — software-only, sequenced after A0)**, with explicit dependencies. P0/P1 priorities from §5 carry through.

#### A0 — Legal-blocker MVP (the must-ship set; nothing business-facing goes live without it)
*Dependency spine: data model → wizard+verification → compliance surfaces. Each depends on the one before.*
1. **Data model core (blocks everything):** `profiles.seller_type`; `businesses` + `business_members` + `create_business()` RPC + `is_business_member()` (RLS **enabled** on all new tables); `adverts.business_id` (`ON DELETE RESTRICT`) + verb-split team RLS + advert `'withdrawn'` status; `verifications` ledger + booleans-sync trigger (backfill from booleans); `kyc_records` (RLS-enabled private bucket + purge/orphan cron); `badges_awarded`.
2. **Trader onboarding (depends on 1):** "Upgrade to professional" wizard (§3.2) capturing the **consumer-law A2 fields** (legal name/address/phone/email/KBO/VAT/withdrawal terms — **no ID copy**); **async** VIES + KBO/CBE verification (§5.2.1) → Verified Business / VAT-registered badges; soft representation check; trader self-declaration.
3. **Mandatory consumer-law/DSA-baseline surfaces (depend on 1–2):** A1–A3, A5 (private/business self-declaration + per-listing badge + masquerade soft-block §5.1.1 + private-seller notice); B1–B3, B5–B6 (trader capture, free verification, **report-listing + statement-of-reasons** wired to existing AI moderation, single point of contact, T&Cs, suspend-trader = `businesses.status='suspended'` hiding listings); **B7 DSA Art. 20 appeals queue** (reinstatement path); E1–E5 incl. the **per-field lawful-basis table**, minimization, **retention+orphan purge cron**, and **§5.4.1 account-deletion/erasure flow** (`created_by` SET NULL + ownership-transfer); F1/F2 (5-locale legal text via i18n parity guard, contact point); **D1 memo + the §5.2 Art. 30 applicability bet documented for counsel**.
4. **Public profile (depends on 1–3):** `/seller/[handle]` route; Private/Business chips on cards + listings; **DSA Art. 30(7) trader panel** for юр; reuse Phone-verified + Established Seller badges. **No rating signal** (reviews are Phase B — §8.5).
5. **Anti-fraud hardening (parallel to 1–4):** Turnstile (T0) + disposable-email blocklist + in-house velocity/correlation + FingerprintJS + IPQS; **add Twilio `sms_pumping_risk`** to the deployed line-type gate (T1); buyer-side scam-pattern detection + report-buyer (§4.6).

#### A1 — Growth (software-only, no company; sequenced AFTER A0)
- **Cabinets:** `/pro` namespace gated by `seller_type='business'`; **pro subscriptions on existing Stripe** (`mode:"subscription"` — money flow ①, rail exists); storefront v1; basic pro analytics; CSV bulk import; team & roles (depends on A0 `business_members` RLS); seller-issued buyer-invoice generator.
- **A4** Omnibus price/ranking transparency; **C1–C5** P2B drafting + ranking page; **B8** Art. 21 disclosure.
- **(Branch A only)** turn on **Stripe Identity** → ID-verified badge the moment a KBO number exists.

Maps to existing code: `apps/web/src/app/(protected)/profile/*` (cabinet shell), `apps/web/src/app/api/billing/{checkout,webhook}/route.ts` + `lib/stripe/client.ts` (subscription rail), `supabase/migrations/20251110000000_itsme_fields.sql`, `20251109020000_account_flags.sql`, `20260605090000_fix_belgian_vat_validation.sql` (reused validator), `20251102034546_mvp_rls_complete.sql` (the `using(true)` profiles policy → KYC-isolation driver), `20251102034812_mvp_functions.sql` (`is_admin()`, `search_adverts`).

### Phase B — AFTER incorporation / money flow ②
- **Identity binding:** itsme / Belgian eID (T3) → upgrade ID-verified to "identity-verified"; legal-rep binding for юр; run a DPIA first (E6). WhatsApp-OTP (T2, Meta Business).
- **Reviews & ratings (§8.5):** the `reviews` table + eligibility model (recommended: mark-as-sold-gated) + anti-fake controls; then **Top Seller / Highly Rated** (rating-derived) and **Fast Replier** (chat-metric-derived, technically buildable earlier). Aggregate rating starts rendering on cards only here.
- **Money flow ②:** payouts/IBAN + brokered orders (Stripe/Mollie Connect); **re-run D1–D3**; **collect Art. 30(1)(b) ID copy + (c) payment account** (now legally required) + re-assess GDPR basis; DAC7 *reporting* onboarding; LyVoX-issued VAT invoices + Peppol B2B; VAT deemed-supplier handling (+ ViDA 2028 watch).
- **Scale:** Veriff/Onfido for high-risk sellers; one commercial KYB provider (Companyweb BE-depth, or Creditsafe/Sumsub for AML+UBO+rep-ID); Twilio `sim_swap`/`call_forwarding` for ATO.

---

## 10. Open Questions / Decisions for the Founder

### 10.1 Decisions only the founder can make
1. **Branch A vs B (the biggest one):** Will you register a **sole proprietorship (eenmanszaak / KBO number)**? It is the single cheapest unlock for **Stripe Identity** (€1.25/check, first 50 free) — the only thing that closes the SIM-farm residual. If no KBO at all → design stays Branch B and identity-binding is fully Phase B.
2. **Will LyVoX ever facilitate buyer↔seller payments (money flow ②)?** This is the compliance detonator (DAC7 + VAT deemed-supplier + strict DSA Art. 30) *and* the genuine LyVoX-company gate (payouts). Decide whether the product stays contact-only indefinitely; if so, most heavy regimes never switch on — **and the §5.2 Art. 30 bet (build consumer-law trader data; defer the Art-30-only ID copy) holds.**
3. **VIES-down behavior (§5.2.1):** when entity verification is queued/unavailable (not failed), do you **provisionally publish** the format-valid trader (panel shows "verification pending") or require **admin manual-approve**? Default recommendation: provisional publish.
4. **Trader-detection strictness (A3 / §5.1.1):** where to set the band thresholds — how aggressively to soft-block private accounts that look like traders. A UX/abuse/false-positive trade-off.
5. **Reviews eligibility (§8.5, Phase B):** given off-platform sales, which path — interaction-gated, mark-as-sold-gated (recommended), or defer reviews until money flow ②? Determines whether the rating-derived badges ever exist.
6. **Pro plan shape & price:** free-tier generosity, quota tiers, whether to gate the storefront behind a paid tier.

### 10.2 Facts to confirm before building (the dossiers' unverified flags)
1. **itsme onboarding requires a KBO/VAT number** for the partner org — strongly implied, not 100% confirmed (contact onboarding@itsme.be).
2. Whether a Belgian **Stripe "Individual" account activates with zero KBO registration** — not cleanly documented (the Branch A/B fork hinges on this).
3. **Provider pricing** — itsme, Onfido, Telesign, Companyweb, Creditsafe, Sumsub are all contract-only; KBO official Web Service terms (any resale/redisplay restriction on director data).
4. **KBO programmatic endpoint stability** — VIES REST is reliable/free; KBO public search has no official free JSON API (use Open Data CSV or the paid €0.025/lookup service; third-party JSON APIs resell public data — fine for enrichment, flag for legal reliance).
5. **The §5.2 Art. 30 applicability bet — confirm with Belgian counsel (load-bearing).** This document *bets* that DSA Art. 30 does NOT bind LyVoX while contact-only, which is why the Art-30-only ID copy (b) / payment account (c) are deferred and the Phase-A trader gate rests on **consumer law (A2)** instead. If counsel says Art. 30 *does* bind a pure contact board, then (b) ID verification becomes a Phase-A dependency — and there is no fully company-free way to collect it (Stripe Identity needs a KBO; itsme needs a company), so Branch A (register a sole proprietorship) effectively becomes mandatory, not optional. **Also confirm:** the **P2B SME-exemption thresholds (C4)** (<50 staff & <€10M turnover).
6. **ViDA 2028 dates** — as approved May 2025; may shift in national transposition.
7. **itsme/eID KYC-level semantics & TTL** — from training knowledge (cutoff early 2026), not re-verified; confirm against the integration contract before relying on `verifications.expires_at` for the ID axis.
8. **Belgian Trial-account Twilio / WhatsApp constraints** — current SMS failures are provider-side config (Trial + Messaging Service has no sender, err 21704), relevant to the T2 path.

---

### Source anchors (selected; full citations live in the six dossiers)
DSA Art. 30: eu-digital-services-act.com/Digital_Services_Act_Article_30.html · Freshfields DSA-marketplaces (active-facilitation scope) · DAC7 scope/exemptions: taxation-customs.ec.europa.eu/.../dac7_en, sharetribe.com/academy/what-is-dac7 · VAT deemed-supplier / ViDA: vatcalc.com · P2B 2019/1150: eur-lex.europa.eu/eli/reg/2019/1150/oj · Belgian Omnibus/CEL: loyensloeff.com, dlapiper.com · KBO/CBE: economie.fgov.be, cbeapi.be · VIES: ec.europa.eu/taxation_customs/vies · itsme: belgianmobileid.github.io/doc/identification · Stripe Identity (BE pricing): stripe.com/identity · Twilio Lookup: twilio.com/docs/lookup · Cloudflare Turnstile · UBO non-public (CJEU 22 Nov 2022): meijburg.com · competitor patterns: Vinted Pro, eBay DSA business panel, leboncoin verified-ID/Adyen, Marktplaats Pro/Admarkt.
