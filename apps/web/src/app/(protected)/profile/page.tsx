import { supabaseServer } from "@/lib/supabaseServer";
import { notFound } from "next/navigation";
import { getI18nProps } from "@/i18n/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Star, Calendar, Mail, Phone, Edit } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/i18n/format";
import { ProfileAdvertsList } from "@/components/profile/ProfileAdvertsList";
import { ProfileReviewsList } from "@/components/profile/ProfileReviewsList";
import { type ProfileData } from "@/lib/profileTypes";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

async function loadProfileData(userId: string): Promise<ProfileData | null> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      display_name,
      created_at,
      verified_email,
      verified_phone,
      trust_score(score),
      adverts(id, title, price, status, created_at, location, media(url, sort)),
      reviews:reviews_received(id, rating, comment, created_at, author:author_id(display_name))
    `
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch profile data:", error);
    return null;
  }

  // A bit of data wrangling to make it easier to work with
  if (!data) return null;

  const trustScore = Array.isArray(data.trust_score)
    ? data.trust_score[0]?.score ?? 0
    : 0;

  // Ensure reviews and adverts are arrays
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  const adverts = Array.isArray(data.adverts) ? data.adverts : [];

  const profile: ProfileData = {
    ...data,
    trust_score: trustScore,
    reviews,
    adverts,
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
        <p>{t("profile.load_error")}</p>
      </main>
    );
  }

  const { display_name, created_at, verified_email, verified_phone, trust_score, adverts, reviews } = profile;

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

      {/* Stats & Info */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('profile.trust_score')}</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trust_score}</div>
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
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('profile.active_listings')}</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adverts?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Listings and Reviews */}
      <Tabs defaultValue="listings">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="listings">{t('profile.listings')} ({adverts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="reviews">{t('profile.reviews')} ({reviews?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="listings" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.user_listings')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileAdvertsList adverts={adverts ?? []} />
            </CardContent>
          </Card>
        </TabsContent>
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
      </Tabs>
    </main>
  );
}