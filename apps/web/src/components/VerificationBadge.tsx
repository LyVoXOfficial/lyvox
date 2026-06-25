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
        // Signature "trust, in colour" chip: white on the teal→mint gradient.
        "lyvox-trust-gradient inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white",
        className,
      )}
      title={tooltip}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
      <span>{label}</span>
    </span>
  );
}

