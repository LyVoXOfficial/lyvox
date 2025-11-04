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
import { type ProfileData } from "@/lib/profileTypes";
import { logger } from "@/lib/errorLogger";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

async function loadProfileData(userId: string): Promise<(ProfileData & { 
  advertsStats: { active: number; draft: number; archived: number; total: number };
}) | null> {
  const supabase = supabaseServer();
  
  // Fetch profile data (adverts linked to auth.users, not profiles - must query separately)
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(
      `
      id,
      display_name,
      created_at,
      verified_email,
      verified_phone
    `
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    logger.error("Failed to fetch profile data", {
      component: "ProfilePage",
      action: "loadProfileData",
      metadata: { userId, errorMessage: profileError.message, errorDetails: profileError.details },
      error: profileError,
    });
    return null;
  }

  if (!profileData) {
    logger.warn("Profile data not found", {
      component: "ProfilePage",
      action: "loadProfileData",
      metadata: { userId },
    });
    return null;
  }

  // Fetch trust score separately
  const { data: trustScoreData } = await supabase
    .from("trust_score")
    .select("score")
    .eq("user_id", userId)
    .maybeSingle();

  const trustScore = trustScoreData?.score ?? 0;

  // Fetch adverts separately (they're linked to auth.users, not profiles)
  const { data: advertsData } = await supabase
    .from("adverts")
    .select("id, title, price, status, created_at, location")
    .eq("user_id", userId);

  const adverts = advertsData || [];

  // Fetch media for all adverts in a single query
  if (adverts.length > 0) {
    const advertIds = adverts.map((a: any) => a.id);
    const { data: mediaData } = await supabase
      .from("media")
      .select("advert_id, url, sort")
      .in("advert_id", advertIds)
      .order("sort", { ascending: true });

    // Attach media to each advert
    if (mediaData) {
      const mediaByAdvert = mediaData.reduce((acc: Record<string, any[]>, media: any) => {
        if (!acc[media.advert_id]) {
          acc[media.advert_id] = [];
        }
        acc[media.advert_id].push({ url: media.url, sort: media.sort });
        return acc;
      }, {});

      adverts.forEach((advert: any) => {
        advert.media = mediaByAdvert[advert.id] || [];
      });
    }
  }

  // Calculate adverts statistics
  const advertsStats = {
    active: adverts.filter((a) => a.status === "active").length,
    draft: adverts.filter((a) => a.status === "draft").length,
    archived: adverts.filter((a) => a.status === "archived").length,
    total: adverts.length,
  };

  const profile: ProfileData & { advertsStats: typeof advertsStats } = {
    ...profileData,
    trust_score: trustScore,
    reviews: [], // Reviews table doesn't exist yet, return empty array
    adverts,
    advertsStats,
  };
  return profile;
}

export default async function ProfilePage() {
  const {
    data: { user },
  } = await supabaseServer().auth.getUser();
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

  const { display_name, created_at, verified_email, verified_phone, trust_score, adverts, reviews, advertsStats } = profile;

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
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profile.dashboard')}</span>
          </TabsTrigger>
          <TabsTrigger value="adverts" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profile.my_adverts')}</span>
            <Badge variant="secondary" className="ml-1">{advertsStats.total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="reviews" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profile.reviews')}</span>
            <Badge variant="secondary" className="ml-1">{reviews?.length ?? 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="favorites" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profile.favorites')}</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profile.settings')}</span>
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
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.favorites')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-10">
                {t('profile.favorites_coming_soon')}
              </p>
            </CardContent>
          </Card>
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