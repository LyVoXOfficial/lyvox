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
        "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200",
        className,
      )}
      title={tooltip}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      <span>{label}</span>
    </span>
  );
}

