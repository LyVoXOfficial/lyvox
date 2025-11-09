import { useId } from "react";
import { cn } from "@/lib/utils";

type LogoWordmarkProps = {
  className?: string;
};

export default function LogoWordmark({ className }: LogoWordmarkProps) {
  const gradientBaseId = useId().replace(/:/g, "-");
  const wordmarkGradientId = `${gradientBaseId}-wordmark`;
  const iconGradientId = `${gradientBaseId}-icon`;

  return (
    <svg
      viewBox="0 0 210 52"
      role="img"
      aria-label="LyVoX"
      className={cn("h-10 w-auto md:h-12", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id={wordmarkGradientId}
          x1="36"
          y1="12"
          x2="200"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#0EA5E9" />
          <stop offset="0.55" stopColor="#6366F1" />
          <stop offset="1" stopColor="#22C55E" />
        </linearGradient>
        <linearGradient
          id={iconGradientId}
          x1="10"
          y1="8"
          x2="44"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#11BDF9" />
          <stop offset="1" stopColor="#22C55E" />
        </linearGradient>
      </defs>
      <g transform="translate(6 6)">
        <circle cx="22" cy="20" r="18" fill={`url(#${iconGradientId})`} opacity="0.18" />
        <path
          d="M18 12H26C26.884 12 27.6 12.716 27.6 13.6C27.6 14.02 27.4408 14.4263 27.1548 14.7431L21.64 20.614C21.3474 20.9299 21.16 21.3408 21.16 21.774V31C21.16 31.884 20.444 32.6 19.56 32.6C18.676 32.6 17.96 31.884 17.96 31V21.88C17.96 21.4428 18.1203 21.0203 18.412 20.692L24.148 14.336H18C17.116 14.336 16.4 13.62 16.4 12.736C16.4 11.852 17.116 11.136 18 11.136Z"
          fill={`url(#${wordmarkGradientId})`}
        />
        <g fill={`url(#${wordmarkGradientId})`}>
          <path d="M54 10H62V30H80V38H54V10Z" />
          <path d="M84 10H92L102 22.4L112 10H120L107 26.4V38H99V26.4L84 10Z" />
          <path d="M128 10H136L146 30.2L156 10H164L150 38H142L128 10Z" />
          <path d="M170 10C186 10 198 20 198 24C198 28 186 38 170 38C154 38 142 28 142 24C142 20 154 10 170 10ZM170 18C162.268 18 154 21.744 154 24C154 26.256 162.268 30 170 30C177.732 30 186 26.256 186 24C186 21.744 177.732 18 170 18Z" />
          <path d="M202 10H210L218 18L226 10H234L222 22L234 38H226L218 28.4L210 38H202L214 22L202 10Z" />
        </g>
      </g>
    </svg>
  );
}

