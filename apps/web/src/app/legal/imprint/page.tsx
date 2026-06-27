import { getI18nProps } from "@/i18n/server";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { LegalDraftBanner } from "@/components/legal/LegalDraftBanner";

export const metadata = {
  title: "Imprint",
};

export default async function ImprintPage() {
  const { messages } = await getI18nProps();

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
      <h1 className="mb-4 text-2xl font-bold">{t("legal.imprint_title")}</h1>

      <LegalDraftBanner notice={t("legal.draft_notice")} />

      {/* Entity identity block */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{t("legal.imprint_identity")}</h2>
        <dl className="space-y-2">
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Legal name</dt>
            <dd>{LEGAL_ENTITY.legalName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Controller</dt>
            <dd>{LEGAL_ENTITY.controllerName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Address</dt>
            <dd>{LEGAL_ENTITY.address}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">KBO / CBE number</dt>
            <dd>{LEGAL_ENTITY.kboNumber ?? "[pending registration]"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">VAT number</dt>
            <dd>{LEGAL_ENTITY.vatNumber ?? "[pending registration]"}</dd>
          </div>
        </dl>
      </section>

      {/* DSA Art.11 single point of contact */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{t("legal.imprint_dsa_contact")}</h2>
        <p className="mb-3">
          In accordance with <strong>DSA Art.11</strong>, LyVoX designates the following single point
          of contact for direct communication with Member State authorities, the European Commission,
          and the European Board for Digital Services:
        </p>
        <dl className="space-y-2">
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Email</dt>
            <dd>
              <a
                href={`mailto:${LEGAL_ENTITY.dsaContactEmail}`}
                className="underline hover:no-underline"
              >
                {LEGAL_ENTITY.dsaContactEmail}
              </a>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Languages</dt>
            <dd>Dutch (NL), French (FR)</dd>
          </div>
        </dl>
      </section>

      {/* Platform description */}
      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">{t("legal.imprint_platform")}</h2>
        <p className="text-muted-foreground italic">
          [Full platform description pending legal review] LyVoX is an online marketplace platform
          operating in Belgium, facilitating contact between buyers and sellers of goods, services,
          and real estate.
        </p>
      </section>
    </div>
  );
}
