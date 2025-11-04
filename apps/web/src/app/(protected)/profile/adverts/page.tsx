"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Trash2, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { logger } from "@/lib/errorLogger";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AdvertStatus = "all" | "active" | "draft" | "archived";

type Advert = {
  id: string;
  title: string;
  price: number | null;
  status: string | null;
  created_at: string;
  location: string | null;
  media: { url: string | null; sort: number | null }[] | null;
};

type AdvertsResponse = {
  ok: boolean;
  data?: {
    adverts: Advert[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
};

const ITEMS_PER_PAGE = 12;

export default function MyAdvertsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [adverts, setAdverts] = useState<Advert[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<AdvertStatus>("all");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; advertId: string | null }>({
    open: false,
    advertId: null,
  });

  // Read initial state from URL
  useEffect(() => {
    const page = parseInt(searchParams.get("page") || "1", 10);
    const status = (searchParams.get("status") || "all") as AdvertStatus;
    setCurrentPage(page);
    setStatusFilter(status);
  }, [searchParams]);

  // Fetch adverts
  useEffect(() => {
    async function fetchAdverts() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", currentPage.toString());
        params.set("pageSize", ITEMS_PER_PAGE.toString());
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }

        const response = await fetch(`/api/profile/adverts?${params.toString()}`);
        const result: AdvertsResponse = await response.json();

        if (result.ok && result.data) {
          setAdverts(result.data.adverts);
          setTotal(result.data.total);
        } else {
          logger.error("Failed to fetch adverts", {
            component: "ProfileAdvertsPage",
            action: "fetchAdverts",
            metadata: { page: currentPage, status: statusFilter },
            error: result.error,
          });
          setAdverts([]);
          setTotal(0);
        }
      } catch (error) {
        logger.error("Error fetching adverts", {
          component: "ProfileAdvertsPage",
          action: "fetchAdverts",
          metadata: { page: currentPage, status: statusFilter },
          error,
        });
        setAdverts([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }

    fetchAdverts();
  }, [currentPage, statusFilter]);

  // Update URL when filters change
  const updateFilters = (newStatus: AdvertStatus, newPage: number = 1) => {
    const params = new URLSearchParams();
    if (newStatus !== "all") {
      params.set("status", newStatus);
    }
    if (newPage > 1) {
      params.set("page", newPage.toString());
    }
    router.push(`/profile/adverts?${params.toString()}`);
  };

  const handleStatusChange = (value: string) => {
    const newStatus = value as AdvertStatus;
    setStatusFilter(newStatus);
    updateFilters(newStatus, 1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    updateFilters(statusFilter, newPage);
  };

  const handleDelete = async () => {
    if (!deleteDialog.advertId) return;

    try {
      const response = await fetch(`/api/adverts/${deleteDialog.advertId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Refresh the list
        const params = new URLSearchParams();
        params.set("page", currentPage.toString());
        params.set("pageSize", ITEMS_PER_PAGE.toString());
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }

        const refreshResponse = await fetch(`/api/profile/adverts?${params.toString()}`);
        const result: AdvertsResponse = await refreshResponse.json();

        if (result.ok && result.data) {
          setAdverts(result.data.adverts);
          setTotal(result.data.total);
        }
      } else {
        logger.error("Failed to delete advert", {
          component: "ProfileAdvertsPage",
          action: "handleDelete",
          metadata: { advertId: deleteDialog.advertId },
        });
      }
    } catch (error) {
      logger.error("Error deleting advert", {
        component: "ProfileAdvertsPage",
        action: "handleDelete",
        metadata: { advertId: deleteDialog.advertId },
        error,
      });
    } finally {
      setDeleteDialog({ open: false, advertId: null });
    }
  };

  const handleDuplicate = async (advertId: string) => {
    try {
      // Fetch the advert first
      const response = await fetch(`/api/adverts/${advertId}`);
      const result = await response.json();

      if (result.ok && result.data) {
        // Navigate to post page with edit mode and duplicate flag
        router.push(`/post?duplicate=${advertId}`);
      }
    } catch (error) {
      logger.error("Error duplicating advert", {
        component: "ProfileAdvertsPage",
        action: "handleDuplicate",
        metadata: { advertId },
        error,
      });
    }
  };

  const pickImage = (media: Advert["media"]): string => {
    if (!media?.length) {
      return "/placeholder.png";
    }
    const sorted = [...media].sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99));
    return sorted[0]?.url ?? "/placeholder.png";
  };

  const getStatusBadgeVariant = (status: string | null): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "active":
        return "default";
      case "draft":
        return "secondary";
      case "archived":
        return "outline";
      default:
        return "secondary";
    }
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <main className="container mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("profile.my_adverts")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("profile.manage_all_adverts")} ({total})
          </p>
        </div>
        <Button asChild>
          <Link href="/post">
            {t("profile.post_new_ad")}
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>{t("profile.filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">{t("profile.status")}</label>
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("profile.all_statuses")}</SelectItem>
                  <SelectItem value="active">{t("profile.active")}</SelectItem>
                  <SelectItem value="draft">{t("profile.draft")}</SelectItem>
                  <SelectItem value="archived">{t("profile.archived")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adverts List */}
      {loading ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      ) : adverts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10">
            <p className="text-muted-foreground">{t("profile.no_adverts_found")}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/post">{t("profile.post_first_ad")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {adverts.map((advert) => (
              <Card key={advert.id} className="overflow-hidden">
                <div className="relative aspect-video w-full bg-muted">
                  <Link href={`/ad/${advert.id}`}>
                    <Image
                      src={pickImage(advert.media)}
                      alt={advert.title}
                      fill
                      className="object-cover"
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/placeholder.png";
                      }}
                    />
                    <div className="absolute top-2 right-2">
                      <Badge variant={getStatusBadgeVariant(advert.status)}>
                        {advert.status || "unknown"}
                      </Badge>
                    </div>
                  </Link>
                </div>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold line-clamp-2">
                      <Link href={`/ad/${advert.id}`} className="hover:underline">
                        {advert.title}
                      </Link>
                    </h3>
                    <p className="text-lg font-bold mt-1">
                      {advert.price ? `${advert.price.toLocaleString()} €` : t("profile.price_not_set")}
                    </p>
                    {advert.location && (
                      <p className="text-sm text-muted-foreground truncate">{advert.location}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Link href={`/post?edit=${advert.id}`}>
                        <Edit className="mr-1 h-3 w-3" />
                        {t("profile.edit")}
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicate(advert.id)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteDialog({ open: true, advertId: advert.id })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("common.previous")}
              </Button>
              <div className="text-sm text-muted-foreground">
                {t("profile.page")} {currentPage} {t("common.of")} {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                {t("common.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, advertId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("profile.delete_advert_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("profile.delete_advert_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

