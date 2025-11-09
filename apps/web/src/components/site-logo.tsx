import Image from "next/image";
import Link from "next/link";

export function SiteLogo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="LyVoX home">
      <Image
        src="/lyvox.svg"
        alt="LyVoX"
        width={120}
        height={32}
        priority
        className="h-8 w-auto"
      />
    </Link>
  );
}

