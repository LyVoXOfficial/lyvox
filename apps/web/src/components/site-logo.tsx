import Link from "next/link";

/**
 * Inline shield SVG used in the logo mark.
 * Path matches the mockup: shield body + checkmark.
 */
const ShieldSVG = ({ size = 18 }: { size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="#fff"
    strokeWidth="2.4"
    aria-hidden="true"
  >
    <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

type SiteLogoProps = {
  /** Icon size variant — "md" (33px, desktop) or "sm" (30px, mobile). Default "md". */
  size?: "md" | "sm";
};

export function SiteLogo({ size = "md" }: SiteLogoProps) {
  const iconSize = size === "sm" ? 30 : 33;
  const iconRadius = size === "sm" ? "rounded-[10px]" : "rounded-[11px]";
  const svgSize = size === "sm" ? 17 : 18;
  const textSize = size === "sm" ? "text-[19px]" : "text-[21px]";

  return (
    <Link
      href="/"
      className={`flex items-center gap-[9px] font-extrabold tracking-[-0.02em] ${textSize} text-foreground`}
      aria-label="LyVoX home"
    >
      <span
        className={`lyvox-trust-gradient ${iconRadius} grid place-items-center shrink-0`}
        style={{ width: iconSize, height: iconSize }}
      >
        <ShieldSVG size={svgSize} />
      </span>
      LyVoX
    </Link>
  );
}
