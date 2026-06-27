import { headers } from "next/headers";
import RegisterForm from "./RegisterForm";
import { resolveFromAcceptLanguage, resolveLocale, type Locale } from "@/lib/i18n";

type PageProps = {
  searchParams?: {
    lang?: string;
  };
};

export default async function RegisterPage({ searchParams }: PageProps) {
  const headerList = await headers();
  const acceptLanguage = headerList.get("accept-language");
  const fromQuery = searchParams?.lang ? resolveLocale(searchParams.lang) : null;
  const initialLocale: Locale = fromQuery ?? resolveFromAcceptLanguage(acceptLanguage);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 md:py-16">
        <RegisterForm initialLocale={initialLocale} />
      </div>
    </main>
  );
}
