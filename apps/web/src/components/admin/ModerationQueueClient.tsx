"use client";

import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Flag, Loader2, Eye, Zap } from "lucide-react";
import { formatCurrency } from "@/i18n/format";
import { formatDate } from "@/i18n/format";
import Link from "next/link";

type Advert = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  status: string;
  moderation_status: string;
  ai_moderation_score: number | null;
  ai_moderation_reason: string | null;
  created_at: string;
  user_id: string;
  profiles: {
    display_name: string | null;
    verified_email: boolean;
    verified_phone: boolean;
  } | null;
  categories: {
    name_en: string | null;
    name_nl: string | null;
    name_fr: string | null;
    name_de: string | null;
    name_ru: string | null;
  } | null;
};

interface ModerationQueueClientProps {
  initialAdverts: Advert[];
  t: (key: string) => string;
  locale: string;
}

export default function ModerationQueueClient({
  initialAdverts,
  t,
  locale,
}: ModerationQueueClientProps) {
  const [adverts, setAdverts] = useState<Advert[]>(initialAdverts);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAdvert, setSelectedAdvert] = useState<Advert | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "flag" | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);

  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const statusParam = statusFilter === "all" ? "all" : statusFilter;
      const response = await fetch(`/api/moderation/queue?status=${statusParam}&limit=50`);
      const data = await response.json();

      if (data.ok) {
        setAdverts(data.data.adverts || []);
      }
    } catch (error) {
      console.error("Failed to load moderation queue:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [statusFilter]);

  const handleAnalyze = async (advertId: string) => {
    setIsAnalyzing(advertId);
    try {
      const response = await fetch("/api/moderation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advert_id: advertId }),
      });

      const data = await response.json();
      if (data.ok) {
        // Reload queue to show updated scores
        await loadQueue();
      } else {
        alert(t("admin.moderation.analyze_error") || "Failed to analyze");
      }
    } catch (error) {
      console.error("Failed to analyze:", error);
      alert(t("admin.moderation.analyze_error") || "Failed to analyze");
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleReview = async () => {
    if (!selectedAdvert || !reviewAction) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/moderation/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advert_id: selectedAdvert.id,
          action: reviewAction,
          reason: reviewReason || null,
        }),
      });

      const data = await response.json();
      if (data.ok) {
        setIsReviewDialogOpen(false);
        setIsDetailOpen(false);
        setSelectedAdvert(null);
        setReviewReason("");
        await loadQueue();
      } else {
        alert(t("admin.moderation.review_error") || "Failed to review");
      }
    } catch (error) {
      console.error("Failed to review:", error);
      alert(t("admin.moderation.review_error") || "Failed to review");
    } finally {
      setIsLoading(false);
    }
  };

  const openReviewDialog = (advert: Advert, action: "approve" | "reject" | "flag") => {
    setSelectedAdvert(advert);
    setReviewAction(action);
    setReviewReason("");
    setIsReviewDialogOpen(true);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      case "flagged":
        return "secondary";
      case "pending_review":
        return "outline";
      default:
        return "outline";
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score < 30) return "text-green-600";
    if (score < 70) return "text-yellow-600";
    return "text-red-600";
  };

  const filteredAdverts = adverts.filter((advert) => {
    if (statusFilter === "all") return true;
    return advert.moderation_status === statusFilter;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("admin.moderation.title") || "Moderation Queue"}</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.moderation.all") || "All"}</SelectItem>
                <SelectItem value="pending">
                  {t("admin.moderation.pending") || "Pending"}
                </SelectItem>
                <SelectItem value="pending_review">
                  {t("admin.moderation.pending_review") || "Pending Review"}
                </SelectItem>
                <SelectItem value="flagged">{t("admin.moderation.flagged") || "Flagged"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : filteredAdverts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {t("admin.moderation.empty") || "No adverts in queue"}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAdverts.map((advert) => (
                <Card key={advert.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          <Link
                            href={`/ad/${advert.id}`}
                            className="hover:underline"
                            target="_blank"
                          >
                            {advert.title}
                          </Link>
                        </h3>
                        <Badge variant={getStatusBadgeVariant(advert.moderation_status)}>
                          {advert.moderation_status}
                        </Badge>
                      </div>
                      {advert.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {advert.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        {advert.price && (
                          <span className="font-semibold">
                            {formatCurrency(advert.price, locale, advert.currency || "EUR")}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {formatDate(advert.created_at, locale)}
                        </span>
                        {advert.profiles && (
                          <span className="text-muted-foreground">
                            {advert.profiles.display_name || "Unknown"}
                          </span>
                        )}
                      </div>
                      {advert.ai_moderation_score !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">AI Score:</span>
                          <span className={`text-sm font-semibold ${getScoreColor(advert.ai_moderation_score)}`}>
                            {advert.ai_moderation_score}/100
                          </span>
                          {advert.ai_moderation_reason && (
                            <span className="text-xs text-muted-foreground">
                              {advert.ai_moderation_reason}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAdvert(advert);
                          setIsDetailOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {t("admin.moderation.view") || "View"}
                      </Button>
                      {advert.ai_moderation_score === null && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAnalyze(advert.id)}
                          disabled={isAnalyzing === advert.id}
                        >
                          {isAnalyzing === advert.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4 mr-1" />
                          )}
                          {t("admin.moderation.analyze") || "Analyze"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReviewDialog(advert, "approve")}
                      >
                        <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                        {t("admin.moderation.approve") || "Approve"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReviewDialog(advert, "reject")}
                      >
                        <XCircle className="h-4 w-4 mr-1 text-red-600" />
                        {t("admin.moderation.reject") || "Reject"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReviewDialog(advert, "flag")}
                      >
                        <Flag className="h-4 w-4 mr-1" />
                        {t("admin.moderation.flag") || "Flag"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedAdvert?.title}</DialogTitle>
            <DialogDescription>
              {t("admin.moderation.detail_description") || "Review advert details"}
            </DialogDescription>
          </DialogHeader>
          {selectedAdvert && (
            <div className="space-y-4">
              <div>
                <Label>{t("admin.moderation.description") || "Description"}</Label>
                <p className="text-sm mt-1">{selectedAdvert.description || "No description"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("admin.moderation.price") || "Price"}</Label>
                  <p className="text-sm mt-1">
                    {selectedAdvert.price
                      ? formatCurrency(selectedAdvert.price, locale, selectedAdvert.currency || "EUR")
                      : "Not set"}
                  </p>
                </div>
                <div>
                  <Label>{t("admin.moderation.created_at") || "Created"}</Label>
                  <p className="text-sm mt-1">{formatDate(selectedAdvert.created_at, locale)}</p>
                </div>
              </div>
              {selectedAdvert.ai_moderation_score !== null && (
                <div>
                  <Label>{t("admin.moderation.ai_score") || "AI Moderation Score"}</Label>
                  <div className="mt-1">
                    <span className={`text-lg font-semibold ${getScoreColor(selectedAdvert.ai_moderation_score)}`}>
                      {selectedAdvert.ai_moderation_score}/100
                    </span>
                    {selectedAdvert.ai_moderation_reason && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedAdvert.ai_moderation_reason}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  {t("common.close") || "Close"}
                </Button>
                <Button
                  onClick={() => {
                    setIsDetailOpen(false);
                    openReviewDialog(selectedAdvert, "approve");
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {t("admin.moderation.approve") || "Approve"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setIsDetailOpen(false);
                    openReviewDialog(selectedAdvert, "reject");
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  {t("admin.moderation.reject") || "Reject"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <AlertDialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reviewAction === "approve"
                ? t("admin.moderation.confirm_approve") || "Approve Advert?"
                : reviewAction === "reject"
                  ? t("admin.moderation.confirm_reject") || "Reject Advert?"
                  : t("admin.moderation.confirm_flag") || "Flag Advert?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.moderation.confirm_description") ||
                "Please provide a reason for this action (optional)"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="reason">
                {t("admin.moderation.reason") || "Reason (optional)"}
              </Label>
              <Textarea
                id="reason"
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder={t("admin.moderation.reason_placeholder") || "Enter reason..."}
                className="mt-1"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReview} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("common.confirm") || "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

