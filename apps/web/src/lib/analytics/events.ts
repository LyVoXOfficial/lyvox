// Canonical analytics event catalog — ~20 events, used by both client and server.
// See docs/features/FOUNDATIONS-F1-F14.md §F6 for the funnel design.

export const ANALYTICS_EVENTS = {
  // ── Discovery funnel ──────────────────────────────────────────────────────
  /** User viewed an advert detail page. props: { advert_id, category_id? } */
  ADVERT_VIEWED: "advert_viewed",
  /** User performed a search. props: { query, category_id?, result_count? } */
  SEARCH_PERFORMED: "search_performed",
  /** User swiped right (interested) in discover mode. props: { advert_id } */
  SWIPE_RIGHT: "swipe_right",
  /** User swiped left (skip) in discover mode. props: { advert_id } */
  SWIPE_LEFT: "swipe_left",
  /** User saved a search alert. props: { query, category_id? } */
  SAVE_SEARCH: "save_search",
  /** User liked / bookmarked an advert. props: { advert_id } */
  ADVERT_LIKED: "advert_liked",

  // ── Contact funnel ────────────────────────────────────────────────────────
  /** User tapped "Contact seller" — conversation created. props: { advert_id, conversation_id } */
  CONTACT_START: "contact_start",

  // ── Listing lifecycle ─────────────────────────────────────────────────────
  /** Advert saved as draft. props: { advert_id, category_id } */
  ADVERT_CREATED: "advert_created",
  /** Advert published (moved to active). props: { advert_id, category_id } */
  ADVERT_PUBLISHED: "advert_published",
  /** Advert expired or was closed by the seller. props: { advert_id } */
  ADVERT_EXPIRED: "advert_expired",

  // ── User milestones ───────────────────────────────────────────────────────
  /** New account created. props: {} */
  USER_REGISTERED: "user_registered",
  /** Email verified. props: {} */
  USER_VERIFIED_EMAIL: "user_verified_email",
  /** Phone verified. props: {} */
  USER_VERIFIED_PHONE: "user_verified_phone",
  /** itsme verified. props: { kyc_level } */
  USER_VERIFIED_ITSME: "user_verified_itsme",

  // ── Trust events ──────────────────────────────────────────────────────────
  /** Review submitted. props: { advert_id, subject_id, rating } */
  REVIEW_CREATED: "review_created",
  /** Abuse/spam report filed. props: { target_id, reason } */
  REPORT_SUBMITTED: "report_submitted",

  // ── Deal funnel stubs (F3-gated — NOT YET WIRED, escrow not live) ─────────
  /** Escrow deal created. STUB — wires after F3. props: { advert_id, deal_id, amount_eur } */
  DEAL_CREATED: "deal_created",
  /** Payment received by escrow. STUB. props: { deal_id, amount_eur } */
  DEAL_PAID: "deal_paid",
  /** Item marked delivered by buyer. STUB. props: { deal_id } */
  DEAL_DELIVERED: "deal_delivered",
  /** Escrow funds released to seller. STUB. props: { deal_id } */
  DEAL_RELEASED: "deal_released",
  /** Dispute opened. STUB. props: { deal_id, reason } */
  DISPUTE_OPENED: "dispute_opened",
  /** Dispute resolved. STUB. props: { deal_id, resolution } */
  DISPUTE_RESOLVED: "dispute_resolved",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** F3-gated event names — defined but not triggered until escrow is live. */
export const DEAL_STUB_EVENTS: ReadonlySet<AnalyticsEventName> = new Set([
  ANALYTICS_EVENTS.DEAL_CREATED,
  ANALYTICS_EVENTS.DEAL_PAID,
  ANALYTICS_EVENTS.DEAL_DELIVERED,
  ANALYTICS_EVENTS.DEAL_RELEASED,
  ANALYTICS_EVENTS.DISPUTE_OPENED,
  ANALYTICS_EVENTS.DISPUTE_RESOLVED,
]);
