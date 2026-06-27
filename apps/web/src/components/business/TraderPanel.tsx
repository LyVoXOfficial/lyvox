import { ShieldCheck } from "lucide-react";
import { formatDate } from "@/i18n/format";
import type { Locale } from "@/lib/i18n";

export type BusinessPublicData = {
  legal_name: string;
  trade_name: string | null;
  legal_form: string | null;
  address_line: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  kbo_number: string | null;
  vat_number: string | null;
  email: string;
  phone_e164: string | null;
  withdrawal_terms: string | null;
  self_certified_at: string | null;
  entity_verified: boolean;
};

type Props = {
  business: BusinessPublicData;
  t: (key: string, fallback: string) => string;
  locale: Locale;
};

export function TraderPanel({ business, t, locale }: Props) {
  return (
    <section className="rounded-md border border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium">
          {t("pro.panel.title", "Professional seller")}
        </h2>
        {business.entity_verified ? (
          /* Verified Business → trust-gradient pill (white shield, teal→mint) */
          <span
            className="lyvox-trust-gradient inline-flex items-center gap-[5px]"
            style={{
              height: "26px",
              padding: "0 11px",
              borderRadius: "999px",
              fontSize: "11.5px",
              fontWeight: 700,
              color: "#fff",
            }}
          >
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            {t("pro.panel.badge_verified", "Verified Business")}
          </span>
        ) : null}
        {business.vat_number && business.entity_verified ? (
          /* VAT-registered → teal-tint pill (--priD text, oklch bg) */
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "26px",
              padding: "0 11px",
              borderRadius: "999px",
              background: "oklch(0.56 0.13 178 / 0.12)",
              color: "var(--priD)",
              fontSize: "11.5px",
              fontWeight: 700,
            }}
          >
            {t("pro.panel.badge_vat", "VAT-registered")}
          </span>
        ) : null}
      </div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            {t("pro.panel.legal_name", "Company name")}
          </dt>
          <dd className="text-foreground">
            {business.legal_name}
            {business.trade_name ? ` (${business.trade_name})` : null}
          </dd>
        </div>
        {business.legal_form ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              {t("pro.panel.legal_form", "Legal form")}
            </dt>
            <dd className="text-foreground">{business.legal_form}</dd>
          </div>
        ) : null}
        {business.address_line ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              {t("pro.panel.address", "Address")}
            </dt>
            <dd className="text-foreground">
              {business.address_line}
              {business.postcode || business.city
                ? `, ${[business.postcode, business.city].filter(Boolean).join(" ")}`
                : null}
              {business.country ? `, ${business.country}` : null}
            </dd>
          </div>
        ) : null}
        {business.kbo_number ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              {t("pro.panel.kbo_number", "Enterprise number")}
            </dt>
            <dd className="text-foreground">{business.kbo_number}</dd>
          </div>
        ) : null}
        {business.vat_number ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              {t("pro.panel.vat_number", "VAT number")}
            </dt>
            <dd className="text-foreground">BE {business.vat_number}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            {t("pro.panel.contact", "Contact")}
          </dt>
          <dd className="text-foreground">
            {business.email}
            {business.phone_e164 ? ` · ${business.phone_e164}` : null}
          </dd>
        </div>
        {business.withdrawal_terms ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              {t("pro.panel.withdrawal_terms", "Withdrawal & returns policy")}
            </dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-foreground/80">
              {business.withdrawal_terms}
            </dd>
          </div>
        ) : null}
        {business.self_certified_at ? (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              {t("pro.panel.certified_on", "Self-certified on")}
            </dt>
            <dd className="text-foreground/80 text-xs">
              {formatDate(business.self_certified_at, locale)}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
