"use client";

import { useState } from "react";
import { useI18n } from "@/i18n";
import { I18nProvider } from "@/i18n";
import type { Locale } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/fetcher";
import { toast } from "sonner";
import { CheckCircle, Loader2 } from "lucide-react";

// ---- Types ----------------------------------------------------------------

type FormData = {
  legal_form: string;
  trade_name: string;
  legal_name: string;
  kbo_number: string;
  vat_liable: boolean;
  vat_number: string;
  email: string;
  phone_e164: string;
  address_line: string;
  postcode: string;
  city: string;
  country: string;
  withdrawal_terms: string;
  returns_url: string;
  self_certified: boolean;
};

type SubmitResult = {
  business_id: string;
  status: string;
  entity_verified: boolean;
  verification: { vies: "verified" | "failed" | "pending" | "n/a" };
};

// ---- Validation helpers (light client-side only) --------------------------

function isValidKbo(input: string): boolean {
  const digits = String(input).replace(/^BE/i, "").replace(/\D/g, "");
  if (!/^[01]\d{9}$/.test(digits)) return false;
  const base = Number(digits.slice(0, 8));
  const check = Number(digits.slice(8, 10));
  return 97 - (base % 97) === check;
}

const POSTCODE_RE = /^[1-9]\d{3}$/;

// ---- Inner wizard (needs I18n context) ------------------------------------

