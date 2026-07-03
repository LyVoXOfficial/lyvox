export default function ViewportBottomSpacer() {
  // Reserves space for the fixed BottomNav (--bottom-nav-h, single source of
  // truth in globals.css) + the iOS safe-area inset. See audit B-1.
  // md:hidden mirrors BottomNav's own breakpoint — no dead space on desktop
  // where the fixed nav does not render.
  return <div className="h-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:hidden" aria-hidden="true" />;
}
