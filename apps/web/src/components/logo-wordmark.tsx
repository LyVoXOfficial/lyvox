import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoWordmarkProps = {
  className?: string;
};

export default function LogoWordmark({ className }: LogoWordmarkProps) {
  return (
    <Image
      src="/lyvox.svg"
      alt="LyVoX"
      width={120}
      height={32}
      priority
      className={cn("h-8 w-auto", className)}
    />
  );
}

