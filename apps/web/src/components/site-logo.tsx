import Link from "next/link";

export function SiteLogo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="LyVoX home">
      <img
        src="/lyvox.svg?v=3"
        alt="LyVoX"
        width="400"
        height="101"
        className="h-24 w-auto"
        loading="eager"
      />
    </Link>
  );
}

