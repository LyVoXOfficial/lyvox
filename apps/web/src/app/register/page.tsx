import RegisterForm from "./RegisterForm";
import { getInitialLocale } from "@/i18n/server";

export default async function RegisterPage() {
  const initialLocale = await getInitialLocale();

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 md:py-16">
        <RegisterForm initialLocale={initialLocale} />
      </div>
    </main>
  );
}
