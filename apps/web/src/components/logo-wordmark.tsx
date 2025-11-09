import { cn } from "@/lib/utils";

type LogoWordmarkProps = {
  className?: string;
};

export default function LogoWordmark({ className }: LogoWordmarkProps) {
  return (
    <img
      src="/lyvox.svg"
      alt="LyVoX"
      className={cn("h-12 w-auto", className)}
      loading="eager"
      decoding="async"
    />
  );
}

