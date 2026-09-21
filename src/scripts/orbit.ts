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

/**
 * How much bigger the outer end of the spiral is than the eye. At the original
 * 12 the inner cards were specks; 6 keeps the whole path legible while still
 * giving a real sense of depth.
 */
const RADIUS_RATIO = 6;

/*
 * The angular span is not a constant here: the angle is derived per frame from
 * the radius, by inverting the growth law. RADIUS_RATIO of 6 works out to about
 * 0.93 of a turn.
 */

/** One card walks the whole spiral every ~30 seconds. */
const SPEED = 1 / 30;

/** Scale of a card at the eye. The outermost is always 1. */
const MIN_SCALE = 0.55;

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

  const measure = (): void => {
    const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    /*
      Room for the chip itself, so the outermost never clips.

      Proportional, not a flat 80px. On a phone the container is about 350px
      across, and subtracting a desktop-sized inset left a radius of roughly
      99px: small enough that the spiral was unreadable, which is why it used
      to be hidden below 40rem entirely.
    */
    const inset = Math.max(44, Math.min(80, size * 0.15));
    radiusMax = Math.max(70, size / 2 - inset);
  };

  const place = (card: OrbitCard): void => {
    let t = (clock * SPEED + card.offset) % 1;
    if (inward) t = 1 - t;

    /*
      Walk the spiral by radius, not by angle.

      On a logarithmic spiral, arc length is proportional to radius, so
      advancing the radius at a constant rate means moving along the curve at a
      constant speed, and cards spaced evenly in `t` end up evenly spaced along
      the path. Stepping the angle instead (the obvious way) makes the outer
      cards race while the inner ones crawl, and bunches them all up at the eye.
      The path traced is identical; only the pacing along it changes.
    */
    const radiusMin = radiusMax / RADIUS_RATIO;
    const radius = radiusMin + t * (radiusMax - radiusMin);

    // Invert the golden growth law to get the angle this radius sits at.
    const theta = (Math.log(radius / radiusMin) / Math.log(PHI)) * QUARTER_TURN;

    const x = Math.cos(theta) * radius;
    const y = Math.sin(theta) * radius;

    // Scale tracks radius, so distance from the eye reads as distance from the
    // viewer. Cards stay upright: a card rotated to the spiral tangent looks
    // clever and is unreadable.
    const scale = MIN_SCALE + (1 - MIN_SCALE) * (radius / radiusMax);

    // Dissolve at both ends of the path so cards never pop in or out. The
    // curve is the same at each end, so entry and exit mirror one another.
    const fadeIn = Math.min(1, t / 0.12);
    const fadeOut = Math.min(1, (1 - t) / 0.14);
    // Never fully transparent in the middle of the path: a card should read as
    // present the whole way round, not ghost in and out.
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
    clock += delta;

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

  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  reducedMotion.addEventListener("change", onMotionPreference);

  return () => {
    stop();
    observer?.disconnect();
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    reducedMotion.removeEventListener("change", onMotionPreference);
  };
}
