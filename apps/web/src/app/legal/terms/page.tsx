import { getI18nProps } from "@/i18n/server";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { LegalDraftBanner } from "@/components/legal/LegalDraftBanner";
import { getPublicProductTruthSnapshot } from "@/lib/productTruth";

export const metadata = {
  title: "Terms of Service",
};

export default async function TermsPage() {
  const { messages } = await getI18nProps();
  const productTruth = await getPublicProductTruthSnapshot();

  function t(key: string): string {
    const parts = key.split(".");
    let val: any = messages;
    for (const p of parts) {
      val = val?.[p];
    }
    return typeof val === "string" ? val : key;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-sm">
      <h1 className="mb-4 text-2xl font-bold">{t("legal.terms_title")}</h1>

      <LegalDraftBanner notice={t("legal.draft_notice")} />

      <p className="mb-8 text-muted-foreground">{t("legal.terms_intro")}</p>

      {/* Service description */}
      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">{t("legal.terms_service_desc")}</h2>
        <p>
          LyVoX is a <strong>contact-only marketplace</strong>. Buyers and sellers connect
          through the platform to arrange deals; <strong>no payments between users pass through LyVoX</strong>.
          All financial transactions occur directly between parties outside the platform.
        </p>
        <p className="mt-2 text-muted-foreground italic">
          [Full text pending legal review]
        </p>
      </section>

      {/* Acceptable use */}
      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">{t("legal.terms_acceptable_use")}</h2>
        <p className="text-muted-foreground italic">
          [Full text pending legal review] You may not post illegal items, fraudulent listings, or
          content that violates applicable law.
        </p>
      </section>

      {/* Report illegal content — DSA Art.16 */}
      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">{t("legal.terms_report_illegal")}</h2>
        <p>
          LyVoX provides a mechanism to report illegal or harmful content in compliance with DSA
          Art.16. Use the <strong>Report</strong> button visible on any listing page to flag content
          for moderation review. Reports are processed promptly.
        </p>
        <p className="mt-2 text-muted-foreground italic">
          [Full statement of reasons mechanism pending legal review]
        </p>
      </section>

      {/* Paid ranking / boost disclosure */}
      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">{t("legal.terms_paid_ranking")}</h2>
        {productTruth.paidBoosts && productTruth.boostRanking ? (
          <p>
            Paid promotion is active. Its exact duration, effect, price and sponsored treatment
            are disclosed before purchase and wherever the promoted placement appears.
          </p>
        ) : (
          <p>
            Paid listing promotion and paid search ranking are not available in the current
            contact-only release. No listing receives paid priority in search.
          </p>
        )}
        <p className="mt-2 text-muted-foreground italic">
          [Full disclosure wording pending legal review]
        </p>
      </section>

      {/* Liability */}
      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">{t("legal.terms_liability")}</h2>
        <p className="text-muted-foreground italic">
          [Full text pending legal review] LyVoX acts as an intermediary platform and is not a party
          to transactions between buyers and sellers.
        </p>
      </section>

      {/* Governing law */}
      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">{t("legal.terms_governing_law")}</h2>
        <p>
          These terms are governed by <strong>Belgian law</strong>. Disputes are subject to the
          exclusive jurisdiction of the <strong>courts of Belgium</strong>.
        </p>
        <p className="mt-2 text-muted-foreground italic">
          [Jurisdiction clause and competent court to be confirmed by counsel]
        </p>
      </section>

      {/* Contact */}
      <section className="mb-4">
        <h2 className="mb-2 text-lg font-semibold">{t("legal.terms_contact")}</h2>
        <p>
          Questions about these terms:{" "}
          <a
            href={`mailto:${LEGAL_ENTITY.dsaContactEmail}`}
            className="underline hover:no-underline"
          >
            {LEGAL_ENTITY.dsaContactEmail}
          </a>
        </p>
      </section>
    </div>
  );
}
