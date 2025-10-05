import "./globals.css";
import type { ReactNode } from "react";
import TopBar from "@/components/topbar";
import MainHeader from "@/components/main-header";
import LegalFooter from "@/components/legal-footer";
import BottomNav from "@/components/bottom-nav";
import ViewportBottomSpacer from "@/components/viewport-bottom-spacer";

export const metadata = {
  title: "LyVoX",
  description: "Купи-продай, услуги и недвижимость",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen flex flex-col">
        <TopBar />
        <MainHeader />
        <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-4 md:py-6 pb-[calc(64px+env(safe-area-inset-bottom))]">
  {children}
</main>
        <LegalFooter />
        <ViewportBottomSpacer />
        <BottomNav />
      </body>
    </html>
  );
}
