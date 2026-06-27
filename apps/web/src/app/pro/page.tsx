import { supabaseServer } from "@/lib/supabaseServer";
import { isViewerVerified } from "@/lib/auth/requireVerified";
import { getI18nProps } from "@/i18n/server";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProOnboardingWizard } from "./ProOnboardingWizard";
import { BusinessCabinet } from "./BusinessCabinet";
import { isCapabilityEnabled } from "@/lib/capabilities";
import { signMediaUrls } from "@/lib/media/signMediaUrls";
import type { ProfileAdvert } from "@/lib/profileTypes";
import type { BusinessMember } from "./BusinessCabinet";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function ProPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { messages, locale } = await getI18nProps();

  const t = (key: string) =>
    key.split(".").reduce<any>((acc, p) => (acc ? acc[p] : undefined), messages) ?? key;
  const tf = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  if (!user) {
    return (
      <main className="container mx-auto flex min-h-[60vh] max-w-xl items-center p-4">
        <Card className="w-full rounded-md">
          <CardHeader>
            <CardTitle>{tf("pro.title", "Become a professional seller")}</CardTitle>
            <CardDescription>
              {tf(
                "pro.signin_required",
                "Sign in to register your business and start selling professionally on LyVoX.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/login">{tf("profile.login", "Sign in")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const verifiedPhone = await isViewerVerified(supabase, user.id);

  if (!verifiedPhone) {
    return (
      <main className="container mx-auto flex min-h-[60vh] max-w-2xl items-center p-4">
        <Card className="w-full rounded-md border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-amber-950 dark:text-amber-100">
              {tf("pro.verify_title", "Phone verification required")}
            </CardTitle>
            <CardDescription className="text-amber-800 dark:text-amber-200">
              {tf(
                "pro.verify_body",
                "A verified phone number is required to register as a professional seller. This keeps our marketplace trustworthy for all buyers.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/verify">{tf("post.goto_verify", "Go to verification")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">{tf("profile.login", "Sign in")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Load the signed-in user's active business
  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id, legal_name, trade_name, legal_form, address_line, postcode, city, country, kbo_number, vat_number, vat_liable, email, phone_e164, withdrawal_terms, self_certified_at, entity_verified, status",
    )
    .eq("created_by", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (business) {
    // Load listings for this business (active, with media, limit 20)
    const { data: advertRows } = await supabase
      .from("adverts")
      .select("id, title, price, status, created_at, location")
      .eq("business_id", business.id)
      .eq("status", "active")
      .limit(20);

    const rawAdverts = advertRows ?? [];

    // Fetch and sign media for these adverts
    let listings: ProfileAdvert[] = [];
    if (rawAdverts.length > 0) {
      const { data: mediaRows } = await supabase
        .from("media")
        .select("advert_id, url, sort")
        .in(
          "advert_id",
          rawAdverts.map((a) => a.id),
        );

      const signedMedia = mediaRows?.length ? await signMediaUrls(mediaRows) : [];

      const mediaByAdvert = signedMedia.reduce<
        Record<string, Array<{ url: string | null; signedUrl: string | null; sort: number | null }>>
      >((acc, m) => {
        if (!acc[m.advert_id]) acc[m.advert_id] = [];
        acc[m.advert_id].push({
          url: m.signedUrl ?? null,
          signedUrl: m.signedUrl ?? null,
          sort: m.sort ?? null,
        });
        return acc;
      }, {});

      listings = rawAdverts.map((a) => ({
        id: a.id,
        title: a.title,
        price: a.price ? Number(a.price) : null,
        status: a.status ?? null,
        created_at: a.created_at ?? "",
        location: a.location ?? null,
        media: mediaByAdvert[a.id] ?? [],
      }));
    }

    // Load team members (two-step: business_members → profiles)
    const { data: memberRows } = await supabase
      .from("business_members")
      .select("user_id, role, accepted_at")
      .eq("business_id", business.id);

    const rawMembers = memberRows ?? [];
    let members: BusinessMember[] = [];

    if (rawMembers.length > 0) {
      const userIds = rawMembers.map((m) => m.user_id);
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      const displayNameMap = new Map<string, string | null>(
        (profileRows ?? []).map((p) => [p.id, p.display_name]),
      );

      members = rawMembers.map((m) => ({
        user_id: m.user_id,
        role: m.role,
        accepted_at: m.accepted_at ?? null,
        display_name: displayNameMap.get(m.user_id) ?? null,
      }));
    }

    return (
      <main className="container mx-auto max-w-3xl p-4">
        <BusinessCabinet
          business={business}
          listings={listings}
          members={members}
          proSubscriptionsEnabled={isCapabilityEnabled("pro_subscriptions")}
          locale={locale}
          messages={messages}
        />
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl p-4">
      <ProOnboardingWizard locale={locale} messages={messages} />
    </main>
  );
}
