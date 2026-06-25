import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-border/75">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-4 py-6 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} LyVoX</p>
        <nav className="flex gap-4">
          <Link href="/legal/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}
