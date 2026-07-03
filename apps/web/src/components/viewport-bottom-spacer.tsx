export default function ViewportBottomSpacer() {
  // Reserves space for the fixed BottomNav (--bottom-nav-h, single source of
  // truth in globals.css) + the iOS safe-area inset. See audit B-1.
  return <div className="h-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))]" aria-hidden="true" />;
}
