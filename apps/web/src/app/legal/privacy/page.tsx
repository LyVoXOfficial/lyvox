import { getI18nProps } from "@/i18n/server";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { PROCESSING_ACTIVITIES, PROCESSORS } from "@/lib/legal/processing";
import { LegalDraftBanner } from "@/components/legal/LegalDraftBanner";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
};

export default async function PrivacyPage() {
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
      <h1 className="mb-4 text-2xl font-bold">{t("legal.privacy_title")}</h1>

      <LegalDraftBanner notice={t("legal.draft_notice")} />

      <p className="mb-8 text-muted-foreground">{t("legal.privacy_intro")}</p>

      {/* Controller block */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{t("legal.controller_title")}</h2>
        <dl className="space-y-1">
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
            <dt className="w-40 shrink-0 text-muted-foreground">Privacy contact</dt>
            <dd>
              <a
                href={`mailto:${LEGAL_ENTITY.privacyContactEmail}`}
                className="underline hover:no-underline"
              >
                {LEGAL_ENTITY.privacyContactEmail}
              </a>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 text-muted-foreground">Supervisory authority</dt>
            <dd>{LEGAL_ENTITY.supervisoryAuthority}</dd>
          </div>
        </dl>
      </section>

      {/* GDPR Rights */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{t("legal.rights_title")}</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Access (Art.15):</strong> Request a copy of the personal data we hold about you.
          </li>
          <li>
            <strong>Rectification (Art.16):</strong> Correct inaccurate or incomplete data.
          </li>
          <li>
            <strong>Erasure (Art.17):</strong> Request deletion of your account and associated personal
            data via{" "}
            <Link href="/profile/security" className="underline hover:no-underline">
              Security settings → Delete account
            </Link>
            .
          </li>
          <li>
            <strong>Portability (Art.20):</strong> Receive your data in a structured, machine-readable
            format.
          </li>
          <li>
            <strong>Objection (Art.21):</strong> Object to processing based on legitimate interests.
          </li>
          <li>
            <strong>Complaint:</strong> Lodge a complaint with the{" "}
            <a
              href="https://www.dataprotectionauthority.be"
              className="underline hover:no-underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {LEGAL_ENTITY.supervisoryAuthority}
            </a>
            .
          </li>
        </ul>
        <p className="mt-3 text-muted-foreground">
          Exercise any right by emailing{" "}
          <a
            href={`mailto:${LEGAL_ENTITY.privacyContactEmail}`}
            className="underline hover:no-underline"
          >
            {LEGAL_ENTITY.privacyContactEmail}
          </a>
          .
        </p>
      </section>

      {/* ROPA Table */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{t("legal.ropa_title")}</h2>
        <p className="mb-4 text-muted-foreground">
          Machine-readable record of processing activities (GDPR Art.30). Data values are in English.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pr-3 font-medium text-muted-foreground">{t("legal.ropa_col_purpose")}</th>
                <th className="pb-2 pr-3 font-medium text-muted-foreground">{t("legal.ropa_col_basis")}</th>
                <th className="pb-2 pr-3 font-medium text-muted-foreground">{t("legal.ropa_col_data")}</th>
                <th className="pb-2 pr-3 font-medium text-muted-foreground">{t("legal.ropa_col_processors")}</th>
                <th className="pb-2 font-medium text-muted-foreground">{t("legal.ropa_col_retention")}</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSING_ACTIVITIES.map((activity) => (
                <tr key={activity.purpose} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-3 align-top font-medium">{activity.purpose}</td>
                  <td className="py-2 pr-3 align-top text-muted-foreground">{activity.lawfulBasis}</td>
                  <td className="py-2 pr-3 align-top">
                    <ul className="list-disc pl-4">
                      {activity.dataCategories.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="py-2 pr-3 align-top">{activity.processors.join(", ")}</td>
                  <td className="py-2 align-top text-muted-foreground">{activity.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sub-processors */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{t("legal.processors_title")}</h2>
        <p className="mb-4 text-muted-foreground">
          Art.28 sub-processors. US-transfer safeguards (DPF/SCC) to be confirmed by founder/counsel.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pr-3 font-medium text-muted-foreground">Processor</th>
                <th className="pb-2 pr-3 font-medium text-muted-foreground">Role</th>
                <th className="pb-2 font-medium text-muted-foreground">Location / Transfer</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map((p) => (
                <tr key={p.name} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-3 align-top font-medium">{p.name}</td>
                  <td className="py-2 pr-3 align-top text-muted-foreground">{p.role}</td>
                  <td className="py-2 align-top text-muted-foreground">{p.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Skeletal narrative sections */}
      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">{t("legal.section_collection")}</h2>
        <p className="text-muted-foreground italic">
          [Full text pending legal review] We collect the data listed in the ROPA table above for the
          stated purposes and lawful bases.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">{t("legal.section_sharing")}</h2>
        <p className="text-muted-foreground italic">
          [Full text pending legal review] We share data only with the sub-processors listed above.
          We do not sell personal data to third parties.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">{t("legal.section_security")}</h2>
        <p className="text-muted-foreground italic">
          [Full text pending legal review] Technical and organisational measures include encryption in
          transit (TLS), access controls, and MFA for administrative access.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">{t("legal.section_changes")}</h2>
        <p className="text-muted-foreground italic">
          [Full text pending legal review] Material changes will be notified via the platform before
          taking effect.
        </p>
      </section>
    </div>
  );
}
