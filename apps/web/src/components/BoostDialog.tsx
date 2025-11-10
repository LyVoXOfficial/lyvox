"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { formatCurrency } from "@/i18n/format";
import { Loader2 } from "lucide-react";

interface Product {
  code: string;
  name: Record<string, string>;
  price_cents: number;
  currency: string;
}

interface BoostDialogProps {
  advertId?: string;
  trigger?: React.ReactNode;
}

export default function BoostDialog({ advertId, trigger }: BoostDialogProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);

  useEffect(() => {
    if (open) {
      loadProducts();
    }
  }, [open]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      // In a real implementation, you would fetch products from an API
      // For now, we'll use hardcoded products that should exist in the database
      const response = await fetch("/api/billing/products");
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setProducts(data.data.products || []);
        }
      }
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBoost = async (productCode: string) => {
    setIsCreatingCheckout(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_code: productCode,
          advert_id: advertId,
        }),
      });

      const data = await response.json();

      if (data.ok && data.data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.data.url;
      } else {
        console.error("Failed to create checkout:", data.error);
        alert(t("billing.checkout.error"));
      }
    } catch (error) {
      console.error("Failed to create checkout:", error);
      alert(t("billing.checkout.error"));
    } finally {
      setIsCreatingCheckout(false);
    }
  };

  const getProductName = (product: Product) => {
    return product.name[locale] || product.name.en || product.code;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("billing.boost.title")}</DialogTitle>
          <DialogDescription>{t("billing.boost.description")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            {t("billing.boost.no_products")}
          </div>
        ) : (
          <div className="space-y-3">
            {products
              .filter((p) => p.code.startsWith("boost"))
              .map((product) => (
                <Card
                  key={product.code}
                  className={`cursor-pointer transition-colors ${
                    selectedProduct === product.code
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedProduct(product.code)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{getProductName(product)}</h3>
                        <p className="text-sm text-muted-foreground">
                          {t("billing.boost.features")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          {formatCurrency(
                            product.price_cents / 100,
                            locale,
                            product.currency,
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

            <Button
              className="w-full"
              onClick={() => {
                if (selectedProduct) {
                  handleBoost(selectedProduct);
                }
              }}
              disabled={!selectedProduct || isCreatingCheckout}
            >
              {isCreatingCheckout ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("billing.checkout.processing")}
                </>
              ) : (
                t("billing.checkout.proceed")
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

