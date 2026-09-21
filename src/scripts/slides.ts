/**
 * Slide-to-slide scrolling.
 *
 * CSS scroll snap decides *where* the page lands but gives no control over
 * *how* it gets there, and Chrome's native snap animation lands hard. This
 * takes over that one job.
 *
 * The thing that makes a hijacked scroll feel laggy is not the duration on its
 * own, it is being ignored. An earlier version ran for 820ms and swallowed
 * every wheel event until it finished, so a second flick did nothing and the
 * page felt stuck. This version is:
 *
 *   - shorter, 460ms, which is long enough to read as a glide,
 *   - re-targetable, so a flick mid-slide immediately aims at the next one
 *     and the animation continues from wherever it currently is rather than
 *     restarting or being dropped,
 *   - eased out, so it leaves immediately on input and settles softly, which
 *     is what makes it feel responsive rather than syrupy.
 *
 * Native snapping stays in the stylesheet as the behaviour without
 * JavaScript, and this steps aside entirely under reduced motion, below the
 * fallback breakpoints, and on touch devices where native momentum is better
 * than anything written here.
 */

/** Travel time for one slide. */
const DURATION = 460;

/** Wheel delta that counts as a deliberate move, to ignore trackpad jitter. */
const WHEEL_THRESHOLD = 8;

/**
 * How long the wheel must be quiet before another flick is accepted.
 *
 * One flick of a wheel or trackpad is not one event, it is a burst of dozens.
 * Throttling that burst on a timer was the bug behind the crawl: every 140ms
 * another event was accepted and the animation restarted from wherever it had
 * got to, so it never actually arrived. A keyboard press produces exactly one
 * event, which is why the keys always felt right.
 *
 * So the wheel is locked for the whole gesture instead: one burst moves one
 * slide, and the lock lifts once the animation has finished and the wheel has
 * been still for this long.
 */
const WHEEL_QUIET = 120;

/** Matches the stylesheet's fallback breakpoints. */
const TOO_SMALL = "(max-height: 44rem), (max-width: 48rem)";

/** Leaves immediately, settles gently. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function initSlides(): void {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tooSmall = window.matchMedia(TOO_SMALL);
  const coarse = window.matchMedia("(pointer: coarse)");

  const root = document.documentElement;
  // Only pages built from slides. The project pages are ordinary documents and
  // must scroll normally.
  if (!root.hasAttribute("data-slides")) return;

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
  /** Where the current animation is heading. */
  let aimedAt = -1;
  /** True while a wheel gesture owns the page. */
  let wheelLocked = false;
  let lastWheel = 0;
  let unlockTimer = 0;

  const nearestIndex = (): number => {
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

  const release = (): void => {
    animating = false;
    aimedAt = -1;
    wheelLocked = false;
    window.clearTimeout(unlockTimer);
    cancelAnimationFrame(frame);
    // Hand control back to the browser's own snapping.
    root.style.scrollSnapType = "";
  };

  /**
   * Lift the wheel lock once the slide has landed and the wheel has gone
   * quiet. Checking both matters: a long trackpad glide easily outlasts the
   * animation, and lifting the lock while it is still spinning would take the
   * next event as a fresh flick.
   */
  const scheduleUnlock = (): void => {
    window.clearTimeout(unlockTimer);
    const remaining = WHEEL_QUIET - (performance.now() - lastWheel);
    unlockTimer = window.setTimeout(
      () => {
        if (animating || performance.now() - lastWheel < WHEEL_QUIET) {
          scheduleUnlock();
          return;
        }
        wheelLocked = false;
      },
      Math.max(remaining, 20),
    );
  };

  const slideTo = (index: number): void => {
    const clamped = Math.max(0, Math.min(targets.length - 1, index));
    const target = targets[clamped];
    if (!target) return;

    const max = Math.max(0, root.scrollHeight - window.innerHeight);
    const to = Math.min(target.offsetTop, max);
    // Always start from where the page actually is, so a re-target mid-flight
    // continues from the current position instead of jumping back.
    const from = window.scrollY;
    if (Math.abs(to - from) < 2) {
      aimedAt = clamped;
      return;
    }

    aimedAt = clamped;
    // Native snapping would fight the animation the whole way, so it is off
    // for the duration and restored at the end.
    root.style.scrollSnapType = "none";
    animating = true;
    cancelAnimationFrame(frame);
    const start = performance.now();

    const step = (now: number): void => {
      if (!animating) return;
      const t = Math.min(1, (now - start) / DURATION);
      window.scrollTo(0, from + (to - from) * easeOutCubic(t));

      if (t < 1) {
        frame = requestAnimationFrame(step);
        return;
      }
      animating = false;
      aimedAt = -1;
      root.style.scrollSnapType = "";
      if (wheelLocked) scheduleUnlock();
    };

    frame = requestAnimationFrame(step);
  };

  const enabled = (): boolean =>
    !reducedMotion.matches && !tooSmall.matches && !coarse.matches;

  /** Where the next move should start counting from. */
  const baseIndex = (): number => (aimedAt >= 0 ? aimedAt : nearestIndex());

  const move = (direction: number): void => slideTo(baseIndex() + direction);

  const onWheel = (event: WheelEvent): void => {
    if (!enabled()) return;
    // Let the browser handle zoom and horizontal intent.
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    lastWheel = performance.now();

    if (wheelLocked) {
      // Mid-gesture. Swallow the rest of the burst so it cannot restart the
      // animation, and keep pushing the unlock out while the wheel spins.
      event.preventDefault();
      scheduleUnlock();
      return;
    }

    if (Math.abs(event.deltaY) < WHEEL_THRESHOLD) return;

    event.preventDefault();
    wheelLocked = true;
    move(event.deltaY > 0 ? 1 : -1);
    scheduleUnlock();
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
      move(1);
    } else if (KEYS_BACK.has(event.key)) {
      event.preventDefault();
      move(-1);
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
  const onPointerDown = (): void => release();
  const onHashChange = (): void => release();
  const onResize = (): void => {
    collect();
    release();
  };

  // `passive: false` is required: the whole point is to replace the default
  // scroll for this gesture.
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("resize", onResize, { passive: true });
  reducedMotion.addEventListener("change", release);
}
