import { ShieldCheck, Users, Star, Zap, Plus } from "lucide-react";
import { TraderPanel, type BusinessPublicData } from "@/components/business/TraderPanel";
import { ProfileAdvertsList } from "@/components/profile/ProfileAdvertsList";
import { deriveSellerBadges } from "@/lib/profile/sellerBadges";
import type { ProfileAdvert } from "@/lib/profileTypes";
import type { Locale } from "@/lib/i18n";
import { formatDate } from "@/i18n/format";
import { BusinessEditForm } from "./BusinessEditForm";
import { UpgradeProButton } from "./UpgradeProButton";
import { TeamManager } from "./TeamManager";

export type BusinessMember = {
  user_id: string;
  role: string;
  accepted_at: string | null;
  display_name: string | null;
};

type Props = {
  business: BusinessPublicData & {
    id: string;
    status: string;
    vat_liable: boolean;
    vat_number: string | null;
    entity_verified: boolean;
    returns_url: string | null;
  };
  listings: ProfileAdvert[];
  members: BusinessMember[];
  viewerId: string;
  viewerRole: "owner" | "admin" | "member";
  proSubscriptionsEnabled: boolean;
  isPro: boolean;
  proUntil: string | null;
  locale: Locale;
  messages: Record<string, any>;
};

