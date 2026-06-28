# Legal Pages Infrastructure (lean) — Build Note

**Status:** Build-ready, company-free, ACTIVE. The FINAL launch-checklist slice (#2b). **Deliberately LEAN**
(advisor-confirmed): build the activation-ready infrastructure + the FACTUAL data-processing record; the narrative
legal PROSE stays the founder's end-stage task with counsel (user: "начну делать документы после"). So: replace the
stub legal pages with real structured/factual content + a prominent draft banner; do NOT author elaborate ×5
counsel-grade narrative.

## 0. Current state
`/legal/privacy` + `/legal/terms` are stubs (`<div>Текст страницы</div>`). No `/legal/imprint`. Cookie policy +
consent already shipped (`/legal/cookies`). DSA Art.16 report mechanism already exists (`ReportButton` + `/api/reports/create`).

## 1. Pieces
### 1.1 `apps/web/src/lib/legal/entity.ts` (activation config — Decision-3 placeholders)
```ts
export const LEGAL_ENTITY = {
  registrationStatus: "pending" as "pending" | "registered",
  legalName: "LyVoX (registration pending)",
  controllerName: "[Founder name — pending]",     // interim natural-person controller (GDPR Art.13)
  address: "[Registered address — pending]",
  kboNumber: null as string | null,
  vatNumber: null as string | null,
  dsaContactEmail: "contact@lyvox.be",             // DSA Art.11 single point of contact (use a real reachable inbox)
  privacyContactEmail: "privacy@lyvox.be",
  supervisoryAuthority: "Belgian DPA (APD/GBA) — gegevensbeschermingsautoriteit / autorité de protection des données",
};
export const LEGAL_CONTENT_APPROVED = false; // flip true after counsel sign-off (gates the draft banner)
```
All page identity/contact fields render from this. Founder edits one file on registration. (Optionally read overrides
from env later — not now.)

### 1.2 `apps/web/src/lib/legal/processing.ts` (ROPA / GDPR Art.30 — the durable FACTUAL output)
- `export type ProcessingActivity = { purpose: string; lawfulBasis: string; dataCategories: string[]; processors: string[]; retention: string };`
- `export const PROCESSING_ACTIVITIES: ProcessingActivity[]` — the real activities, accurate to the codebase:
  account/auth (Art.6(1)(b), Supabase, until deletion), phone verification (Twilio Lookup+OTP, consent/contract,
  short OTP retention), listings + media (contract, Supabase storage), messaging (contract, Supabase, retain TBD),
  payments/boosts/Pro (Stripe, contract + legal accounting 7y), anti-fraud/rate-limit (Cloudflare Turnstile + Upstash,
  legitimate interest), hosting/logs (Vercel + logs table, legitimate interest), business/trader verification (KBO/VIES,
  legal obligation/consumer-law). Mark retention values that are founder/counsel TODOs explicitly (e.g. chat/log retention).
- `export const PROCESSORS: { name: string; role: string; location: string }[]` — Supabase, Stripe, Twilio, Cloudflare,
  Upstash, Vercel with a one-line role + note that US-transfer safeguards (DPF/SCC) are to be confirmed by the founder.
- Unit-tested lightly (every processor referenced in an activity exists in PROCESSORS; non-empty).

### 1.3 `apps/web/src/components/legal/LegalDraftBanner.tsx`
- Renders a prominent "⚠ Draft — pending final legal review; not yet legally binding" notice when
  `LEGAL_CONTENT_APPROVED === false` OR `LEGAL_ENTITY.registrationStatus !== "registered"`. i18n `legal.draft_notice`.

### 1.4 Pages (replace stubs; render structured + factual content + draft banner; SKELETAL narrative)
- `app/legal/privacy/page.tsx`: draft banner + controller block (from entity) + a **GDPR rights** list (access,
  rectification, erasure→link `/profile/security`, portability, objection, complaint to the Belgian DPA) + the
  **ROPA table** rendered from `processing.ts` (purpose / lawful basis / data / processors / retention) + a one-paragraph
  skeleton per remaining section marked "[Full policy text pending legal review]". This is substantive + accurate.
- `app/legal/terms/page.tsx`: draft banner + skeletal sections (service description: **contact-only marketplace, no
  on-platform payments between users**; acceptable use; **how to report illegal content → link the report mechanism**
  (DSA Art.16); paid-ranking/boost disclosure one-liner; liability; **Belgian law + jurisdiction**) each a short skeleton
  marked pending counsel.
- `app/legal/imprint/page.tsx` (NEW): draft banner + the `entity.ts` identity block (legal name, controller, address,
  KBO/VAT placeholders) + the **DSA Art.11 single point of contact** (dsaContactEmail, languages NL/FR).
- Each page: a heading + intro via i18n; the structured data is data. Keep it SSR/server-component friendly (match
  `/legal/cookies` page style).

### 1.5 Footer + i18n
- Add `/legal/imprint` link to `legal-footer.tsx` (`common.imprint`). Add i18n chrome keys ×5: `common.imprint`,
  `legal.draft_notice`, `legal.privacy_title`, `legal.privacy_intro`, `legal.terms_title`, `legal.terms_intro`,
  `legal.imprint_title`, `legal.rights_title`, `legal.ropa_title`, plus the section headings used. Accurate FR/NL.
  i18n parity guard must pass. (ROPA row text may stay English data with a "machine-readable record" note — keep light.)

## 2. Tasks (this is a LEAN slice — one implementer, then review+deploy)
- **T1** entity.ts + processing.ts (+ light test) + LegalDraftBanner + the 3 pages + footer + i18n ×5.
- **T2** review + clean build + deploy + prod-verify (privacy renders ROPA table + rights + draft banner; terms +
  imprint render with draft banner; footer imprint link resolves; i18n parity).

## 3. Explicitly NOT in scope (founder/counsel, post-build — for the handoff)
- The actual counsel-grade legal prose ×5 locales; professional FR/NL legal translation; `LEGAL_CONTENT_APPROVED=true`.
- entity.ts real values (legal name/KBO/VAT + interim-controller name/address) — founder supplies on registration.
- DPAs with the 6 processors; US-transfer safeguard confirmation; final retention values.
- Confirming the DSA Art.16 report flow meets formal requirements (acknowledgement + statement of reasons).
