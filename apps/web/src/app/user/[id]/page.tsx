import { supabaseServer } from "@/lib/supabaseServer";
import { notFound } from "next/navigation";
import { getI18nProps } from "@/i18n/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, CheckCircle, Mail, Phone, Calendar, Building2, ShieldCheck, BadgeCheck, CreditCard } from "lucide-react";
import { formatDate } from "@/i18n/format";
import { ProfileAdvertsList } from "@/components/profile/ProfileAdvertsList";
import { ProfileReviewsList } from "@/components/profile/ProfileReviewsList";
import { logger } from "@/lib/errorLogger";
import { signMediaUrls } from "@/lib/media/signMediaUrls";
import { isViewerVerified } from "@/lib/auth/requireVerified";
import SellerIdentityGate from "@/components/trust/SellerIdentityGate";
import { deriveSellerBadges, type SellerBadge } from "@/lib/profile/sellerBadges";
import { TraderPanel, type BusinessPublicData } from "@/components/business/TraderPanel";

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
  rating: number | null;
  trust_score: number;
  adverts_count: number;
  reviews_count: number;
  seller_type: "individual" | "business" | null;
  itsme_verified: boolean | null;
  active_adverts: Array<{
    id: string;
    title: string;
    price: number | null;
    status: string | null;
    created_at: string;
    location: string | null;
    media: { url: string | null; signedUrl: string | null; sort: number | null }[] | null;
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
  const supabase = await supabaseServer();

  // Load public profile fields only (RLS will enforce this)
  // Note: We explicitly select only public fields - phone and consents are excluded
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, created_at, verified_email, verified_phone, seller_type, itsme_verified, rating")
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

  // Load reviews via two-step fetch:
  // Step 1: fetch reviews rows where subject_id = userId (with count for aggregate)
  // Step 2: resolve reviewer display_names from profiles by reviewer_id
  // We avoid a PostgREST embed because reviews.reviewer_id FK targets auth.users,
  // not profiles, so the embed would fail with PGRST200.
  let reviewsList: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    author: { display_name: string | null } | null;
  }> = [];

  // reviews table is not yet in generated DB types (T1 adds it); cast to bypass tsc
  type ReviewRow = {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string | null;
    reviewer_id: string | null;
  };
  type UntypedClient = {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: ReviewRow[] | null; error: unknown }>;
          };
        };
      };
    };
  };

  try {
    const untypedClient = supabase as unknown as UntypedClient;
    const { data: rawReviews, error: reviewsError } = await untypedClient
      .from("reviews")
      .select("id, rating, comment, created_at, reviewer_id")
      .eq("subject_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (reviewsError) {
      logger.warn("Could not load reviews", {
        component: "PublicUserPage",
        action: "loadReviews",
        metadata: { userId },
        error: reviewsError,
      });
    } else if (rawReviews && rawReviews.length > 0) {
      // Resolve reviewer display_names from profiles
      const reviewerIds = [...new Set(rawReviews.map((r) => r.reviewer_id).filter((id): id is string => !!id))];
      const { data: reviewerProfiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", reviewerIds);

      const profileMap = new Map<string, string | null>(
        (reviewerProfiles ?? []).map((p) => [p.id, p.display_name])
      );

      reviewsList = rawReviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment ?? null,
        created_at: review.created_at ?? "",
        author: review.reviewer_id
          ? { display_name: profileMap.get(review.reviewer_id) ?? null }
          : null,
      }));
    }
  } catch (error) {
    // Defensive: if reviews table doesn't exist yet, continue with empty list
    logger.warn("Could not load reviews (table may not exist yet)", {
      component: "PublicUserPage",
      action: "loadReviews",
      metadata: { userId },
      error,
    });
  }

  const adverts = activeAdverts ?? [];
  const flatMedia = adverts.flatMap((ad) =>
    Array.isArray(ad.media)
      ? ad.media.map((media) => ({
          advert_id: ad.id,
          url: media.url ?? null,
          sort: media.sort ?? null,
        }))
      : []
  );
  const signedMedia = await signMediaUrls(flatMedia);
  const mediaByAdvert = signedMedia.reduce(
    (acc, media) => {
      if (!acc.has(media.advert_id)) {
        acc.set(media.advert_id, []);
      }

      acc.get(media.advert_id)!.push({
        url: media.url ?? null,
        signedUrl: media.signedUrl,
        sort: media.sort ?? null,
      });

      return acc;
    },
    new Map<string, Array<{ url: string | null; signedUrl: string | null; sort: number | null }>>()
  );

  return {
    id: profile.id,
    display_name: profile.display_name,
    created_at: profile.created_at,
    verified_email: profile.verified_email,
    verified_phone: profile.verified_phone,
    rating: (profile as unknown as { rating?: number | null }).rating ?? null,
    seller_type: (profile.seller_type as "individual" | "business" | null) ?? null,
    itsme_verified: profile.itsme_verified ?? null,
    trust_score: trustScore,
    adverts_count: adverts.length, // count of loaded adverts (limited to 12)
    reviews_count: reviewsList.length, // count of loaded reviews (limited to 20)
    active_adverts: adverts.map((ad) => ({
      id: ad.id,
      title: ad.title,
      price: ad.price ? Number(ad.price) : null,
      status: ad.status,
      created_at: ad.created_at ?? "",
      location: ad.location,
      media: mediaByAdvert.get(ad.id) ?? [],
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

async function loadActiveBusiness(userId: string): Promise<BusinessPublicData | null> {
  const supabase = await supabaseServer();
  // RLS biz_public_read allows anon to read active businesses — safe for all viewers
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "legal_name, trade_name, legal_form, address_line, postcode, city, country, kbo_number, vat_number, email, phone_e164, withdrawal_terms, self_certified_at, entity_verified"
    )
    .eq("created_by", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    logger.warn("Could not load business data for public profile", {
      component: "PublicUserPage",
      action: "loadActiveBusiness",
      metadata: { userId },
      error,
    });
    return null;
  }

  return data as BusinessPublicData | null;
}

/** Icon mapping for each badge kind */
function BadgeIcon({ badge }: { badge: SellerBadge }) {
  switch (badge) {
    case "verified_business":
      return <ShieldCheck className="mr-1 h-3 w-3" />;
    case "vat_registered":
      return <CreditCard className="mr-1 h-3 w-3" />;
    case "id_verified":
      return <BadgeCheck className="mr-1 h-3 w-3" />;
    case "phone_verified":
      return <Phone className="mr-1 h-3 w-3" />;
    case "email_verified":
      return <Mail className="mr-1 h-3 w-3" />;
    case "established_seller":
      return <Star className="mr-1 h-3 w-3" />;
  }
}

/** i18n key for each badge (must exist in all 5 locale files) */
function badgeI18nKey(badge: SellerBadge): string {
  switch (badge) {
    case "verified_business":
      return "profile.badge_verified_business";
    case "vat_registered":
      return "profile.badge_vat_registered";
    case "id_verified":
      return "profile.badge_id_verified";
    case "phone_verified":
      return "profile.phone_verified";
    case "email_verified":
      return "profile.email_verified";
    case "established_seller":
      return "profile.badge_established_seller";
  }
}

/** Whether a badge uses the trust-gradient style (identity/business) vs neutral */
function isTrustBadge(badge: SellerBadge): boolean {
  return badge !== "established_seller";
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

  // Wrapper for TraderPanel which expects t(key, fallback) signature
  const tPanel = (key: string, fallback: string): string => {
    const result = t(key);
    return result === key ? fallback : result;
  };

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
    rating,
    trust_score,
    adverts_count,
    reviews_count,
    active_adverts,
    reviews,
    seller_type,
    itsme_verified,
  } = profile;

  // Load business data if this is a business seller (readable by anyone via biz_public_read RLS)
  const isBusiness = seller_type === "business";
  const business = isBusiness ? await loadActiveBusiness(id) : null;

  // Identity gate (verified-only model): unverified viewers don't see the owner's
  // identity (name/avatar). Listings stay public. Fail-closed for anonymous viewers.
  // Redact at the data boundary — the name must not reach the HTML (incl. the avatar
  // seed URL) when hidden, not just the visible <h1>.
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;
  const isOwnProfile = !!currentUserId && currentUserId === id;
  const viewerVerified = currentUserId ? await isViewerVerified(supabase, currentUserId) : false;
  const canSeeIdentity = viewerVerified || isOwnProfile;

  // §0 privacy regime:
  // - юр (business) with loaded business: legal/trade name is PUBLIC (DSA Art. 30(7)).
  //   Show the business legal name as the header — not gated. Never leak the personal display_name.
  // - физ (individual) or business with no active business row: existing identity gate applies.
  const businessHasPublicName = isBusiness && business !== null;

  let headerName: string;
  let avatarSeed: string;
  let avatarInitial: string;

  if (businessHasPublicName) {
    // Business legal name is always public — NOT behind the identity gate
    const publicName = business!.trade_name ?? business!.legal_name;
    headerName = publicName;
    // Use a generic "B" initial for business — do NOT use personal display_name/avatar
    avatarSeed = "Business";
    avatarInitial = "B";
  } else {
    // физ (individual) path — apply the existing identity gate
    headerName = canSeeIdentity
      ? display_name || t("profile.anonymous")
      : t("seller_gate.name_hidden");
    avatarSeed = canSeeIdentity && display_name ? display_name : "User";
    avatarInitial = canSeeIdentity && display_name ? display_name.charAt(0).toUpperCase() : "U";
  }

  // Compute trust badges
  const badges = deriveSellerBadges({
    sellerType: isBusiness ? "business" : "individual",
    verifiedEmail: verified_email ?? false,
    verifiedPhone: verified_phone ?? false,
    idVerified: itsme_verified ?? false,
    entityVerified: business?.entity_verified ?? false,
    hasVat: !!business?.vat_number,
    createdAt: created_at,
    activeListings: active_adverts.length,
  });

  // Hide review authors' identities from unverified viewers too (same verified-only model as the
  // profile owner). Redact at the data boundary — names must not reach the client component's HTML.
  const displayReviews = canSeeIdentity
    ? reviews
    : reviews.map((r) => ({ ...r, author: r.author ? { ...r.author, display_name: null } : null }));

  return (
    <main className="container mx-auto max-w-5xl space-y-8 p-4 md:p-8">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-6 md:flex-row">
        {businessHasPublicName ? (
          /* Business avatar: generic building icon — personal avatar stays private */
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary bg-muted">
            <Building2 className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          </div>
        ) : (
          <Avatar className="h-24 w-24 border-2 border-primary">
            <AvatarImage
              src={`https://api.dicebear.com/8.x/initials/svg?seed=${avatarSeed}`}
            />
            <AvatarFallback>{avatarInitial}</AvatarFallback>
          </Avatar>
        )}
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-bold">{headerName}</h1>
          <div className="flex flex-wrap justify-center gap-2 pt-2 md:justify-start">
            {/* Seller-type chip */}
            {isBusiness ? (
              <Badge className="lyvox-trust-gradient text-white">
                {t("profile.business_seller")}
              </Badge>
            ) : (
              <Badge variant="secondary">{t("profile.private_seller")}</Badge>
            )}
            {/* Trust badge row — derived, capped at 3, replaces ad-hoc email/phone/trusted cluster */}
            {badges.map((badge) =>
              isTrustBadge(badge) ? (
                <Badge key={badge} className="lyvox-trust-gradient text-white">
                  <BadgeIcon badge={badge} />
                  {t(badgeI18nKey(badge))}
                </Badge>
              ) : (
                <Badge key={badge} variant="secondary">
                  <BadgeIcon badge={badge} />
                  {t(badgeI18nKey(badge))}
                </Badge>
              )
            )}
          </div>
        </div>
      </div>

      {/* Identity gate for физ (individual) profiles only.
          Business profiles: the legal name is already public — no gate needed. */}
      {!businessHasPublicName && !canSeeIdentity && <SellerIdentityGate />}

      {/* DSA Trader Panel — public for all viewers (юр only) */}
      {businessHasPublicName && (
        <TraderPanel business={business!} t={tPanel} locale={locale} />
      )}

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
                <ProfileReviewsList reviews={displayReviews} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}
