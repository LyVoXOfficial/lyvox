export default function LegalFooter() {
  return (
    <footer className="border-t bg-white mb-16 md:mb-0">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-zinc-600 grid md:grid-cols-3 gap-4">
        <div>
          <div className="font-medium">О LyVoX</div>
          <ul className="mt-2 space-y-1">
            <li><a className="hover:underline" href="/about">О проекте</a></li>
            <li><a className="hover:underline" href="/contact">Контакты</a></li>
          </ul>
        </div>
        <div>
          <div className="font-medium">Правовое</div>
          <ul className="mt-2 space-y-1">
            <li><a className="hover:underline" href="/legal/terms">Условия</a></li>
            <li><a className="hover:underline" href="/legal/privacy">Конфиденциальность</a></li>
            <li><a className="hover:underline" href="/safety">Безопасность</a></li>
          </ul>
        </div>
        <div>
          <div className="font-medium">Мы в соцсетях</div>
          <ul className="mt-2 space-y-1">
            <li><a className="hover:underline" href="#">Instagram</a></li>
            <li><a className="hover:underline" href="#">Facebook</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
