"use client";

import { useState } from "react";
import { I18nProvider, useI18n } from "@/i18n";
import type { Locale } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/fetcher";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// ---- Types ----------------------------------------------------------------

export type BusinessEditInitial = {
  trade_name: string | null;
  legal_form: string | null;
  address_line: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  phone_e164: string | null;
  withdrawal_terms: string | null;
  returns_url: string | null;
};

type FormData = {
  trade_name: string;
  legal_form: string;
  address_line: string;
  postcode: string;
  city: string;
  country: string;
  email: string;
  phone_e164: string;
  withdrawal_terms: string;
  returns_url: string;
};

// ---- Validation -----------------------------------------------------------

const POSTCODE_RE = /^[1-9]\d{3}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- Inner form (needs I18n context) --------------------------------------

function EditFormInner({
  businessId,
  initial,
}: {
  businessId: string;
  initial: BusinessEditInitial;
}) {
  const { t } = useI18n();
  const tr = (key: string, fallback: string): string => {
    const val = t(key);
    return val === key ? fallback : val;
  };

  const [formData, setFormData] = useState<FormData>({
    trade_name: initial.trade_name ?? "",
    legal_form: initial.legal_form ?? "",
    address_line: initial.address_line ?? "",
    postcode: initial.postcode ?? "",
    city: initial.city ?? "",
    country: initial.country ?? "",
    email: initial.email ?? "",
    phone_e164: initial.phone_e164 ?? "",
    withdrawal_terms: initial.withdrawal_terms ?? "",
    returns_url: initial.returns_url ?? "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    const postcode = formData.postcode.trim();
    if (postcode && !POSTCODE_RE.test(postcode)) {
      e.postcode = tr("pro.cabinet.edit.postcode_invalid", "Belgian postcode must be 4 digits (1000–9999)");
    }
    const email = formData.email.trim();
    if (email && !EMAIL_RE.test(email)) {
      e.email = tr("pro.cabinet.edit.email_invalid", "Please enter a valid email address");
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Build patch body: only send fields that differ from initial and are non-empty
    const patch: Partial<Record<keyof FormData, string>> = {};

    const keys: (keyof FormData)[] = [
      "trade_name",
      "legal_form",
      "address_line",
      "postcode",
      "city",
      "country",
      "email",
      "phone_e164",
      "withdrawal_terms",
    ];

    for (const key of keys) {
      const current = formData[key].trim();
      const orig = (initial[key] ?? "").trim();
      if (current !== orig) {
        if (current !== "") {
          patch[key] = current;
        }
      }
    }

    // returns_url: omit empty string, send undefined if cleared
    const returnsUrl = formData.returns_url.trim();
    const origReturnsUrl = (initial.returns_url ?? "").trim();
    if (returnsUrl !== origReturnsUrl) {
      if (returnsUrl !== "") {
        patch.returns_url = returnsUrl;
      }
      // if cleared to empty, we simply don't include it
      // (server treats absent key as "unchanged"; clearing is a no-op for now
      //  per spec: "Convert empty returns_url to omitted (don't send "")")
    }

    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/business/${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const result: { ok: boolean; error?: string; detail?: string; message?: string } =
        await response.json();

      if (!result.ok) {
        const code = result.error ?? "";
        if (code === "FORBIDDEN") {
          toast.error(tr("pro.cabinet.edit.error_forbidden", "Only the business owner can edit these details"));
        } else {
          toast.error(tr("pro.cabinet.edit.error_generic", "Something went wrong. Please try again."), {
            description: result.detail ?? result.message ?? code,
          });
        }
        return;
      }

      toast.success(tr("pro.cabinet.edit.success", "Business details updated successfully"));
      window.location.reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined;
      toast.error(tr("pro.cabinet.edit.error_generic", "Something went wrong. Please try again."), {
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const ErrorMsg = ({ field }: { field: string }) =>
    errors[field] ? <p className="mt-1 text-xs text-destructive">{errors[field]}</p> : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("pro.cabinet.edit.heading", "Edit business details")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Trade name */}
          <div className="space-y-2">
            <Label htmlFor="edit_trade_name">{tr("pro.cabinet.edit.trade_name", "Trade name")}</Label>
            <Input
              id="edit_trade_name"
              value={formData.trade_name}
              onChange={(e) => setField("trade_name", e.target.value)}
              placeholder={tr("pro.cabinet.edit.trade_name_placeholder", "Your brand or shop name")}
            />
          </div>

          {/* Legal form */}
          <div className="space-y-2">
            <Label htmlFor="edit_legal_form">{tr("pro.cabinet.edit.legal_form", "Legal form")}</Label>
            <Input
              id="edit_legal_form"
              value={formData.legal_form}
              onChange={(e) => setField("legal_form", e.target.value)}
              placeholder={tr("pro.cabinet.edit.legal_form_placeholder", "e.g. BV, NV, Eenmanszaak")}
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="edit_address_line">{tr("pro.cabinet.edit.address_line", "Street and number")}</Label>
            <Input
              id="edit_address_line"
              value={formData.address_line}
              onChange={(e) => setField("address_line", e.target.value)}
              placeholder={tr("pro.cabinet.edit.address_line_placeholder", "Wetstraat 1")}
            />
          </div>

          {/* Postcode + City */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_postcode">{tr("pro.cabinet.edit.postcode", "Postcode")}</Label>
              <Input
                id="edit_postcode"
                value={formData.postcode}
                onChange={(e) => setField("postcode", e.target.value)}
                placeholder="1000"
                maxLength={4}
              />
              <ErrorMsg field="postcode" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_city">{tr("pro.cabinet.edit.city", "City")}</Label>
              <Input
                id="edit_city"
                value={formData.city}
                onChange={(e) => setField("city", e.target.value)}
                placeholder="Brussels"
              />
            </div>
          </div>

          {/* Country */}
          <div className="space-y-2">
            <Label htmlFor="edit_country">{tr("pro.cabinet.edit.country", "Country")}</Label>
            <Input
              id="edit_country"
              value={formData.country}
              onChange={(e) => setField("country", e.target.value)}
              placeholder="BE"
              maxLength={2}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="edit_email">{tr("pro.cabinet.edit.email", "Business email")}</Label>
            <Input
              id="edit_email"
              type="email"
              value={formData.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="info@yourcompany.be"
            />
            <ErrorMsg field="email" />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="edit_phone_e164">{tr("pro.cabinet.edit.phone_e164", "Business phone")}</Label>
            <Input
              id="edit_phone_e164"
              type="tel"
              value={formData.phone_e164}
              onChange={(e) => setField("phone_e164", e.target.value)}
              placeholder="+32 2 000 00 00"
            />
          </div>

          {/* Withdrawal terms */}
          <div className="space-y-2">
            <Label htmlFor="edit_withdrawal_terms">{tr("pro.cabinet.edit.withdrawal_terms", "Withdrawal & return policy")}</Label>
            <Textarea
              id="edit_withdrawal_terms"
              value={formData.withdrawal_terms}
              onChange={(e) => setField("withdrawal_terms", e.target.value)}
              placeholder={tr("pro.cabinet.edit.withdrawal_terms_placeholder", "Consumers have the right to withdraw from a purchase within 14 days...")}
              rows={4}
            />
          </div>

          {/* Returns URL */}
          <div className="space-y-2">
            <Label htmlFor="edit_returns_url">{tr("pro.cabinet.edit.returns_url", "Returns policy URL (optional)")}</Label>
            <Input
              id="edit_returns_url"
              type="url"
              value={formData.returns_url}
              onChange={(e) => setField("returns_url", e.target.value)}
              placeholder="https://yourcompany.be/returns"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {tr("pro.cabinet.edit.save", "Save changes")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---- Public wrapper (provides I18n context) --------------------------------

type Props = {
  businessId: string;
  initial: BusinessEditInitial;
  locale: Locale;
  messages: Record<string, unknown>;
};

export function BusinessEditForm({ businessId, initial, locale, messages }: Props) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <I18nProvider locale={locale} messages={messages as Record<string, any>}>
      <EditFormInner businessId={businessId} initial={initial} />
    </I18nProvider>
  );
}
