/**
 * Reveals `[data-reveal]` elements once, as they scroll into view.
 *
 * Reveal-on-scroll is the one place a fixed-duration CSS animation is the right
 * tool: nothing here is gesture-driven, so there is no interruption to handle
 * and no velocity to inherit.
 */

export function initReveal(): void {
  const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (targets.length === 0) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // No IntersectionObserver, or motion is unwanted: show everything immediately.
  // The content must never depend on the animation running.
  if (reduced || !("IntersectionObserver" in window)) {
    for (const element of targets) element.classList.add("is-revealed");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        const delay = Number(element.dataset.revealDelay ?? 0);
        window.setTimeout(() => element.classList.add("is-revealed"), delay);
        observer.unobserve(element);
      }
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
  );

  for (const element of targets) observer.observe(element);
}
