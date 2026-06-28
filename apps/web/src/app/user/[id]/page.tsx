import { supabaseServer } from "@/lib/supabaseServer";
import { notFound } from "next/navigation";
import { getI18nProps } from "@/i18n/server";
import { Star, Mail, Phone, Calendar, Building2, ShieldCheck, BadgeCheck, CreditCard } from "lucide-react";
import { formatDate } from "@/i18n/format";
import { ProfileAdvertsList } from "@/components/profile/ProfileAdvertsList";
import { ProfileReviewsList } from "@/components/profile/ProfileReviewsList";
import { logger } from "@/lib/errorLogger";
import { signMediaUrls } from "@/lib/media/signMediaUrls";
import { isViewerVerified } from "@/lib/auth/requireVerified";
import SellerIdentityGate from "@/components/trust/SellerIdentityGate";
import { deriveSellerBadges, type SellerBadge } from "@/lib/profile/sellerBadges";
import { TraderPanel, type BusinessPublicData } from "@/components/business/TraderPanel";
import { TrustScoreBadge } from "@/components/trust/TrustScoreBadge";
import { TrustScoreCard } from "@/components/trust/TrustScoreCard";

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
  last_computed_at: string | null;
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
    .select("score, last_computed_at")
    .eq("user_id", userId)
    .maybeSingle();

  const trustScore = trustScoreData?.score ?? 0;
  const lastComputedAt = trustScoreData?.last_computed_at ?? null;

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
    last_computed_at: lastComputedAt,
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

/**
 * Per-badge visual style following the mockup (lines 586-589):
 *   verified_business / id_verified → trust-gradient pill (white text, teal→mint)
 *   vat_registered                  → teal-tint pill (oklch(0.56 0.13 178/.12) bg, --priD text)
 *   phone_verified / email_verified → --sec bg + border pill (--mintI text)
 *   established_seller              → neutral secondary pill
 */
