// Single source of truth for every trust-flavoured signal on the site.
// A signal not registered here MUST NOT be rendered as a badge/counter.
export type TrustSignalKey =
  | "verified_email"
  | "verified_phone"
  | "verified_business"
  | "vat_registered"
  | "id_verified"
  | "established_seller"
  | "promoted"
  | "car_pass"
  | "epc"
  | "safety_certified"
  | "microchip";

export type TrustSignalPolicyEntry = {
  i18nKey: string;
  explanationI18nKey: string;
  minThreshold?: number;
};

export const TRUST_SIGNAL_POLICY: Record<TrustSignalKey, TrustSignalPolicyEntry> = {
  verified_email: {
    i18nKey: "profile.email_verified",
    explanationI18nKey: "trust_score.fact_email_verified",
  },
  verified_phone: {
    i18nKey: "profile.phone_verified",
    explanationI18nKey: "trust_score.fact_phone_verified",
  },
  verified_business: {
    i18nKey: "profile.badge_verified_business",
    explanationI18nKey: "pro.status.verified",
  },
  vat_registered: {
    i18nKey: "profile.badge_vat_registered",
    explanationI18nKey: "pro.badge.vat_registered",
  },
  id_verified: {
    i18nKey: "profile.badge_id_verified",
    explanationI18nKey: "trust_score.fact_id_verified",
  },
  established_seller: {
    i18nKey: "profile.badge_established_seller",
    explanationI18nKey: "trust_score.fact_active_listings",
    minThreshold: 1,
  },
  promoted: {
    i18nKey: "billing.benefits.boost",
    explanationI18nKey: "billing.boost.description",
  },
  car_pass: {
    i18nKey: "advert.document_badge.car_pass",
    explanationI18nKey: "advert.document_badge.car_pass",
  },
  epc: {
    i18nKey: "advert.document_badge.epc",
    explanationI18nKey: "advert.document_badge.epc",
  },
  safety_certified: {
    i18nKey: "advert.document_badge.safety_certified",
    explanationI18nKey: "advert.document_badge.safety_certified",
  },
  microchip: {
    i18nKey: "advert.document_badge.microchip",
    explanationI18nKey: "advert.document_badge.microchip",
  },
};

export type SellerBadgeSignalKey = Extract<
  TrustSignalKey,
  | "verified_business"
  | "vat_registered"
  | "id_verified"
  | "verified_phone"
  | "verified_email"
  | "established_seller"
>;

export const SELLER_BADGE_PRECEDENCE: SellerBadgeSignalKey[] = [
  "id_verified",
  "verified_business",
  "vat_registered",
  "verified_phone",
  "established_seller",
  "verified_email",
];

export const SELLER_BADGE_CAP = 3;

// Wording that must never appear in any trust-flavoured UI copy (F3 + UCPD).
export const BANNED_TRUST_WORDING = [
  "guaranteed",
  "safe payment",
  "buyer protection",
  "escrow",
  "verified purchase",
  "безопасная оплата",
  "защита покупателя",
  "гарантия возврата",
  "veilige betaling",
  "kopersbescherming",
  "paiement sécurisé",
  "protection acheteur",
  "sicherer Kauf",
  "Käuferschutz",
];
