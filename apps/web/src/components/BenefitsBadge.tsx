"use client";

import { Badge } from "@/components/ui/badge";
import { Zap, Star, EyeOff, Calendar, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n";

interface BenefitsBadgeProps {
  benefits: Array<{
    benefit_type: string;
    valid_until: string;
  }>;
  className?: string;
}

export default function BenefitsBadge({ benefits, className }: BenefitsBadgeProps) {
  const { t } = useI18n();

  if (!benefits || benefits.length === 0) {
    return null;
  }

  const activeBenefits = benefits.filter(
    (b) => new Date(b.valid_until) > new Date(),
  );

  if (activeBenefits.length === 0) {
    return null;
  }

  const benefitIcons: Record<string, React.ReactNode> = {
    boost: <Zap className="h-3 w-3" />,
    premium: <Star className="h-3 w-3" />,
    hide_phone: <EyeOff className="h-3 w-3" />,
    reserve: <Calendar className="h-3 w-3" />,
    highlight: <Sparkles className="h-3 w-3" />,
  };

  const benefitColors: Record<string, string> = {
    boost: "bg-yellow-500 hover:bg-yellow-600",
    premium: "bg-purple-500 hover:bg-purple-600",
    hide_phone: "bg-gray-500 hover:bg-gray-600",
    reserve: "bg-blue-500 hover:bg-blue-600",
    highlight: "bg-pink-500 hover:bg-pink-600",
  };

  return (
    <div className={`flex flex-wrap gap-1 ${className || ""}`}>
      {activeBenefits.map((benefit, index) => (
        <Badge
          key={`${benefit.benefit_type}-${index}`}
          variant="default"
          className={`${benefitColors[benefit.benefit_type] || "bg-primary"} text-white flex items-center gap-1`}
        >
          {benefitIcons[benefit.benefit_type]}
          {t(`billing.benefits.${benefit.benefit_type}`)}
        </Badge>
      ))}
    </div>
  );
}

