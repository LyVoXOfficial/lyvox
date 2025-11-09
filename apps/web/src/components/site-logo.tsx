import Link from "next/link";

export function SiteLogo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="LyVoX home">
      <img
        src="/lyvox.svg?v=3"
        alt="LyVoX"
        width="220"
        height="56"
        className="h-14 w-auto"
        loading="eager"
      />
    </Link>
  );
}