function WizardInner() {
  const { t } = useI18n();
  const tr = (key: string, fallback: string): string => {
    const val = t(key);
    return val === key ? fallback : val;
  };

  const TOTAL_STEPS = 6;
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<FormData>({
    legal_form: "",
    trade_name: "",
    legal_name: "",
    kbo_number: "",
    vat_liable: false,
    vat_number: "",
    email: "",
    phone_e164: "",
    address_line: "",
    postcode: "",
    city: "",
    country: "BE",
    withdrawal_terms: "",
    returns_url: "",
    self_certified: false,
  });

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // ---- Step validation ----------------------------------------------------

  const validateStep = (step: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (step === 2) {
      if (!formData.legal_name.trim()) e.legal_name = tr("pro.identity.required", "This field is required");
      if (!formData.kbo_number.trim()) {
        e.kbo_number = tr("pro.identity.required", "This field is required");
      } else if (!isValidKbo(formData.kbo_number)) {
        e.kbo_number = tr("pro.reg.kbo_invalid", "Invalid KBO number (10 digits, MOD-97 check)");
      }
      if (formData.vat_liable) {
        if (!formData.vat_number.trim()) {
          e.vat_number = tr("pro.identity.required", "This field is required");
        } else if (!isValidKbo(formData.vat_number)) {
          e.vat_number = tr("pro.reg.vat_invalid", "Invalid Belgian VAT number");
        }
      }
    }
    if (step === 3) {
      if (!formData.email.trim()) e.email = tr("pro.identity.required", "This field is required");
    }
    if (step === 4) {
      if (!formData.address_line.trim()) e.address_line = tr("pro.identity.required", "This field is required");
      if (!formData.postcode.trim()) {
        e.postcode = tr("pro.identity.required", "This field is required");
      } else if (!POSTCODE_RE.test(formData.postcode.trim())) {
        e.postcode = tr("pro.address.postcode_invalid", "Belgian postcode must be 4 digits (1000–9999)");
      }
      if (!formData.city.trim()) e.city = tr("pro.identity.required", "This field is required");
    }
    if (step === 5) {
      if (!formData.withdrawal_terms.trim()) e.withdrawal_terms = tr("pro.identity.required", "This field is required");
    }
    if (step === 6) {
      if (!formData.self_certified) e.self_certified = tr("pro.certify.required", "You must confirm this certification");
    }
    return e;
  };

  const handleNext = () => {
    const stepErrors = validateStep(currentStep);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setErrors({});
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  // ---- Submit -------------------------------------------------------------

  const handleSubmit = async () => {
    const stepErrors = validateStep(6);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legal_name: formData.legal_name,
          trade_name: formData.trade_name || undefined,
          legal_form: formData.legal_form || undefined,
          kbo_number: formData.kbo_number,
          vat_number: formData.vat_liable ? formData.vat_number : undefined,
          vat_liable: formData.vat_liable,
          address_line: formData.address_line,
          postcode: formData.postcode,
          city: formData.city,
          country: formData.country || "BE",
          email: formData.email,
          phone_e164: formData.phone_e164 || undefined,
          withdrawal_terms: formData.withdrawal_terms,
          returns_url: formData.returns_url || undefined,
          self_certified: true,
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        const code: string = result.error ?? "";
        if (code === "KBO_IN_USE" || code === "VAT_IN_USE") {
          toast.error(tr("pro.submit.duplicate", "This company is already registered on LyVoX."));
        } else if (code === "VERIFICATION_REQUIRED") {
          toast.error(tr("pro.submit.verify_phone", "Please verify your phone number first."));
        } else {
          toast.error(tr("pro.submit.error", "Something went wrong. Please try again."), {
            description: result.detail ?? result.message ?? code,
          });
        }
        return;
      }

      setSubmitResult(result.data);
      toast.success(tr("pro.submit.success", "Your business account has been created!"));
    } catch (err: any) {
      toast.error(tr("pro.submit.error", "Something went wrong. Please try again."), {
        description: err?.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Completion state ---------------------------------------------------

  if (submitResult) {
    const vies = submitResult.verification?.vies;

    let descriptionText: string;
    if (vies === "verified") {
      descriptionText = tr("pro.done.verified", "Your business is verified — the Verified Business badge is now active on your listings.");
    } else if (vies === "failed") {
      descriptionText = tr("pro.done.failed", "We couldn't verify your VAT number automatically — our team will review it and update your badge shortly.");
    } else if (vies === "pending") {
      descriptionText = tr("pro.done.pending", "Verification in progress — your VAT number is being checked with VIES. Your listings are active in the meantime.");
    } else {
      descriptionText = tr("pro.done.na", "An admin will confirm your registration (no VAT number). Your listings are active in the meantime.");
    }

    return (
      <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-200">
            <CheckCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <CardTitle>{tr("pro.submit.success", "Your business account has been created!")}</CardTitle>
          <CardDescription>{descriptionText}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {tr("pro.status.active_note", "Your business is now active. The verified badge will appear once verification is complete.")}
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---- Progress indicator ------------------------------------------------

  const ProgressBar = () => (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {tr("pro.step", "Step")} {currentStep} {tr("pro.of", "of")} {TOTAL_STEPS}
        </span>
        <span className="text-sm font-bold text-primary tabular-nums">
          {Math.round((currentStep / TOTAL_STEPS) * 100)}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-2.5 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
        />
      </div>
    </div>
  );

  const ErrorMsg = ({ field }: { field: string }) =>
    errors[field] ? <p className="mt-1 text-xs text-destructive">{errors[field]}</p> : null;

  // ---- Step 1: Intro + legal form + trade name ---------------------------

  if (currentStep === 1) {
    return (
      <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">
            {tr("pro.title", "Become a professional seller")}
          </CardTitle>
          <CardDescription>
            {tr("pro.intro.body", "Register your company on LyVoX to unlock professional seller features, a verified business badge, and full compliance with Belgian consumer law.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressBar />
          <div className="space-y-2">
            <Label htmlFor="legal_form">{tr("pro.identity.legal_form", "Legal form")}</Label>
            <Select value={formData.legal_form} onValueChange={(v) => setField("legal_form", v)}>
              <SelectTrigger id="legal_form">
                <SelectValue placeholder={tr("pro.identity.legal_form_placeholder", "Select legal form (optional)")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bv">BV / SRL</SelectItem>
                <SelectItem value="nv">NV / SA</SelectItem>
                <SelectItem value="eenmanszaak">{tr("pro.legal_form.eenmanszaak", "Eenmanszaak / Entreprise individuelle")}</SelectItem>
                <SelectItem value="comm_v">Comm.V / SCS</SelectItem>
                <SelectItem value="vof">VOF / SNC</SelectItem>
                <SelectItem value="other">{tr("pro.legal_form.other", "Other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trade_name">{tr("pro.identity.trade_name", "Trade name (optional)")}</Label>
            <Input
              id="trade_name"
              value={formData.trade_name}
              onChange={(e) => setField("trade_name", e.target.value)}
              placeholder={tr("pro.identity.trade_name_placeholder", "Your brand or shop name")}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button size="lg" onClick={handleNext}>
            {tr("pro.next", "Next")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // ---- Step 2: Company identity (KBO + VAT) -------------------------------

  if (currentStep === 2) {
    return (
      <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">
            {tr("pro.intro.heading", "Company identity")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressBar />
          <div className="space-y-2">
            <Label htmlFor="legal_name">{tr("pro.identity.legal_name", "Legal name")} *</Label>
            <Input
              id="legal_name"
              value={formData.legal_name}
              onChange={(e) => setField("legal_name", e.target.value)}
              placeholder={tr("pro.identity.legal_name_placeholder", "Registered company name")}
            />
            <ErrorMsg field="legal_name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kbo_number">{tr("pro.reg.kbo", "KBO / CBE number")} *</Label>
            <Input
              id="kbo_number"
              value={formData.kbo_number}
              onChange={(e) => setField("kbo_number", e.target.value)}
              placeholder="0123456789"
            />
            <ErrorMsg field="kbo_number" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="vat_liable"
              checked={formData.vat_liable}
              onCheckedChange={(checked) => setField("vat_liable", !!checked)}
            />
            <Label htmlFor="vat_liable">{tr("pro.reg.vat_liable", "This company is VAT-registered")}</Label>
          </div>
          {formData.vat_liable && (
            <div className="space-y-2">
              <Label htmlFor="vat_number">{tr("pro.reg.vat", "VAT number")} *</Label>
              <Input
                id="vat_number"
                value={formData.vat_number}
                onChange={(e) => setField("vat_number", e.target.value)}
                placeholder="BE0123456789"
              />
              <ErrorMsg field="vat_number" />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>{tr("pro.back", "Back")}</Button>
          <Button size="lg" onClick={handleNext}>{tr("pro.next", "Next")}</Button>
        </CardFooter>
      </Card>
    );
  }

  // ---- Step 3: Contact ---------------------------------------------------

  if (currentStep === 3) {
    return (
      <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">
            {tr("pro.contact.heading", "Contact information")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressBar />
          <div className="space-y-2">
            <Label htmlFor="email">{tr("pro.contact.email", "Business email")} *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="info@yourcompany.be"
            />
            <ErrorMsg field="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone_e164">{tr("pro.contact.phone", "Business phone (optional)")}</Label>
            <Input
              id="phone_e164"
              type="tel"
              value={formData.phone_e164}
              onChange={(e) => setField("phone_e164", e.target.value)}
              placeholder="+32 2 000 00 00"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>{tr("pro.back", "Back")}</Button>
          <Button size="lg" onClick={handleNext}>{tr("pro.next", "Next")}</Button>
        </CardFooter>
      </Card>
    );
  }

  // ---- Step 4: Address ---------------------------------------------------

  if (currentStep === 4) {
    return (
      <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">
            {tr("pro.address.heading", "Business address")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressBar />
          <div className="space-y-2">
            <Label htmlFor="address_line">{tr("pro.address.line", "Street and number")} *</Label>
            <Input
              id="address_line"
              value={formData.address_line}
              onChange={(e) => setField("address_line", e.target.value)}
              placeholder={tr("pro.address.line_placeholder", "Wetstraat 1")}
            />
            <ErrorMsg field="address_line" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postcode">{tr("pro.address.postcode", "Postcode")} *</Label>
              <Input
                id="postcode"
                value={formData.postcode}
                onChange={(e) => setField("postcode", e.target.value)}
                placeholder="1000"
                maxLength={4}
              />
              <ErrorMsg field="postcode" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{tr("pro.address.city", "City")} *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setField("city", e.target.value)}
                placeholder="Brussels"
              />
              <ErrorMsg field="city" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">{tr("pro.address.country", "Country")}</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => setField("country", e.target.value)}
              placeholder="BE"
              maxLength={2}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>{tr("pro.back", "Back")}</Button>
          <Button size="lg" onClick={handleNext}>{tr("pro.next", "Next")}</Button>
        </CardFooter>
      </Card>
    );
  }

  // ---- Step 5: Consumer terms --------------------------------------------

  if (currentStep === 5) {
    return (
      <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">
            {tr("pro.terms.heading", "Consumer law terms")}
          </CardTitle>
          <CardDescription>
            {tr("pro.terms.withdrawal_help", "Belgian consumer law (CEL VI.45/VI.83) requires you to offer a 14-day right of withdrawal to consumers. Describe your withdrawal and return policy.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressBar />
          <div className="space-y-2">
            <Label htmlFor="withdrawal_terms">{tr("pro.terms.withdrawal", "Withdrawal & return policy")} *</Label>
            <Textarea
              id="withdrawal_terms"
              value={formData.withdrawal_terms}
              onChange={(e) => setField("withdrawal_terms", e.target.value)}
              placeholder={tr("pro.terms.withdrawal_placeholder", "Consumers have the right to withdraw from a purchase within 14 days without giving a reason...")}
              rows={5}
            />
            <ErrorMsg field="withdrawal_terms" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="returns_url">{tr("pro.terms.returns_url", "Returns policy URL (optional)")}</Label>
            <Input
              id="returns_url"
              type="url"
              value={formData.returns_url}
              onChange={(e) => setField("returns_url", e.target.value)}
              placeholder="https://yourcompany.be/returns"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>{tr("pro.back", "Back")}</Button>
          <Button size="lg" onClick={handleNext}>{tr("pro.next", "Next")}</Button>
        </CardFooter>
      </Card>
    );
  }

  // ---- Step 6: Review + self-certification + submit ----------------------

  return (
    <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="text-2xl font-extrabold tracking-tight">
          {tr("pro.review.heading", "Review and confirm")}
        </CardTitle>
        <CardDescription>
          {tr("pro.review.body", "Please review your information before submitting.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProgressBar />
        <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm space-y-2">
          <div><span className="font-medium">{tr("pro.identity.legal_name", "Legal name")}:</span> {formData.legal_name}</div>
          {formData.trade_name && (
            <div><span className="font-medium">{tr("pro.identity.trade_name", "Trade name")}:</span> {formData.trade_name}</div>
          )}
          {formData.legal_form && (
            <div><span className="font-medium">{tr("pro.identity.legal_form", "Legal form")}:</span> {formData.legal_form}</div>
          )}
          <div><span className="font-medium">{tr("pro.reg.kbo", "KBO number")}:</span> {formData.kbo_number}</div>
          {formData.vat_liable && formData.vat_number && (
            <div><span className="font-medium">{tr("pro.reg.vat", "VAT number")}:</span> {formData.vat_number}</div>
          )}
          <div><span className="font-medium">{tr("pro.contact.email", "Email")}:</span> {formData.email}</div>
          <div>
            <span className="font-medium">{tr("pro.address.line", "Address")}:</span>{" "}
            {formData.address_line}, {formData.postcode} {formData.city}, {formData.country}
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-4">
          <Checkbox
            id="self_certified"
            checked={formData.self_certified}
            onCheckedChange={(checked) => setField("self_certified", !!checked)}
            className="mt-0.5"
          />
          <Label htmlFor="self_certified" className="cursor-pointer text-sm leading-snug">
            {tr("pro.certify.label", "I confirm that the information provided is accurate and complete. I am an authorised representative of this business and I accept responsibility for compliance with Belgian consumer law obligations.")}
          </Label>
        </div>
        <ErrorMsg field="self_certified" />
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={isLoading}>
          {tr("pro.back", "Back")}
        </Button>
        <Button size="lg" onClick={handleSubmit} disabled={isLoading || !formData.self_certified}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {tr("pro.submit_label", "Submit registration")}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---- Public wrapper (provides I18n context) --------------------------------

type Props = {
  locale: Locale;
  messages: Record<string, any>;
};

export function ProOnboardingWizard({ locale, messages }: Props) {
  return (
    <I18nProvider locale={locale} messages={messages}>
      <WizardInner />
    </I18nProvider>
  );
}
