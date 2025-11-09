import Link from "next/link";

export function SiteLogo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="LyVoX home">
      <img
        src="/lyvox.svg"
        alt="LyVoX"
        style={{ height: '96px', width: '378px', objectFit: 'contain' }}
        loading="eager"
      />
    </Link>
  );
}

