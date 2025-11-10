import { ShieldCheck, Mail, Phone } from "lucide-react";
import VerificationBadge from "@/components/VerificationBadge";
import { formatDate } from "@/i18n/format";
import type { Locale } from "@/lib/i18n";

type SellerInfo = {
  id: string;
  displayName: string | null;
  verifiedEmail: boolean;
  verifiedPhone: boolean;
  trustScore: number;
  createdAt: string | null;
  activeAdverts: number;
};

type SellerCardProps = {
  seller: SellerInfo;
  locale: Locale;
  unknownSellerLabel: string;
  memberSinceLabel: string;
  verifiedSellerLabel: string;
  verifiedSellerTooltip: string;
  emailLabel: string;
  emailVerifiedLabel: string;
  emailUnverifiedLabel: string;
  phoneLabel: string;
  phoneVerifiedLabel: string;
  phoneUnverifiedLabel: string;
  trustScoreLabel: string;
  activeAdvertsLabel: string;
  sellerTypePrivateLabel: string;
  sellerTypeProfessionalLabel: string;
};

export default function SellerCard({
  seller,
  locale,
  unknownSellerLabel,
  memberSinceLabel,
  verifiedSellerLabel,
  verifiedSellerTooltip,
  emailLabel,
  emailVerifiedLabel,
  emailUnverifiedLabel,
  phoneLabel,
  phoneVerifiedLabel,
  phoneUnverifiedLabel,
  trustScoreLabel,
  activeAdvertsLabel,
  sellerTypePrivateLabel,
  sellerTypeProfessionalLabel,
}: SellerCardProps) {
  const memberSince = seller.createdAt ? formatDate(seller.createdAt, locale) : null;
  const isVerified = seller.verifiedEmail && seller.verifiedPhone;
  const sellerTypeLabel =
    (seller.activeAdverts ?? 0) > 5 ? sellerTypeProfessionalLabel : sellerTypePrivateLabel;

  return (
    <section className="rounded-2xl border p-4 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {seller.displayName ?? unknownSellerLabel}
          </h2>
          <p className="text-xs text-muted-foreground">{sellerTypeLabel}</p>
          {memberSince ? (
            <p className="text-xs text-muted-foreground">
              {memberSinceLabel} {memberSince}
            </p>
          ) : null}
        </div>
        <VerificationBadge
          verified={isVerified}
          icon={ShieldCheck}
          label={verifiedSellerLabel}
          tooltip={verifiedSellerTooltip}
        />
      </header>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {emailLabel}
          </dt>
          <dd className="text-sm font-medium text-foreground">
            {seller.verifiedEmail ? emailVerifiedLabel : emailUnverifiedLabel}
          </dd>
        </div>

        <div>
          <dt className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {phoneLabel}
          </dt>
          <dd className="text-sm font-medium text-foreground">
            {seller.verifiedPhone ? phoneVerifiedLabel : phoneUnverifiedLabel}
          </dd>
        </div>

        <div>
          <dt className="text-xs uppercase text-muted-foreground">
            {trustScoreLabel}
          </dt>
          <dd className="text-sm font-medium text-foreground">{seller.trustScore}</dd>
        </div>

        <div>
          <dt className="text-xs uppercase text-muted-foreground">
            {activeAdvertsLabel}
          </dt>
          <dd className="text-sm font-medium text-foreground">{seller.activeAdverts}</dd>
        </div>
      </dl>
    </section>
  );
}

