// apps/web/src/components/trust/TrustGateLogin.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import RegisterForm from "@/app/register/RegisterForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import type { Locale } from "@/lib/i18n";

export default function TrustGateLogin({ onSignedIn, locale }: { onSignedIn: () => void; locale: Locale }) {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => { const v = t(k); return v === k ? fb : v; };
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.session) {
        toast.error(tr("trust.login_failed", "Sign in failed. Check your email and password."));
        return;
      }
      toast.success(tr("trust.signed_in", "Signed in."));
      onSignedIn();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-lg bg-muted/50 p-1 text-sm">
        <button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-md px-3 py-1.5 font-medium ${mode === "login" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
          {tr("trust.tab_login", "Sign in")}
        </button>
        <button type="button" onClick={() => setMode("register")} className={`flex-1 rounded-md px-3 py-1.5 font-medium ${mode === "register" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
          {tr("trust.tab_register", "Create account")}
        </button>
      </div>

      {mode === "login" ? (
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="trust-email">{tr("trust.email", "Email")}</Label>
            <Input id="trust-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trust-password">{tr("trust.password", "Password")}</Label>
            <Input id="trust-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? tr("trust.signing_in", "Signing in…") : tr("trust.tab_login", "Sign in")}
          </Button>
        </form>
      ) : (
        <RegisterForm initialLocale={locale} />
      )}
    </div>
  );
}
