import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type VerificationBadgeProps = {
  label: string;
  verified?: boolean;
  tooltip?: string;
  icon?: LucideIcon;
  className?: string;
};

export default function VerificationBadge({
  label,
  verified = false,
  tooltip,
  icon: Icon,
  className,
}: VerificationBadgeProps) {
  if (!verified) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-emerald-50/90 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 shadow-sm ring-0 backdrop-blur",
        className,
      )}
      title={tooltip}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      <span>{label}</span>
    </span>
  );
}

