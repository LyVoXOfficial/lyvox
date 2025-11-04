export default function ViewportBottomSpacer() {
  // высота нижнего бара = 56px (h-14) + безопасная зона на iPhone
  return <div className="h-[calc(56px+env(safe-area-inset-bottom))]" aria-hidden="true" />;
}
