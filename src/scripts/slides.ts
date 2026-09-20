/**
 * Smooth slide-to-slide scrolling.
 *
 * CSS scroll snap decides *where* the page lands but gives no control over
 * *how* it gets there. Chrome's mandatory snap animation is short and lands
 * hard, which reads as a jolt rather than a slide. This takes over that one
 * job: it reads a scroll intent, then animates to the next section over
 * `DURATION` with an ease that starts and ends at rest.
 *
 * It is deliberately narrow. Native snapping stays in the stylesheet as the
 * behaviour without JavaScript, and this steps aside entirely when:
 *   - the visitor prefers reduced motion,
 *   - the viewport is too short or narrow for one-screen slides (the same
 *     breakpoints where the stylesheet drops to proximity snapping),
 *   - a touch device is driving, where native momentum already feels right
 *     and hijacking it is actively unpleasant.
 *
 * Keyboard scrolling, find-in-page, anchor links and the browser's own
 * scroll restoration all keep working, because the page is never locked: the
 * animation is cancelled the moment anything else moves the page.
 */

/** Slide travel time. Long enough to read as a glide, short enough not to wait. */
const DURATION = 820;

/** Wheel delta that counts as a deliberate move, to ignore trackpad jitter. */
const WHEEL_THRESHOLD = 12;

/** Quiet period after a slide before another gesture is accepted. */
const COOLDOWN = 90;

/** Matches the stylesheet's fallback breakpoints. */
const TOO_SMALL = "(max-height: 44rem), (max-width: 48rem)";

/** Ease in and out, so the slide starts and finishes at rest. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function initSlides(): void {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tooSmall = window.matchMedia(TOO_SMALL);
  const coarse = window.matchMedia("(pointer: coarse)");

  const root = document.documentElement;
  let targets: HTMLElement[] = [];

  const collect = (): void => {
    targets = [
      ...document.querySelectorAll<HTMLElement>("main > section"),
      ...document.querySelectorAll<HTMLElement>("footer"),
    ];
  };
  collect();
  if (targets.length < 2) return;

  let animating = false;
  let frame = 0;
  let readyAt = 0;

  /** Index of the slide nearest the top of the viewport. */
  const currentIndex = (): number => {
    const y = window.scrollY;
    let best = 0;
    let bestDistance = Infinity;
    targets.forEach((el, i) => {
      const distance = Math.abs(el.offsetTop - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  };

  const cancel = (): void => {
    if (!animating) return;
    animating = false;
    cancelAnimationFrame(frame);
    // Hand control back to the browser's own snapping.
    root.style.scrollSnapType = "";
  };

  const slideTo = (index: number): void => {
    const clamped = Math.max(0, Math.min(targets.length - 1, index));
    const target = targets[clamped];
    if (!target) return;

    const from = window.scrollY;
    const max = root.scrollHeight - window.innerHeight;
    const to = Math.min(target.offsetTop, max);
    if (Math.abs(to - from) < 2) return;

    // Native snapping would fight the animation the whole way down, so it is
    // switched off for the duration and restored at the end.
    root.style.scrollSnapType = "none";
    animating = true;
    const start = performance.now();

    const step = (now: number): void => {
      if (!animating) return;
      const t = Math.min(1, (now - start) / DURATION);
      window.scrollTo(0, from + (to - from) * easeInOutCubic(t));

      if (t < 1) {
        frame = requestAnimationFrame(step);
        return;
      }
      animating = false;
      root.style.scrollSnapType = "";
      readyAt = performance.now() + COOLDOWN;
    };

    frame = requestAnimationFrame(step);
  };

  const enabled = (): boolean =>
    !reducedMotion.matches && !tooSmall.matches && !coarse.matches;

  const onWheel = (event: WheelEvent): void => {
    if (!enabled()) return;
    // Let the browser handle zoom and horizontal intent.
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    if (animating || performance.now() < readyAt) {
      // Already going somewhere: swallow the event rather than let it fight.
      event.preventDefault();
      return;
    }
    if (Math.abs(event.deltaY) < WHEEL_THRESHOLD) return;

    event.preventDefault();
    slideTo(currentIndex() + (event.deltaY > 0 ? 1 : -1));
  };

  const KEYS_FORWARD = new Set(["PageDown", "ArrowDown", " ", "Spacebar"]);
  const KEYS_BACK = new Set(["PageUp", "ArrowUp"]);

  const onKey = (event: KeyboardEvent): void => {
    if (!enabled() || event.metaKey || event.ctrlKey || event.altKey) return;

    // Never steal keys from a field or anything the visitor is editing.
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;

    if (KEYS_FORWARD.has(event.key)) {
      event.preventDefault();
      slideTo(currentIndex() + 1);
    } else if (KEYS_BACK.has(event.key)) {
      event.preventDefault();
      slideTo(currentIndex() - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      slideTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      slideTo(targets.length - 1);
    }
  };

  // Anything else that moves the page wins: a nav link, find-in-page, a
  // scrollbar drag, the back button. Stop animating rather than fight it.
  const onPointerDown = (): void => cancel();
  const onHashChange = (): void => cancel();

  const onResize = (): void => {
    collect();
    cancel();
  };

  // `passive: false` is required: the whole point is to replace the default
  // scroll for this gesture.
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("resize", onResize, { passive: true });
  reducedMotion.addEventListener("change", cancel);
}
