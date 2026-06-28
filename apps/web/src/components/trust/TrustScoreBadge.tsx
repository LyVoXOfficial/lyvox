import React from "react";
import { ShieldCheck, TrendingUp, Star } from "lucide-react";
import { deriveTrustTier, type TrustTierInfo } from "@/lib/trust/trustTier";

interface TrustScoreBadgeProps {
  score: number;
  t: (key: string) => string;
}

function TierIcon({ colorVariant }: { colorVariant: TrustTierInfo["colorVariant"] }) {
  switch (colorVariant) {
    case "teal-light":
      return <TrendingUp className="mr-1 h-3 w-3" aria-hidden="true" />;
    case "teal":
      return <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />;
    case "gold":
      return <Star className="mr-1 h-3 w-3" aria-hidden="true" />;
    default:
      return null;
  }
}

const BASE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: "28px",
  padding: "0 12px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
};

export function TrustScoreBadge({ score, t }: TrustScoreBadgeProps) {
  const { labelKey, colorVariant } = deriveTrustTier(score);

  let style: React.CSSProperties;
  let className = "";

  switch (colorVariant) {
    case "gold":
      className = "lyvox-trust-gradient";
      style = { ...BASE_STYLE, color: "#fff", boxShadow: "0 2px 8px oklch(0.72 0.18 68 / 0.4)" };
      break;
    case "teal":
      className = "lyvox-trust-gradient";
      style = { ...BASE_STYLE, color: "#fff", boxShadow: "0 2px 8px oklch(0.55 0.12 172 / 0.3)" };
      break;
    case "teal-light":
      style = { ...BASE_STYLE, background: "oklch(0.56 0.13 178 / 0.12)", color: "var(--priD)" };
      break;
    default:
      style = { ...BASE_STYLE, background: "var(--muted)", color: "var(--muted-foreground)" };
  }

  return (
    <span className={className} style={style}>
      <TierIcon colorVariant={colorVariant} />
      {t(labelKey)}
    </span>
  );
}
