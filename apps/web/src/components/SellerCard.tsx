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
  t: (key: string) => string;
};

export default function SellerCard({ seller, locale, t }: SellerCardProps) {
  const memberSince = seller.createdAt ? formatDate(seller.createdAt, locale) : null;

  return (
    <section className="rounded-2xl border p-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {seller.displayName ?? t("advert.seller.unknown") ?? "Продавец"}
          </h2>
          {memberSince ? (
            <p className="text-xs text-muted-foreground">
              {(t("advert.seller.member_since") || "На платформе с")} {memberSince}
            </p>
          ) : null}
        </div>
        <VerificationBadge
          verified={seller.verifiedEmail && seller.verifiedPhone}
          icon={ShieldCheck}
          label={t("advert.verified_seller") || "Проверенный продавец"}
          tooltip={t("advert.verified_seller_tooltip") || "Продавец подтвердил email и телефон"}
        />
      </header>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            {t("advert.seller.email") || "Email"}
          </dt>
          <dd className="text-sm font-medium text-foreground">
            {seller.verifiedEmail
              ? t("advert.seller.email_verified") || "Подтвержден"
              : t("advert.seller.email_unverified") || "Не подтвержден"}
          </dd>
        </div>

        <div>
          <dt className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {t("advert.seller.phone") || "Телефон"}
          </dt>
          <dd className="text-sm font-medium text-foreground">
            {seller.verifiedPhone
              ? t("advert.seller.phone_verified") || "Подтвержден"
              : t("advert.seller.phone_unverified") || "Не подтвержден"}
          </dd>
        </div>

        <div>
          <dt className="text-xs uppercase text-muted-foreground">
            {t("advert.seller.trust_score") || "Уровень доверия"}
          </dt>
          <dd className="text-sm font-medium text-foreground">{seller.trustScore}</dd>
        </div>

        <div>
          <dt className="text-xs uppercase text-muted-foreground">
            {t("advert.seller.active_listings") || "Активные объявления"}
          </dt>
          <dd className="text-sm font-medium text-foreground">{seller.activeAdverts}</dd>
        </div>
      </dl>
    </section>
  );
}

