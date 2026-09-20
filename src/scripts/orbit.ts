/**
 * Stack cards travelling along a true golden spiral.
 *
 * The spiral is logarithmic with a growth factor of exactly phi per quarter
 * turn — r(theta) = r0 * phi^(theta / (pi/2)) — which is what makes it "golden"
 * rather than merely spiral-shaped. Cards emerge small at the eye, spiral
 * outward while growing, and dissolve at the outer end, then return to the eye.
 *
 * Set `data-direction="inward"` on the container to reverse it, so cards spiral
 * in and vanish at the golden point instead.
 *
 * Only `transform` and `opacity` are animated, so the whole loop stays on the
 * compositor. The loop is suspended whenever it is off-screen, the tab is
 * hidden, or the pointer is resting on it.
 */

const PHI = 1.618033988749895;
const QUARTER_TURN = Math.PI / 2;

/** How much bigger the outermost card is than the one at the eye. */
const RADIUS_RATIO = 12;

/**
 * Angular span that produces exactly RADIUS_RATIO of growth on a golden
 * spiral — about 1.3 turns. Derived, not eyeballed.
 */
const THETA_SPAN = (Math.log(RADIUS_RATIO) / Math.log(PHI)) * QUARTER_TURN;

/** Full cycles per second. One card completes the spiral every ~28s. */
const SPEED = 1 / 28;

interface OrbitCard {
  element: HTMLElement;
  /** Even phase offset around the loop, in [0,1). */
  offset: number;
}

export function initOrbit(container: HTMLElement): () => void {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>("[data-orbit-card]"),
  );
  if (elements.length === 0) return () => {};

  const inward = container.dataset.direction === "inward";

  const cards: OrbitCard[] = elements.map((element, index) => ({
    element,
    offset: index / elements.length,
  }));

  let radiusMax = 0;
  let frame = 0;
  let running = false;
  let lastTime = 0;
  let clock = 0;
  let paused = false;

  const measure = (): void => {
    const rect = container.getBoundingClientRect();
    // Leave room for the card itself so the outermost one never clips.
    radiusMax = Math.max(80, Math.min(rect.width, rect.height) / 2 - 64);
  };

  const place = (card: OrbitCard): void => {
    let t = (clock * SPEED + card.offset) % 1;
    if (inward) t = 1 - t;

    const theta = t * THETA_SPAN;
    // The golden growth law. At t=0 the card sits at the eye.
    const radius = (radiusMax / RADIUS_RATIO) * Math.pow(PHI, theta / QUARTER_TURN);

    const x = Math.cos(theta) * radius;
    const y = Math.sin(theta) * radius;

    // Scale tracks radius, so distance from the eye reads as distance from the
    // viewer. Cards stay upright: a card rotated to the spiral tangent looks
    // clever and is unreadable.
    const scale = 0.34 + 0.66 * (radius / radiusMax);

    // Dissolve at both ends of the path so cards never pop in or out. The
    // curve is the same at each end, so entry and exit mirror one another.
    const fadeIn = Math.min(1, t / 0.14);
    const fadeOut = Math.min(1, (1 - t) / 0.16);
    const opacity = Math.max(0, Math.min(fadeIn, fadeOut));

    card.element.style.transform =
      `translate3d(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px), 0) scale(${scale.toFixed(3)})`;
    card.element.style.opacity = opacity.toFixed(3);
    // Nearer cards overlap further ones.
    card.element.style.zIndex = String(Math.round(scale * 100));
  };

  const step = (time: number): void => {
    if (!running) return;
    const delta = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    if (!paused) clock += delta;

    for (const card of cards) place(card);
    frame = requestAnimationFrame(step);
  };

  const start = (): void => {
    if (running || reducedMotion.matches) return;
    running = true;
    lastTime = 0;
    frame = requestAnimationFrame(step);
  };

  const stop = (): void => {
    running = false;
    cancelAnimationFrame(frame);
  };

  /** Reduced motion gets the same information as a plain, static wrap list. */
  const applyStatic = (): void => {
    stop();
    container.classList.add("is-static");
    for (const { element } of cards) {
      element.style.transform = "";
      element.style.opacity = "";
      element.style.zIndex = "";
    }
  };

  const applyMotion = (): void => {
    container.classList.remove("is-static");
    measure();
    // Lay the cards out once before the loop starts. Without this they sit
    // stacked on top of each other at the centre until the first frame runs —
    // which, because the loop is suspended while off-screen, is not until the
    // section is scrolled into view.
    for (const card of cards) place(card);
    start();
  };

  // Suspend entirely while scrolled away — an invisible rAF loop is pure waste.
  let observer: IntersectionObserver | undefined;
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) start();
          else stop();
        }
      },
      { threshold: 0.01 },
    );
    observer.observe(container);
  }

  // Let people stop the motion to actually read a card.
  const hold = (): void => { paused = true; };
  const release = (): void => { paused = false; };

  const onVisibility = (): void => {
    if (document.hidden) stop();
    else start();
  };

  const onResize = (): void => measure();

  const onMotionPreference = (): void => {
    if (reducedMotion.matches) applyStatic();
    else applyMotion();
  };

  if (reducedMotion.matches) {
    applyStatic();
  } else {
    applyMotion();
  }

  container.addEventListener("pointerenter", hold);
  container.addEventListener("pointerleave", release);
  container.addEventListener("focusin", hold);
  container.addEventListener("focusout", release);
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  reducedMotion.addEventListener("change", onMotionPreference);

  return () => {
    stop();
    observer?.disconnect();
    container.removeEventListener("pointerenter", hold);
    container.removeEventListener("pointerleave", release);
    container.removeEventListener("focusin", hold);
    container.removeEventListener("focusout", release);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    reducedMotion.removeEventListener("change", onMotionPreference);
  };
}
