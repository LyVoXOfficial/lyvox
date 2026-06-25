import Link from "next/link";
import Image from "next/image";

export function SiteLogo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="LyVoX home">
      <Image
        src="/lyvox.svg?v=3"
        alt="LyVoX"
        width={160}
        height={40}
        className="h-10 w-auto"
        priority
      />
    </Link>
  );
}
