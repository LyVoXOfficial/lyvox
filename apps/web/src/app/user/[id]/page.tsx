import { supabaseServer } from "@/lib/supabaseServer";
import { notFound } from "next/navigation";
import { getI18nProps } from "@/i18n/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, CheckCircle, Mail, Phone, Calendar } from "lucide-react";
import { formatDate } from "@/i18n/format";
import { ProfileAdvertsList } from "@/components/profile/ProfileAdvertsList";
import { ProfileReviewsList } from "@/components/profile/ProfileReviewsList";
import { logger } from "@/lib/errorLogger";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// Public profile data type - only public fields
type PublicProfileData = {
  id: string;
  display_name: string | null;
  created_at: string | null;
  verified_email: boolean | null;
  verified_phone: boolean | null;
  trust_score: number;
  adverts_count: number;
  reviews_count: number;
  active_adverts: Array<{
    id: string;
    title: string;
    price: number | null;
    status: string | null;
    created_at: string;
    location: string | null;
    media: { url: string | null; sort: number | null }[] | null;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    author: {
      display_name: string | null;
    } | null;
  }>;
};

async function loadPublicProfileData(userId: string): Promise<PublicProfileData | null> {
  const supabase = supabaseServer();
  
  // Load public profile fields only (RLS will enforce this)
  // Note: We explicitly select only public fields - phone and consents are excluded
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, created_at, verified_email, verified_phone")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    logger.error("Failed to fetch public profile", {
      component: "PublicUserPage",
      action: "loadPublicProfileData",
      metadata: { userId },
      error: profileError,
    });
    return null;
  }

  // Load trust score (public read access via RLS)
  const { data: trustScoreData } = await supabase
    .from("trust_score")
    .select("score")
    .eq("user_id", userId)
    .maybeSingle();

  const trustScore = trustScoreData?.score ?? 0;

  // Load active adverts count and sample (only active for public view)
  const { data: activeAdverts } = await supabase
    .from("adverts")
    .select(
      `
      id,
      title,
      price,
      status,
      created_at,
      location,
      media(url, sort)
    `
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(12);

  // Load reviews via profile relationship (if reviews table exists)
  // Note: reviews_received is expected to be a foreign key relationship or view
  // If it doesn't exist, this will return empty array
  let reviewsList: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    author: { display_name: string | null } | null;
  }> = [];

  try {
    // Try to load reviews via profile relationship (same approach as protected profile)
    const { data: profileWithReviews } = await supabase
      .from("profiles")
      .select(
        `
        reviews:reviews_received(id, rating, comment, created_at, author:author_id(display_name))
      `
      )
      .eq("id", userId)
      .maybeSingle();

    if (profileWithReviews && Array.isArray(profileWithReviews.reviews)) {
      reviewsList = profileWithReviews.reviews.map((review: any) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at ?? "",
        author: review.author ? { display_name: review.author.display_name } : null,
      }));
    }
  } catch (error) {
    // If reviews table/view doesn't exist, just continue with empty reviews
    logger.warn("Could not load reviews (table may not exist yet)", {
      component: "PublicUserPage",
      action: "loadReviews",
      metadata: { userId },
      error,
    });
  }

  const adverts = activeAdverts ?? [];

  return {
    id: profile.id,
    display_name: profile.display_name,
    created_at: profile.created_at,
    verified_email: profile.verified_email,
    verified_phone: profile.verified_phone,
    trust_score: trustScore,
    adverts_count: adverts.length, // For now, we show count of loaded adverts (limited to 12)
    reviews_count: reviewsList.length, // For now, we show count of loaded reviews (limited to 20)
    active_adverts: adverts.map((ad) => ({
      id: ad.id,
      title: ad.title,
      price: ad.price ? Number(ad.price) : null,
      status: ad.status,
      created_at: ad.created_at ?? "",
      location: ad.location,
      media: ad.media ?? [],
    })),
    reviews: reviewsList.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at ?? "",
      author: review.author ? { display_name: review.author.display_name } : null,
    })),
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { locale, messages } = await getI18nProps();
  const t = (key: string) =>
    key.split(".").reduce<any>((acc, p) => (acc ? acc[p] : undefined), messages) ?? key;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return notFound();
  }

  const profile = await loadPublicProfileData(id);

  if (!profile) {
    return notFound();
  }

  const {
    display_name,
    created_at,
    verified_email,
    verified_phone,
    trust_score,
    adverts_count,
    reviews_count,
    active_adverts,
    reviews,
  } = profile;

  return (
    <main className="container mx-auto max-w-5xl space-y-8 p-4 md:p-8">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-6 md:flex-row">
        <Avatar className="h-24 w-24 border-2 border-primary">
          <AvatarImage
            src={`https://api.dicebear.com/8.x/initials/svg?seed=${display_name || "User"}`}
          />
          <AvatarFallback>{display_name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-bold">{display_name || t("profile.anonymous")}</h1>
          <div className="flex flex-wrap justify-center gap-2 pt-2 md:justify-start">
            <Badge variant="secondary">{t("profile.member")}</Badge>
            {verified_email && (
              <Badge variant="secondary">
                <Mail className="mr-1 h-3 w-3" /> {t("profile.email_verified")}
              </Badge>
            )}
            {verified_phone && (
              <Badge variant="secondary">
                <Phone className="mr-1 h-3 w-3" /> {t("profile.phone_verified")}
              </Badge>
            )}
            {trust_score > 50 && (
              <Badge variant="secondary">{t("profile.trusted_seller")}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats & Info */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("profile.trust_score")}</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trust_score}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("profile.verification")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-2">
              <Mail
                className={`h-4 w-4 ${verified_email ? "text-green-500" : "text-muted-foreground"}`}
              />
              <span>{t("profile.email")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone
                className={`h-4 w-4 ${verified_phone ? "text-green-500" : "text-muted-foreground"}`}
              />
              <span>{t("profile.phone")}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("profile.member_since")}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {created_at
                ? formatDate(created_at, locale, { year: "numeric", month: "short" })
                : "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("profile.active_listings")}</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adverts_count}</div>
          </CardContent>
        </Card>
      </div>

      {/* Listings and Reviews */}
      {(active_adverts.length > 0 || reviews.length > 0) && (
        <div className="space-y-6">
          {active_adverts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("profile.user_listings")} ({adverts_count})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProfileAdvertsList adverts={active_adverts} />
              </CardContent>
            </Card>
          )}
          {reviews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("profile.user_reviews")} ({reviews_count})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProfileReviewsList reviews={reviews} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}

