import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { deriveTrustTier } from "@/lib/trust/trustTier";
import { TrustScoreBadge } from "@/components/trust/TrustScoreBadge";
import { TrustScoreRefreshButton } from "@/components/trust/TrustScoreRefreshButton";
import { formatDate } from "@/i18n/format";
import { type Locale } from "@/lib/i18n";

interface TrustScoreCardProps {
  score: number;
  lastComputedAt: string | null;
  verifiedEmail: boolean;
  verifiedPhone: boolean;
  itsmeVerified: boolean;
  createdAt: string | null;
  activeListingsCount: number;
  isOwnProfile: boolean;
  locale: Locale;
  t: (key: string) => string;
}

function FactRow({ verified, label }: { verified: boolean; label: string }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "13px",
        padding: "4px 0",
        color: verified ? "var(--foreground)" : "var(--muted-foreground)",
      }}
    >
      {verified ? (
        <CheckCircle2
          className="h-4 w-4 flex-none"
          style={{ color: "oklch(0.56 0.13 178)" }}
          aria-hidden="true"
        />
      ) : (
        <XCircle className="h-4 w-4 flex-none" style={{ color: "var(--muted-foreground)" }} aria-hidden="true" />
      )}
      {label}
    </li>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "13px",
        padding: "4px 0",
        color: "var(--foreground)",
      }}
    >
      <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </li>
  );
}

export function TrustScoreCard({
  score,
  lastComputedAt,
  verifiedEmail,
  verifiedPhone,
  itsmeVerified,
  createdAt,
  activeListingsCount,
  isOwnProfile,
  locale,
  t,
}: TrustScoreCardProps) {
  // tier is derived but only used implicitly via TrustScoreBadge
  void deriveTrustTier(score);

  const lastUpdatedText = lastComputedAt
    ? t("trust_score.last_updated").replace(
        "{date}",
        formatDate(lastComputedAt, locale, { year: "numeric", month: "short", day: "numeric" }),
      )
    : t("trust_score.last_updated_never");

  const allVerified = verifiedEmail && verifiedPhone && itsmeVerified;

  const improvementTips: string[] = [];
  if (!verifiedEmail) improvementTips.push(t("trust_score.improve_verify_email"));
  if (!verifiedPhone) improvementTips.push(t("trust_score.improve_verify_phone"));
  if (!itsmeVerified) improvementTips.push(t("trust_score.improve_verify_itsme"));

  return (
    <section
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r)",
        padding: "18px",
        boxShadow: "var(--shS)",
      }}
      aria-label={t("trust_score.card_title")}
    >
      {/* Title + tier badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {t("trust_score.card_title")}
        </span>
        <TrustScoreBadge score={score} t={t} />
      </div>

      {/* Score number */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "4px" }}>
        <span className="tabular-nums" style={{ fontWeight: 800, fontSize: "28px", lineHeight: 1, letterSpacing: "-0.02em" }}>
          {score}
        </span>
        <span style={{ fontSize: "14px", color: "var(--muted-foreground)", fontWeight: 500 }}>/100</span>
      </div>

      <p style={{ margin: "0 0 12px", fontSize: "11px", color: "var(--muted-foreground)" }}>
        {lastUpdatedText}
      </p>

      {/* Divider */}
      <div style={{ height: "1px", background: "var(--border)", marginBottom: "12px" }} />

      {/* Verifiable component facts */}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        <FactRow verified={itsmeVerified} label={t("trust_score.fact_id_verified")} />
        <FactRow verified={verifiedPhone} label={t("trust_score.fact_phone_verified")} />
        <FactRow verified={verifiedEmail} label={t("trust_score.fact_email_verified")} />
        <InfoRow
          label={t("trust_score.fact_deals")}
          value={`0 — ${t("trust_score.fact_deals_soon")}`}
        />
        {createdAt && (
          <InfoRow
            label={t("trust_score.fact_member_since")}
            value={formatDate(createdAt, locale, { year: "numeric", month: "short" })}
          />
        )}
        <InfoRow label={t("trust_score.fact_active_listings")} value={String(activeListingsCount)} />
      </ul>

      {/* Owner-only: improvement tips + refresh button */}
      {isOwnProfile && (
        <>
          <div style={{ height: "1px", background: "var(--border)", margin: "12px 0" }} />

          <p
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 8px",
            }}
          >
            {t("trust_score.improve_title")}
          </p>

          {allVerified ? (
            <p style={{ fontSize: "13px", color: "var(--priD)", fontWeight: 500 }}>
              {t("trust_score.improve_all_done")} ✓
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {improvementTips.map((tip) => (
                <li
                  key={tip}
                  style={{
                    fontSize: "13px",
                    color: "var(--foreground)",
                    padding: "3px 0",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "6px",
                  }}
                >
                  <span style={{ color: "var(--priD)", flexShrink: 0, fontWeight: 700 }}>→</span>
                  {tip}
                </li>
              ))}
            </ul>
          )}

          <TrustScoreRefreshButton
            refreshCta={t("trust_score.refresh_cta")}
            refreshingLabel={t("trust_score.refreshing")}
            refreshSuccess={t("trust_score.refresh_success")}
            refreshErrorRate={t("trust_score.refresh_error_rate")}
            refreshError={t("trust_score.refresh_error")}
          />
        </>
      )}
    </section>
  );
}
