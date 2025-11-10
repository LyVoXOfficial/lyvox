"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { formatCurrency } from "@/i18n/format";
import { formatDate } from "@/i18n/format";
import { CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import BenefitsBadge from "@/components/BenefitsBadge";

interface Purchase {
  id: string;
  product_code: string;
  provider: string;
  status: string;
  amount_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
  products?: {
    code: string;
    name: Record<string, string>;
  } | null;
}

interface Benefit {
  id: string;
  purchase_id: string;
  advert_id: string | null;
  benefit_type: string;
  valid_from: string;
  valid_until: string;
  created_at: string;
}

interface BillingPageClientProps {
  purchases: Purchase[];
  benefits: Benefit[];
  messages: Record<string, any>;
}

export default function BillingPageClient({
  purchases,
  benefits,
}: BillingPageClientProps) {
  const { t, locale } = useI18n();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "refunded":
        return <RefreshCw className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      completed: "default",
      failed: "destructive",
      pending: "secondary",
      refunded: "secondary",
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {getStatusIcon(status)}
        <span className="ml-1">{t(`billing.status.${status}`)}</span>
      </Badge>
    );
  };

  const getProductName = (purchase: Purchase) => {
    if (purchase.products?.name) {
      return purchase.products.name[locale] || purchase.products.name.en || purchase.product_code;
    }
    return purchase.product_code;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("billing.title")}</h1>

      <Tabs defaultValue="purchases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="purchases">{t("billing.tabs.purchases")}</TabsTrigger>
          <TabsTrigger value="benefits">{t("billing.tabs.benefits")}</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="space-y-4">
          {purchases.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t("billing.no_purchases")}
              </CardContent>
            </Card>
          ) : (
            purchases.map((purchase) => (
              <Card key={purchase.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{getProductName(purchase)}</CardTitle>
                    {getStatusBadge(purchase.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("billing.amount")}:</span>
                      <span className="font-semibold">
                        {formatCurrency(
                          purchase.amount_cents / 100,
                          locale,
                          purchase.currency,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("billing.date")}:</span>
                      <span>{formatDate(purchase.created_at, locale, "short")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("billing.provider")}:</span>
                      <span className="uppercase">{purchase.provider}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="benefits" className="space-y-4">
          {benefits.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {t("billing.no_benefits")}
              </CardContent>
            </Card>
          ) : (
            benefits.map((benefit) => (
              <Card key={benefit.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {t(`billing.benefits.${benefit.benefit_type}`)}
                    </CardTitle>
                    <BenefitsBadge benefits={[benefit]} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("billing.valid_until")}:</span>
                      <span>{formatDate(benefit.valid_until, locale, "short")}</span>
                    </div>
                    {benefit.advert_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("billing.advert")}:</span>
                        <span className="truncate">{benefit.advert_id}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

