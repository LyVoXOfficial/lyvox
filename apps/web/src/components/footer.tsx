export default function Footer() {
  return (
    <footer className="border-t mt-10">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-zinc-600 flex flex-wrap gap-4 justify-between">
        <p>© {new Date().getFullYear()} LyVoX</p>
        <nav className="flex gap-4">
          <a href="/legal/terms" className="hover:underline">Условия</a>
          <a href="/legal/privacy" className="hover:underline">Конфиденциальность</a>
          <a href="/contact" className="hover:underline">Контакты</a>
        </nav>
      </div>
    </footer>
  );
}