/** Derive initials (up to 2 chars) from a display name or business name. */
function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function BusinessCabinet({
  business,
  listings,
  members,
  viewerId,
  viewerRole,
  proSubscriptionsEnabled,
  isPro,
  proUntil,
  locale,
  messages,
}: Props) {
  const t = (key: string) =>
    key.split(".").reduce<any>((acc, p) => (acc ? acc[p] : undefined), messages) ?? key;
  const tf = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const badges = deriveSellerBadges({
    sellerType: "business",
    entityVerified: business.entity_verified,
    hasVat: !!business.vat_number,
    verifiedEmail: false,
    verifiedPhone: false,
    idVerified: false,
    createdAt: null,
    activeListings: listings.length,
  });

  const displayName = business.trade_name ?? business.legal_name;
  const avatarInitials = initials(displayName);

  return (
    <div className="space-y-6">

      {/* ── Page heading ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground lg:text-[26px]">
            {tf("pro.cabinet.page_title", "Business cabinet")}
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {tf("pro.cabinet.page_subtitle", "Manage your shopfront, team and verification")}
          </p>
        </div>
        {/* Upgrade header CTA — only shown when flag on and not yet Pro */}
        {proSubscriptionsEnabled && !isPro && (
          <UpgradeProButton locale={locale} messages={messages} variant="amber" />
        )}
      </div>

      {/* ── Business summary card ──────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-[var(--r)] border border-border"
        style={{ boxShadow: "var(--shC)" }}
      >
        {/* Radial gradient wash */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(45% 140% at 10% 0%, oklch(0.90 0.10 168 / 0.45), transparent 60%), var(--card)",
          }}
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-center gap-4 p-5 sm:gap-5 sm:p-6">
          {/* Avatar */}
          <span
            className="lyvox-trust-gradient grid size-[70px] shrink-0 place-items-center rounded-[20px] font-extrabold text-2xl text-white"
            aria-hidden="true"
          >
            {avatarInitials}
          </span>

          {/* Name + badges */}
          <div className="flex-1 min-w-[220px]">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[21px] font-extrabold tracking-[-0.01em] text-foreground">
                {displayName}
              </span>
              <ShieldCheck
                className="h-[18px] w-[18px] text-primary"
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Verified Business badge */}
              {business.entity_verified ? (
                <span className="lyvox-trust-gradient inline-flex h-[27px] items-center gap-[5px] rounded-full px-[11px] text-[11.5px] font-bold text-white">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {tf("pro.badge.verified_business", "Verified Business")}
                </span>
              ) : (
                <span className="inline-flex h-[27px] items-center rounded-full bg-muted px-[11px] text-[11.5px] font-bold text-muted-foreground">
                  {tf("pro.cabinet.pending", "Verification pending")}
                </span>
              )}

              {/* VAT badge */}
              {badges.includes("vat_registered") && (
                <span
                  className="inline-flex h-[27px] items-center rounded-full px-[11px] text-[11.5px] font-bold"
                  style={{
                    background: "oklch(0.56 0.13 178 / 0.12)",
                    color: "var(--priD)",
                  }}
                >
                  {tf("pro.badge.vat_registered", "VAT Registered")}
                </span>
              )}
            </div>
          </div>

          {/* Active listing count — real data from the loaded set */}
          {listings.length > 0 && (
            <div className="flex gap-6 flex-wrap">
              <div>
                <div className="text-2xl font-extrabold tracking-[-0.02em]">
                  {listings.length}
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  {tf("pro.cabinet.active_listings_label", "Active listings")}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Trader info summary ───────────────────────────────────────────── */}
      <TraderPanel business={business} t={tf} locale={locale} />

      {/* ── Edit business details ─────────────────────────────────────────── */}
      <BusinessEditForm
        businessId={business.id}
        initial={{
          trade_name: business.trade_name ?? null,
          legal_form: business.legal_form ?? null,
          address_line: business.address_line ?? null,
          postcode: business.postcode ?? null,
          city: business.city ?? null,
          country: business.country ?? null,
          email: business.email ?? null,
          phone_e164: business.phone_e164 ?? null,
          withdrawal_terms: business.withdrawal_terms ?? null,
          returns_url: business.returns_url ?? null,
        }}
        locale={locale}
        messages={messages}
      />

      {/* ── Desktop two-column grid: listings | team + upgrade ─────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] lg:items-start">

        {/* Left: Listings */}
        <section
          className="overflow-hidden rounded-[var(--r)] border border-border bg-card"
          style={{ boxShadow: "var(--shS)" }}
        >
          {/* Section header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-base font-extrabold text-foreground">
              {tf("pro.cabinet.listings_heading", "Business listings")}
            </h3>
            <a
              href="/post"
              className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-[var(--priD)] hover:opacity-80"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {tf("pro.cabinet.new_listing", "New listing")}
            </a>
          </div>
          <div className="p-4">
            <ProfileAdvertsList adverts={listings} />
          </div>
        </section>

        {/* Right: Team + Upgrade */}
        <div className="flex flex-col gap-[18px]">

          {/* Team manager */}
          <section
            className="rounded-[var(--r)] border border-border bg-card p-5"
            style={{ boxShadow: "var(--shS)" }}
          >
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-[15px] font-extrabold text-foreground">
                {tf("pro.cabinet.team_heading", "Team")}
              </h3>
            </div>
            <TeamManager
              businessId={business.id}
              businessName={business.trade_name ?? business.legal_name ?? ""}
              members={members}
              viewerId={viewerId}
              viewerRole={viewerRole}
              locale={locale}
              messages={messages}
            />
          </section>

          {/* Upgrade to Pro CTA — flag-gated */}
          {proSubscriptionsEnabled && (
            <section
              className="relative overflow-hidden rounded-[var(--r)] p-[22px] text-white"
              style={{
                background: "var(--gC)",
                boxShadow: "var(--shC)",
              }}
            >
              {isPro && proUntil ? (
                <>
                  <div className="mb-1.5 flex items-center gap-2 text-[17px] font-extrabold">
                    <Star className="h-[18px] w-[18px] fill-current" aria-hidden="true" />
                    {tf("pro.cabinet.upgrade_heading", "Pro active")}
                  </div>
                  <p className="text-[12.5px]/[1.55] opacity-90">
                    {tf("pro.cabinet.upgrade.active_until", "Pro active until")}{" "}
                    {formatDate(proUntil, locale, { dateStyle: "medium" })}
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-1.5 flex items-center gap-2 text-[17px] font-extrabold">
                    <Zap className="h-[18px] w-[18px] fill-current" aria-hidden="true" />
                    {tf("pro.cabinet.upgrade_heading", "Upgrade to Pro")}
                  </div>
                  <p className="mb-[14px] text-[12.5px]/[1.55] opacity-[0.92]">
                    {tf(
                      "pro.cabinet.upgrade_body",
                      "Featured placement, boost credits, bulk tools and a verified storefront badge.",
                    )}
                  </p>
                  <div className="w-full">
                    <UpgradeProButton locale={locale} messages={messages} variant="white" />
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
