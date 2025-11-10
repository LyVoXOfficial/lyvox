import { supabaseServer } from "@/lib/supabaseServer";
import { notFound } from "next/navigation";
import { getI18nProps } from "@/i18n/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Star, Calendar, Mail, Phone, Edit, BarChart3, Package, MessageSquare, Settings, Heart, Shield, User, Bell } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/i18n/format";
import { ProfileAdvertsList } from "@/components/profile/ProfileAdvertsList";
import { ProfileReviewsList } from "@/components/profile/ProfileReviewsList";
import { type ProfileData, type ProfileFavorite } from "@/lib/profileTypes";
import { logger } from "@/lib/errorLogger";
import { signMediaUrls } from "@/lib/media/signMediaUrls";
import { getFirstImage } from "@/lib/media/getFirstImage";
import FavoritesComparisonView from "@/components/favorites/FavoritesComparisonView";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

async function loadProfileData(userId: string): Promise<(ProfileData & { 
  advertsStats: { active: number; draft: number; archived: number; total: number };
}) | null> {
  const supabase = await supabaseServer();
  
  const profilePromise = supabase
    .from("profiles")
    .select(
      `
        id,
        display_name,
        created_at,
        verified_email,
        verified_phone
      `,
    )
    .eq("id", userId)
    .maybeSingle();

  const trustScorePromise = supabase
    .from("trust_score")
    .select("score")
    .eq("user_id", userId)
    .maybeSingle();

  const advertsPromise = supabase
    .from("adverts")
    .select("id, title, price, status, created_at, location")
    .eq("user_id", userId);

  const favoritesPromise = supabase
    .from("favorites")
    .select(
      `
        advert_id,
        created_at,
        adverts:advert_id (
          id,
          title,
          price,
          currency,
          location,
          created_at,
          user_id,
          status
        )
      `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const [
    { data: profileData, error: profileError },
    { data: trustScoreData },
    { data: advertsData, error: advertsError },
    { data: favoritesData, error: favoritesError },
  ] = await Promise.all([profilePromise, trustScorePromise, advertsPromise, favoritesPromise]);

  if (profileError) {
    logger.error("Failed to fetch profile data", {
      component: "ProfilePage",
      action: "loadProfileData",
      metadata: { userId, errorMessage: profileError.message, errorDetails: profileError.details },
      error: profileError,
    });
    return null;
  }

  if (advertsError) {
    logger.error("Failed to fetch profile adverts", {
      component: "ProfilePage",
      action: "loadProfileAdverts",
      metadata: { userId, errorMessage: advertsError.message, errorDetails: advertsError.details },
      error: advertsError,
    });
  }

  if (!profileData) {
    logger.warn("Profile data not found", {
      component: "ProfilePage",
      action: "loadProfileData",
      metadata: { userId },
    });
    return null;
  }

  const trustScore = trustScoreData?.score ?? 0;

  const adverts = (advertsData || []).map((advert) => ({
    id: advert.id,
    title: advert.title,
    price: advert.price ?? null,
    status: advert.status ?? null,
    created_at: advert.created_at ?? "",
    location: advert.location ?? null,
    media: [] as Array<{ url: string | null; sort: number | null }>,
  }));

  // Fetch media for adverts and favorites plus seller verification in parallel
  let mediaByAdvert: Record<string, Array<{ url: string | null; signedUrl: string | null; sort: number | null }>> = {};

  if (favoritesError) {
    logger.warn("Failed to load profile favorites", {
      component: "ProfilePage",
      action: "loadProfileFavorites",
      metadata: { userId },
      error: favoritesError,
    });
  }

  const favoritesRows = favoritesData ?? [];
  const favoriteAdvertIds = favoritesRows
    .map((favorite) => favorite.adverts?.id ?? null)
    .filter((value): value is string => typeof value === "string");

  const favoriteSellerIds = favoritesRows
    .map((favorite) => favorite.adverts?.user_id ?? null)
    .filter((value): value is string => typeof value === "string");

  const advertMediaPromise =
    adverts.length > 0
      ? supabase.from("media").select("advert_id, url, sort").in("advert_id", adverts.map((ad) => ad.id))
      : Promise.resolve({ data: null, error: null });

  const favoriteMediaPromise =
    favoriteAdvertIds.length > 0
      ? supabase
          .from("media")
          .select("advert_id, url, sort")
          .in("advert_id", favoriteAdvertIds)
          .order("sort", { ascending: true })
      : Promise.resolve({ data: null, error: null });

  const favoriteProfilesPromise =
    favoriteSellerIds.length > 0
      ? supabase.from("profiles").select("id, verified_email, verified_phone").in("id", favoriteSellerIds)
      : Promise.resolve({ data: null });

  const [
    { data: mediaData, error: mediaError },
    { data: favoriteMediaRows, error: favoriteMediaError },
    { data: favoriteProfiles },
  ] = await Promise.all([advertMediaPromise, favoriteMediaPromise, favoriteProfilesPromise]);

  if (mediaError) {
    console.error("Failed to fetch media for adverts:", mediaError);
  }

  if (favoriteMediaError) {
    logger.warn("Failed to load favorites media", {
      component: "ProfilePage",
      action: "loadFavoritesMedia",
      metadata: { userId },
      error: favoriteMediaError,
    });
  }

  const mediaDataList = !mediaError && Array.isArray(mediaData) ? mediaData : [];
  const favoriteMediaList =
    !favoriteMediaError && Array.isArray(favoriteMediaRows) ? favoriteMediaRows : [];

  const [signedMedia, signedFavoriteMedia] = await Promise.all([
    mediaDataList.length ? signMediaUrls(mediaDataList) : Promise.resolve([]),
    favoriteMediaList.length ? signMediaUrls(favoriteMediaList) : Promise.resolve([]),
  ]);

  if (signedMedia.length) {
    mediaByAdvert = signedMedia.reduce(
      (acc, media) => {
        const advertId = media.advert_id;
        if (!acc[advertId]) {
          acc[advertId] = [];
        }

        const resolvedUrl = media.signedUrl ?? null;
        acc[advertId].push({
          url: resolvedUrl,
          signedUrl: resolvedUrl,
          sort: media.sort ?? null,
        });

        return acc;
      },
      {} as Record<string, Array<{ url: string | null; signedUrl: string | null; sort: number | null }>>,
    );
  }

  const favoriteMediaMap = new Map<string, string>();
  if (signedFavoriteMedia.length) {
    const groupedFavorites = signedFavoriteMedia.reduce(
      (acc, media) => {
        if (!acc.has(media.advert_id)) {
          acc.set(media.advert_id, []);
        }

        acc.get(media.advert_id)!.push({
          advert_id: media.advert_id,
          url: media.url ?? null,
          signedUrl: media.signedUrl,
          sort: media.sort ?? null,
        });

        return acc;
      },
      new Map<string, Array<{ advert_id: string; url: string | null; signedUrl: string | null; sort: number | null }>>(),
    );

    for (const [advertId, items] of groupedFavorites.entries()) {
      const first = getFirstImage(items);
      if (first) {
        favoriteMediaMap.set(advertId, first);
      }
    }
  }

  let favoriteVerifiedMap = new Map<string, boolean>();
  if (favoriteProfiles) {
    favoriteVerifiedMap = new Map(
      favoriteProfiles.map((profile) => [
        profile.id,
        Boolean(profile.verified_email) && Boolean(profile.verified_phone),
      ]),
    );
  }

  const hydratedAdverts = adverts.map((advert) => ({
    id: advert.id,
    title: advert.title,
    price: advert.price ? Number(advert.price) : null,
    status: advert.status,
    created_at: advert.created_at ?? "",
    location: advert.location,
    media: mediaByAdvert[advert.id] ?? [],
  }));

  const advertsStats = {
    active: hydratedAdverts.filter((a) => a.status === "active").length,
    draft: hydratedAdverts.filter((a) => a.status === "draft").length,
    archived: hydratedAdverts.filter((a) => a.status === "archived").length,
    total: hydratedAdverts.length,
  };

  const favorites: ProfileFavorite[] = favoritesRows.map((favorite) => {
    const advert = favorite.adverts;
    const advertId = advert?.id ?? favorite.advert_id;

    return {
      advertId: favorite.advert_id,
      favoritedAt: favorite.created_at ?? null,
      advert: advert
        ? {
            id: advert.id,
            title: advert.title ?? "",
            price:
              typeof advert.price === "number"
                ? advert.price
                : advert.price
                  ? Number(advert.price)
                  : null,
            currency: advert.currency ?? null,
            location: advert.location ?? null,
            createdAt: advert.created_at ?? null,
            image: favoriteMediaMap.get(advertId) ?? null,
            sellerVerified: favoriteVerifiedMap.get(advert.user_id ?? "") ?? false,
          }
        : null,
    };
  });
 
  const profile: ProfileData & { advertsStats: typeof advertsStats } = {
    ...profileData,
    trust_score: trustScore,
    reviews: [], // Reviews table doesn't exist yet, return empty array
    adverts: hydratedAdverts,
    favorites,
    advertsStats,
  };
  return profile;
}

export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { locale, messages } = await getI18nProps();
  const t = (key: string) => key.split('.').reduce<any>((acc, p) => (acc ? acc[p] : undefined), messages) ?? key;


  if (!user) {
    return notFound();
  }

  const profile = await loadProfileData(user.id);

  if (!profile) {
    return (
      <main className="container mx-auto p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">
            {t("profile.load_error")}
          </h2>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            Не удалось загрузить данные профиля. Попробуйте обновить страницу или войти заново.
          </p>
          <div className="mt-4 flex gap-2">
            <a
              href={`/profile?reload=${Date.now()}`}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Обновить страницу
            </a>
            <a
              href="/login"
              className="rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              Войти заново
            </a>
          </div>
        </div>
      </main>
    );
  }

  const { display_name, created_at, verified_email, verified_phone, trust_score, adverts, favorites, reviews, advertsStats } = profile;

  const favoriteItems: SelectableAd[] = (favorites ?? [])
    .map((favorite) => favorite.advert)
    .filter((advert): advert is NonNullable<typeof advert> => Boolean(advert))
    .map((advert) => ({
      id: advert.id,
      title: advert.title,
      price: advert.price,
      currency: advert.currency,
      location: advert.location,
      image: advert.image,
      createdAt: advert.createdAt,
      sellerVerified: advert.sellerVerified,
    }));

  return (
    <main className="container mx-auto max-w-5xl space-y-8 p-4 md:p-8">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-6 md:flex-row">
        <Avatar className="h-24 w-24 border-2 border-primary">
          <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${display_name}`} />
          <AvatarFallback>{display_name?.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-bold">{display_name}</h1>
          <div className="flex flex-wrap justify-center gap-2 pt-2 md:justify-start">
            <Badge variant="secondary">{t('profile.member')}</Badge>
            {verified_phone && <Badge variant="secondary">{t('profile.phone_verified')}</Badge>}
            {trust_score > 50 && <Badge variant="secondary">{t('profile.trusted_seller')}</Badge>}
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/profile/edit">
            <Edit className="mr-2 h-4 w-4" /> {t('profile.edit')}
          </Link>
        </Button>
      </div>

      {/* Navigation Tabs */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="flex w-full flex-nowrap gap-2 overflow-x-auto rounded-lg bg-muted/60 p-1 sm:grid sm:grid-cols-5 sm:gap-0">
          <TabsTrigger value="dashboard" className="flex flex-none min-w-[120px] items-center gap-2 sm:min-w-0 sm:flex-1">
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium sm:text-sm">{t('profile.dashboard')}</span>
          </TabsTrigger>
          <TabsTrigger value="adverts" className="flex flex-none min-w-[140px] items-center gap-2 sm:min-w-0 sm:flex-1">
            <Package className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium sm:text-sm">{t('profile.my_adverts')}</span>
            <Badge variant="secondary" className="ml-1 shrink-0">{advertsStats.total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="reviews" className="flex flex-none min-w-[140px] items-center gap-2 sm:min-w-0 sm:flex-1">
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium sm:text-sm">{t('profile.reviews')}</span>
            <Badge variant="secondary" className="ml-1 shrink-0">{reviews?.length ?? 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="favorites" className="flex flex-none min-w-[140px] items-center gap-2 sm:min-w-0 sm:flex-1">
            <Heart className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium sm:text-sm">{t('profile.favorites')}</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex flex-none min-w-[140px] items-center gap-2 sm:min-w-0 sm:flex-1">
            <Settings className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium sm:text-sm">{t('profile.settings')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6 pt-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('profile.trust_score')}</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{trust_score}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {trust_score > 50 ? t('profile.trusted_seller') : t('profile.building_reputation')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('profile.total_adverts')}</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{advertsStats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {advertsStats.active} {t('profile.active')}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('profile.verification')}</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className={`h-4 w-4 ${verified_email ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <span>{t('profile.email')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className={`h-4 w-4 ${verified_phone ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <span>{t('profile.phone')}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('profile.member_since')}</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {created_at ? formatDate(created_at, locale, { year: 'numeric', month: 'short' }) : '-'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Adverts Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.adverts_overview')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{advertsStats.active}</div>
                  <div className="text-sm text-muted-foreground">{t('profile.active')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{advertsStats.draft}</div>
                  <div className="text-sm text-muted-foreground">{t('profile.draft')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{advertsStats.archived}</div>
                  <div className="text-sm text-muted-foreground">{t('profile.archived')}</div>
                </div>
              </div>
              <div className="mt-4">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/profile/adverts">
                    {t('profile.manage_adverts')} →
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.quick_actions')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button asChild variant="outline">
                <Link href="/post">
                  <Package className="mr-2 h-4 w-4" /> {t('profile.post_new_ad')}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/profile/adverts">
                  <BarChart3 className="mr-2 h-4 w-4" /> {t('profile.view_all_adverts')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Adverts Tab */}
        <TabsContent value="adverts" className="pt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('profile.my_adverts')}</CardTitle>
                <Button asChild variant="outline">
                  <Link href="/profile/adverts">{t('profile.view_all')} →</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ProfileAdvertsList adverts={adverts ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.user_reviews')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileReviewsList reviews={reviews ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Favorites Tab */}
        <TabsContent value="favorites" className="pt-6">
          {favoriteItems.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.favorites')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-center text-muted-foreground">
                <p>{t('favorites.empty_state')}</p>
                <p className="text-sm">{t('favorites.empty_action')}</p>
                <Button asChild>
                  <Link href="/search">{t('common.search') || 'Поиск объявлений'}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('profile.favorites')}</CardTitle>
                  <Button asChild variant="outline">
                    <Link href="/profile/favorites">{t('profile.view_all')} →</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <FavoritesComparisonView items={favoriteItems} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="pt-6">
          <div className="grid gap-4">
            {/* Security Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>Безопасность</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Управление биометрией, сессиями и двухфакторной авторизацией
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/profile/security">
                    <Shield className="mr-2 h-4 w-4" /> Настройки безопасности
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Profile Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-950">
                    <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>Профиль</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Редактирование личной информации и настроек отображения
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/profile/edit">
                    <Edit className="mr-2 h-4 w-4" /> Редактировать профиль
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950">
                    <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <CardTitle>Уведомления</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Настройка email и push-уведомлений
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>Email уведомления</span>
                    </div>
                    <Badge variant="secondary">Включены</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span>Сообщения</span>
                    </div>
                    <Badge variant="secondary">Включены</Badge>
                  </div>
                  <p className="pt-2 text-xs text-muted-foreground">
                    Полные настройки уведомлений скоро будут доступны
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}