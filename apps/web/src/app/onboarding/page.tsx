import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInitialLocale } from "@/i18n/server";
import { localizeHref, type Locale } from "@/lib/i18n";

type Messages = {
  title: string;
  lead: string;
  checklist: string[];
  profileCta: string;
  phoneCta: string;
  secondaryLead: string;
};

const englishMessages: Messages = {
  title: "Welcome to LyVoX",
  lead: "Finish the account checks that make publishing safer and messages more trustworthy.",
  checklist: [
    "Confirm the email we sent to your inbox",
    "Complete your public profile details",
    "Verify your phone number before high-trust transactions",
  ],
  profileCta: "Update profile",
  phoneCta: "Verify phone",
  secondaryLead: "You can browse the marketplace now, but publishing and trust signals improve after these checks.",
};

const messages: Record<Locale, Messages> = {
  en: englishMessages,
  fr: {
    title: "Bienvenue sur LyVoX",
    lead: "Terminez les controles du compte pour publier et echanger avec plus de confiance.",
    checklist: [
      "Confirmez l'email envoye dans votre boite",
      "Completez les informations publiques du profil",
      "Verifiez votre telephone avant les transactions sensibles",
    ],
    profileCta: "Mettre a jour le profil",
    phoneCta: "Verifier le telephone",
    secondaryLead: "Vous pouvez deja parcourir la marketplace. Les controles renforcent la confiance.",
  },
  nl: {
    title: "Welkom bij LyVoX",
    lead: "Rond de accountcontroles af om veiliger te publiceren en te handelen.",
    checklist: [
      "Bevestig de email in je inbox",
      "Vul je publieke profielgegevens aan",
      "Verifieer je telefoon voor transacties met meer vertrouwen",
    ],
    profileCta: "Profiel bijwerken",
    phoneCta: "Telefoon verifieren",
    secondaryLead: "Je kunt de marketplace nu al bekijken. Controles versterken je vertrouwenssignalen.",
  },
  ru: {
    title: "Добро пожаловать в LyVoX",
    lead: "Завершите проверки аккаунта — они делают публикацию безопаснее, а переписку надёжнее.",
    checklist: [
      "Подтвердите email из письма в вашем почтовом ящике",
      "Заполните публичные данные профиля",
      "Подтвердите номер телефона перед сделками с высоким уровнем доверия",
    ],
    profileCta: "Обновить профиль",
    phoneCta: "Подтвердить телефон",
    secondaryLead: "Маркетплейс уже доступен для просмотра, но публикация и сигналы доверия улучшаются после этих проверок.",
  },
  de: {
    title: "Willkommen bei LyVoX",
    lead: "Schliessen Sie die Kontopruefungen ab, um sicherer zu veroeffentlichen und zu handeln.",
    checklist: [
      "Bestaetigen Sie die Email in Ihrem Postfach",
      "Vervollstaendigen Sie Ihr oeffentliches Profil",
      "Verifizieren Sie Ihr Telefon fuer vertrauenswuerdige Transaktionen",
    ],
    profileCta: "Profil aktualisieren",
    phoneCta: "Telefon verifizieren",
    secondaryLead: "Sie koennen die Marketplace bereits nutzen. Pruefungen verbessern Vertrauenssignale.",
  },
};

export default async function OnboardingPage() {
  const locale = await getInitialLocale();
  const t = messages[locale];
  const href = (path: string) => localizeHref(path, locale);

  return (
    <main className="bg-background">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[minmax(0,1fr)_360px] md:py-14">
        <section className="space-y-6">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-xl lyvox-trust-gradient px-3 py-1 text-xs font-medium text-white">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Account readiness
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">{t.title}</h1>
            <p className="text-base leading-7 text-muted-foreground">{t.lead}</p>
          </div>

          <ol className="grid gap-3">
            {t.checklist.map((item, index) => (
              <li key={item} className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-soft)]">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium text-foreground">{item}</p>
                  <p className="mt-1 text-sm text-muted-foreground">This step improves account trust and reduces support checks later.</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={href("/profile/edit")}>
                {t.profileCta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={href("/profile/phone")}>{t.phoneCta}</Link>
            </Button>
          </div>
        </section>

        <aside className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)]">
          <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-extrabold tracking-tight text-foreground">Why this matters</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.secondaryLead}</p>
          <Button asChild variant="ghost" className="mt-4 px-0">
            <Link href={href("/search")}>
              Browse marketplace
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </aside>
      </div>
    </main>
  );
}
