import { ShieldCheck, Users, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TraderPanel, type BusinessPublicData } from "@/components/business/TraderPanel";
import { ProfileAdvertsList } from "@/components/profile/ProfileAdvertsList";
import { deriveSellerBadges } from "@/lib/profile/sellerBadges";
import type { ProfileAdvert } from "@/lib/profileTypes";
import type { Locale } from "@/lib/i18n";
import { BusinessEditForm } from "./BusinessEditForm";

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
  proSubscriptionsEnabled: boolean;
  locale: Locale;
  messages: Record<string, any>;
};

export function BusinessCabinet({
  business,
  listings,
  members,
  proSubscriptionsEnabled,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{displayName}</h1>
        <span className="lyvox-trust-gradient inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {tf("pro.cabinet.business_seller_chip", "Business seller")}
        </span>
      </div>

      {/* Verification status */}
      <div className="flex flex-wrap items-center gap-2">
        {business.entity_verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {tf("pro.cabinet.verified", "Verified business")}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
            {tf("pro.cabinet.pending", "Verification pending")}
          </span>
        )}
        {badges.includes("vat_registered") && (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            {tf("pro.badge.vat_registered", "VAT Registered")}
          </span>
        )}
      </div>

      {/* Trader info summary */}
      <TraderPanel business={business} t={tf} locale={locale} />

      {/* Edit form */}
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

      {/* Listings */}
      <Card>
        <CardHeader>
          <CardTitle>{tf("pro.cabinet.listings_heading", "Business listings")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileAdvertsList adverts={listings} />
        </CardContent>
      </Card>

      {/* Team members */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <CardTitle>{tf("pro.cabinet.team_heading", "Team")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tf("pro.cabinet.team_empty", "No team members yet.")}
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {members.map((member) => (
                <li key={member.user_id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium text-foreground">
                    {member.accepted_at
                      ? (member.display_name ?? tf("pro.cabinet.unnamed_member", "Member"))
                      : tf("pro.cabinet.pending_invite", "Pending invite")}
                  </span>
                  <span className="capitalize text-muted-foreground">{member.role}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Upgrade to Pro CTA — flag-gated, hidden when pro_subscriptions is OFF */}
      {proSubscriptionsEnabled && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" aria-hidden="true" />
              <CardTitle className="text-primary">
                {tf("pro.cabinet.upgrade_heading", "Upgrade to Pro")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {tf("pro.cabinet.upgrade_body", "Unlock advanced seller features with a Pro subscription.")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
