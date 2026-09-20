/**
 * Publishes normalized scroll progress as `--scroll` on <html>, which the
 * landscape layers read to drift at different depths.
 *
 * Scroll handlers are the classic source of jank, so: passive listener, one
 * rAF-coalesced write per frame, and a single custom property rather than
 * per-layer style writes.
 */

export function initParallax(): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const root = document.documentElement;
  let ticking = false;

  const write = (): void => {
    ticking = false;
    const travel = Math.max(1, root.scrollHeight - window.innerHeight);
    // 0 at the top of the page, 1 at the bottom.
    const progress = Math.min(1, Math.max(0, window.scrollY / travel));
    root.style.setProperty("--scroll", progress.toFixed(4));
  };

  const onScroll = (): void => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(write);
  };

  write();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
}