function SellerBadgePill({
  badge,
  label,
}: {
  badge: SellerBadge;
  label: React.ReactNode;
}) {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    height: "28px",
    padding: "0 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
  };

  switch (badge) {
    case "verified_business":
    case "id_verified":
      return (
        <span
          className="lyvox-trust-gradient"
          style={{ ...baseStyle, color: "#fff", boxShadow: "0 2px 8px oklch(0.55 0.12 172 / 0.3)" }}
        >
          {label}
        </span>
      );
    case "vat_registered":
      return (
        <span
          style={{
            ...baseStyle,
            background: "oklch(0.56 0.13 178 / 0.12)",
            color: "var(--priD)",
          }}
        >
          {label}
        </span>
      );
    case "phone_verified":
    case "email_verified":
      return (
        <span
          style={{
            ...baseStyle,
            background: "var(--sec)",
            color: "var(--mintI)",
            border: "1px solid var(--border)",
          }}
        >
          {label}
        </span>
      );
    case "established_seller":
    default:
      return (
        <span
          style={{
            ...baseStyle,
            background: "var(--muted)",
            color: "var(--muted-foreground)",
          }}
        >
          {label}
        </span>
      );
  }
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
    last_computed_at,
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
  let avatarInitial: string;

  if (businessHasPublicName) {
    // Business legal name is always public — NOT behind the identity gate
    const publicName = business!.trade_name ?? business!.legal_name;
    headerName = publicName;
    // Use a generic "B" initial for business — do NOT use personal display_name/avatar
    avatarInitial = "B";
  } else {
    // физ (individual) path — apply the existing identity gate
    headerName = canSeeIdentity
      ? display_name || t("profile.anonymous")
      : t("seller_gate.name_hidden");
    // avatarInitial is gated: when not canSeeIdentity → "U" (no personal data)
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
    <main className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-8">

      {/* ── Trust header card (mockup lines 578-601) ── */}
      <section
        className="relative mb-6 overflow-hidden"
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--r)",
          boxShadow: "var(--shC)",
        }}
      >
        {/* Radial gradient mesh background */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(50% 120% at 12% 0%, oklch(0.90 0.10 168 / 0.50), transparent 60%), radial-gradient(40% 120% at 90% 10%, oklch(0.78 0.12 200 / 0.28), transparent 60%), var(--card)",
          }}
        />

        {/* Header content */}
        <div
          className="relative flex flex-wrap items-start gap-4 p-5 md:gap-5 md:p-6"
          style={{ flexWrap: "wrap" }}
        >
          {/* Avatar — gradient square with initials (mockup line 581) */}
          {businessHasPublicName ? (
            <div
              className="lyvox-trust-gradient flex flex-none items-center justify-center text-white"
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "20px",
                fontSize: "26px",
                fontWeight: 800,
                boxShadow: "var(--shC)",
              }}
              aria-hidden="true"
            >
              <Building2 className="h-8 w-8" />
            </div>
          ) : (
            <div
              className="lyvox-trust-gradient flex flex-none items-center justify-center text-white"
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "20px",
                fontSize: "26px",
                fontWeight: 800,
                boxShadow: "var(--shC)",
              }}
              aria-label={headerName}
            >
              {avatarInitial}
            </div>
          )}

          {/* Name, rating, type chip, badges */}
          <div className="min-w-0 flex-1">
            {/* Name + verification shield */}
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h1
                style={{
                  font: "800 22px/1.2 Inter, system-ui, sans-serif",
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                {headerName}
              </h1>
              {(canSeeIdentity || businessHasPublicName) && (badges.length > 0) && (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--primary)" strokeWidth="2.6" aria-hidden="true">
                  <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              )}
            </div>

            {/* Seller-type chip + aggregate rating + member-since (mockup line 584) */}
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {isBusiness ? (
                /* Business seller → trust-gradient pill */
                <span
                  className="lyvox-trust-gradient inline-flex items-center"
                  style={{
                    height: "25px",
                    padding: "0 12px",
                    borderRadius: "999px",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  {t("profile.business_seller")}
                </span>
              ) : (
                /* Private seller → grey-dot neutral chip */
                <span
                  className="inline-flex items-center gap-[6px]"
                  style={{ fontSize: "13px", fontWeight: 600, color: "var(--mintI)" }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "999px",
                      background: "oklch(0.62 0.025 198)",
                      flexShrink: 0,
                    }}
                  />
                  {t("profile.private_seller")}
                </span>
              )}

              {/* Aggregate ★ rating */}
              {reviews_count > 0 && rating !== null ? (
                <span className="inline-flex items-center gap-[5px]" style={{ fontSize: "13.5px", fontWeight: 600 }}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="var(--amber)" aria-hidden="true">
                    <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />
                  </svg>
                  <strong style={{ fontWeight: 800 }}>{rating}</strong>
                  <span style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>
                    · {t("reviews.aggregate_count").replace("{n}", String(reviews_count))}
                  </span>
                </span>
              ) : reviews_count === 0 ? (
                <span style={{ fontSize: "13px", color: "var(--muted-foreground)", fontWeight: 500 }}>
                  {t("reviews.no_reviews")}
                </span>
              ) : null}

              {/* Member since */}
              {created_at && (
                <span style={{ fontSize: "13px", color: "var(--muted-foreground)", fontWeight: 500 }}>
                  <Calendar
                    className="mr-1 inline h-[13px] w-[13px]"
                    aria-hidden="true"
                    style={{ verticalAlign: "-0.1em" }}
                  />
                  {t("profile.member_since")}{" "}
                  {formatDate(created_at, locale, { year: "numeric", month: "short" })}
                </span>
              )}
            </div>

            {/* Trust badge row (mockup lines 585-590) */}
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <SellerBadgePill
                  key={badge}
                  badge={badge}
                  label={
                    <>
                      <BadgeIcon badge={badge} />
                      {t(badgeI18nKey(badge))}
                    </>
                  }
                />
              ))}
              {/* Trust tier badge — always visible to all visitors */}
              <TrustScoreBadge score={trust_score} t={t} />
            </div>
          </div>
        </div>

        {/* Tab-strip (Listings / Reviews count) — decorative, non-interactive (mockup lines 597-601) */}
        <div
          className="relative flex"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <span
            style={{
              padding: "13px 22px",
              font: "700 13.5px Inter, system-ui, sans-serif",
              color: "var(--priD)",
              borderBottom: "2px solid var(--primary)",
            }}
          >
            {t("profile.user_listings")}{" "}
            <span style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>{adverts_count}</span>
          </span>
          {reviews_count > 0 && (
            <span
              style={{
                padding: "13px 22px",
                font: "600 13.5px Inter, system-ui, sans-serif",
                color: "var(--muted-foreground)",
              }}
            >
              {t("profile.reviews")}{" "}
              <span style={{ fontWeight: 500 }}>{reviews_count}</span>
            </span>
          )}
        </div>
      </section>

      {/* Identity gate for физ (individual) profiles only.
          Business profiles: the legal name is already public — no gate needed. */}
      {!businessHasPublicName && !canSeeIdentity && <SellerIdentityGate />}

      {/* ── Main content: listings grid (left) + sidebar (right) ── */}
      {/* Desktop: 2-col layout (listings | sidebar); Mobile: stacked */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_320px] md:items-start lg:grid-cols-[1fr_330px]">

        {/* LEFT: listings grid */}
        <div>
          {active_adverts.length > 0 ? (
            <ProfileAdvertsList adverts={active_adverts} variant="grid" />
          ) : (
            <div
              className="flex items-center justify-center py-16 text-center text-muted-foreground"
              style={{
                border: "1px dashed var(--border)",
                borderRadius: "var(--r)",
              }}
            >
              <p style={{ font: "500 14px Inter, system-ui, sans-serif" }}>
                {t("profile.no_adverts_found")}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: sidebar — Trust card + TraderPanel (юр) + reviews */}
        <div className="flex flex-col gap-4">

          {/* Trust & Reputation card — visible to all visitors */}
          <TrustScoreCard
            score={trust_score}
            lastComputedAt={last_computed_at}
            verifiedEmail={verified_email ?? false}
            verifiedPhone={verified_phone ?? false}
            itsmeVerified={itsme_verified ?? false}
            createdAt={created_at}
            activeListingsCount={active_adverts.length}
            isOwnProfile={isOwnProfile}
            locale={locale}
            t={t}
          />

          {/* DSA Trader Panel — public for all viewers (юр only) */}
          {businessHasPublicName && (
            <TraderPanel business={business!} t={tPanel} locale={locale} />
          )}

          {/* Reviews sidebar panel (mockup lines 622-625) */}
          {reviews_count > 0 && rating !== null ? (
            <section
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                padding: "18px",
                boxShadow: "var(--shS)",
              }}
            >
              {/* Aggregate score */}
              <div className="mb-3 flex items-baseline gap-2">
                <span
                  style={{ font: "800 30px/1 Inter, system-ui, sans-serif", letterSpacing: "-0.02em" }}
                >
                  {rating}
                </span>
                <span className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <svg key={i} viewBox="0 0 24 24" width="14" height="14" fill={i <= Math.round(rating) ? "var(--amber)" : "var(--muted-foreground)"} aria-hidden="true">
                      <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />
                    </svg>
                  ))}
                </span>
                <span style={{ fontSize: "12px", color: "var(--muted-foreground)", fontWeight: 500 }}>
                  {reviews_count}
                </span>
              </div>

              {/* Reviews list */}
              <ProfileReviewsList reviews={displayReviews} />
            </section>
          ) : reviews_count === 0 ? (
            /* No reviews yet — minimal placeholder */
            <section
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                padding: "18px",
                boxShadow: "var(--shS)",
              }}
            >
              <p style={{ fontSize: "13px", color: "var(--muted-foreground)", margin: 0 }}>
                {t("reviews.no_reviews")}
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
