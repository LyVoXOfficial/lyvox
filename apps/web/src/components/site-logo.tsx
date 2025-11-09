import Image from "next/image";
import Link from "next/link";

export function SiteLogo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="LyVoX home">
      <Image
        src="/lyvox.svg"
        alt="LyVoX"
        width={180}
        height={48}
        priority
        className="h-12 w-auto"
      />
    </Link>
  );
}

