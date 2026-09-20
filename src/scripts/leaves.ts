/**
 * Wind-blown leaves drifting across a layer above the page.
 *
 * The leaves are a sprite sheet rendered in Blender (see tools/render_leaves.py):
 * three shape and colour variants, each a full 360-degree turn about the leaf's
 * long axis across 28 frames. Stepping through a row plays a real lit 3D tumble,
 * with the leaf going edge-on and flat again, which a flat 2D shape cannot fake.
 * The row loops seamlessly because the rotation completes exactly one turn.
 *
 * On arrival the page opens with a gust: a dense burst of fast leaves that
 * clears left to right, handing over to the ambient drift. See INTRO below.
 *
 * One canvas, one rAF loop, no DOM. The whole effect is a single composited
 * layer. It is decoration: pointer events are off, and the site is complete
 * without it, so every failure path here simply draws nothing.
 */

/*
 * These must match tools/render_leaves.py and tools/build_leaf_sheet.py.
 * The three rows are different leaf shapes as well as different colours.
 */
const SHEET_SRC = "/images/leaves.webp";
const FRAMES = 28;
const VARIANTS = 3;
const TILE = 72;
const MAX_DPR = 2;

/*
 * Intro timings, in seconds.
 *
 * Short on purpose. The gust is in front of the content, so every extra
 * hundred milliseconds is time the visitor cannot read the page. Holding the
 * full screen for about half a second is enough to register as weather;
 * beyond that it starts to feel like a loading screen.
 */
const INTRO_HOLD = 0.55;   // dense, covering
const INTRO_WIPE = 0.85;   // clears left to right
const INTRO_TOTAL = INTRO_HOLD + INTRO_WIPE;

/** Width of the soft edge on the clearing front, in px. */
const WIPE_BAND = 260;

/** Plays once per tab, so returning from a project page is not a re-entry. */
const INTRO_KEY = "leafIntroPlayed";

interface Leaf {
  x: number;
  y: number;
  size: number;
  /** Depth in [0,1]: 0 is far (small, slow, faint), 1 is near. */
  depth: number;
  /** Which row of the sheet this leaf uses. */
  variant: number;
  /** In-plane rotation, on top of the rendered tumble. */
  angle: number;
  spin: number;
  /** Position within the tumble cycle, in turns. */
  phase: number;
  phaseRate: number;
  drift: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function initLeaves(canvas: HTMLCanvasElement): () => void {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return () => {};

  let ambient: Leaf[] = [];
  let intro: Leaf[] = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let running = false;
  let lastTime = 0;
  /** Slowly wandering gust strength, so the wind is never metronomic. */
  let gustPhase = Math.random() * Math.PI * 2;

  /** Seconds elapsed in the intro, or null once it is over or skipped. */
  let introClock: number | null = null;
  /** True while we still owe the visitor a gust but cannot play it yet. */
  let introArmed = false;

  let sheet: CanvasImageSource | null = null;
  /** Theme-graded copy of the sheet, rebuilt only when the theme changes. */
  let graded: HTMLCanvasElement | null = null;

  const isDark = (): boolean => document.documentElement.classList.contains("dark");

  /**
   * At dusk the leaves are lit by a dimmer sky. Pre-grading the whole sheet
   * once beats setting a canvas filter on every leaf on every frame.
   */
  const grade = (): void => {
    if (!sheet) return;
    const w = FRAMES * TILE;
    const h = VARIANTS * TILE;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(sheet, 0, 0, w, h);
    if (isDark()) {
      // `source-atop` keeps the leaf alpha and tints only the leaf itself.
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "rgba(10, 28, 40, 0.55)";
      ctx.fillRect(0, 0, w, h);
    }
    graded = off;
  };

  /** Ambient leaf count scales with viewport, with a hard ceiling. */
  const ambientCount = (): number => {
    if (width < 640) return 11;
    if (width < 1100) return 18;
    return 26;
  };

  /** The gust needs enough leaves to actually obscure the page. */
  const introCount = (): number => {
    if (width < 640) return 46;
    if (width < 1100) return 80;
    return 124;
  };

  const spawnAmbient = (offscreen: boolean): Leaf => {
    const depth = Math.random();
    return {
      x: offscreen ? -60 - Math.random() * 240 : Math.random() * width,
      y: Math.random() * height,
      size: 10 + depth * 17,
      depth,
      variant: Math.floor(Math.random() * VARIANTS),
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.7,
      phase: Math.random(),
      // Turns per second. Nearer leaves tumble a little faster.
      phaseRate: 0.22 + Math.random() * 0.3,
      drift: 0.4 + Math.random() * 0.8,
    };
  };

  /**
   * Intro leaves start already spread across the viewport rather than streaming
   * in from the left, so the first frame is dense. Ramping them in would waste
   * a third of a budget that is only about a second long.
   */
  const spawnIntro = (): Leaf => {
    const depth = Math.random();
    return {
      x: Math.random() * (width + 360) - 240,
      y: Math.random() * (height + 240) - 120,
      size: 12 + depth * 30,
      depth,
      variant: Math.floor(Math.random() * VARIANTS),
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2.4,
      phase: Math.random(),
      phaseRate: 0.9 + Math.random() * 1.5,
      drift: 0.3 + Math.random() * 1.5,
    };
  };

  const resize = (): void => {
    // A page that loads in a background tab reports innerWidth 0 in some
    // browsers. Sizing the canvas to 0 there is unrecoverable unless we
    // re-measure when it becomes visible, which onVisibility now does.
    const w = window.innerWidth || document.documentElement.clientWidth || 0;
    const h = window.innerHeight || document.documentElement.clientHeight || 0;
    if (w === 0 || h === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = w;
    height = h;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = ambientCount();
    if (ambient.length > count) {
      ambient.length = count;
    } else {
      while (ambient.length < count) ambient.push(spawnAmbient(false));
    }
  };

  /**
   * Start the gust, but only once the page is actually on screen and measured.
   * Playing it into a hidden background tab would spend the whole intro on
   * nobody, and the visitor would arrive to the ambient drift already running.
   */
  const maybeArmIntro = (): void => {
    if (!introArmed || introClock !== null) return;
    if (document.hidden || width === 0 || height === 0 || !graded) return;

    introArmed = false;
    intro = Array.from({ length: introCount() }, spawnIntro);
    introClock = 0;
    // Recorded at the start, not the end, so navigating away mid-gust does
    // not earn a second one.
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      // Storage blocked: the gust simply plays again next load.
    }
  };

  const drawLeaf = (leaf: Leaf, alpha: number): void => {
    if (!graded || alpha <= 0.004) return;
    const col = Math.floor(leaf.phase * FRAMES) % FRAMES;
    const size = leaf.size;

    context.save();
    context.translate(leaf.x, leaf.y);
    context.rotate(leaf.angle);
    context.globalAlpha = alpha;
    context.drawImage(
      graded,
      col * TILE,
      leaf.variant * TILE,
      TILE,
      TILE,
      -size,
      -size,
      size * 2,
      size * 2,
    );
    context.restore();
  };

  const step = (time: number): void => {
    if (!running) return;
    // Clamped so a backgrounded tab does not teleport every leaf on the next
    // frame. `delta` is in 60fps-equivalent frames; `seconds` drives the intro.
    const rawMs = lastTime === 0 ? 16.67 : time - lastTime;
    const seconds = Math.min(rawMs / 1000, 0.05);
    const delta = Math.min(rawMs / 16.67, 3);
    lastTime = time;

    gustPhase += 0.0042 * delta;
    const gust = 1 + Math.sin(gustPhase) * 0.45 + Math.sin(gustPhase * 2.3) * 0.18;

    context.clearRect(0, 0, width, height);

    // --- Opening gust -----------------------------------------------------
    let ambientAlpha = 1;
    if (introClock !== null) {
      introClock += seconds;

      // Leaves slow as the gust passes, so the handover to the ambient drift
      // is a deceleration rather than a cut.
      const decay = 1 - 0.78 * smoothstep(0, INTRO_TOTAL, introClock);

      // The clearing front. It has to outrun the leaves, or they would ride
      // ahead of it and never be caught.
      const wipe = smoothstep(INTRO_HOLD, INTRO_TOTAL, introClock);
      const front = -WIPE_BAND + wipe * (width + 2 * WIPE_BAND);

      // Ambient fades up under the tail of the gust, so there is no gap.
      ambientAlpha = smoothstep(INTRO_HOLD + INTRO_WIPE * 0.3, INTRO_TOTAL, introClock);

      for (const leaf of intro) {
        const speed = (5.5 + leaf.depth * 9) * gust * decay;
        leaf.phase = (leaf.phase + leaf.phaseRate * (delta / 60)) % 1;
        leaf.x += speed * delta;
        leaf.y += (leaf.drift * 1.1 + Math.sin(leaf.phase * Math.PI * 2) * 1.6) * delta;
        leaf.angle += leaf.spin * 0.02 * delta;

        // Fade out once the front has passed this leaf: left clears first.
        const cleared = smoothstep(front - WIPE_BAND, front, leaf.x);
        const alpha = (0.55 + leaf.depth * 0.4) * cleared;
        drawLeaf(leaf, alpha);
      }

      if (introClock >= INTRO_TOTAL) {
        introClock = null;
        intro = [];
      }
    }

    // --- Ambient drift ----------------------------------------------------
    for (const leaf of ambient) {
      const speed = (0.55 + leaf.depth * 1.75) * gust;

      leaf.phase = (leaf.phase + leaf.phaseRate * (delta / 60)) % 1;
      leaf.x += speed * delta;
      // Leaves fall gently and sway. The sway is tied to the tumble phase, so
      // the sideways drift and the turn read as one motion.
      leaf.y += (leaf.drift * 0.32 + Math.sin(leaf.phase * Math.PI * 2) * 0.6) * delta;
      leaf.angle += leaf.spin * 0.01 * delta;

      if (leaf.x - leaf.size > width + 60 || leaf.y - leaf.size > height + 60) {
        Object.assign(leaf, spawnAmbient(true), { y: Math.random() * height * 0.7 });
      }

      drawLeaf(leaf, (0.26 + leaf.depth * 0.46) * ambientAlpha);
    }

    frame = requestAnimationFrame(step);
  };

  const start = (): void => {
    if (running || reducedMotion.matches || !graded) return;
    running = true;
    lastTime = 0;
    frame = requestAnimationFrame(step);
  };

  const stop = (): void => {
    running = false;
    cancelAnimationFrame(frame);
  };

  const onVisibility = (): void => {
    if (document.hidden) {
      stop();
      return;
    }
    // Re-measure first: if the page loaded in a background tab the canvas may
    // still be 0x0, and starting the loop without this draws nothing forever.
    resize();
    maybeArmIntro();
    start();
  };

  const onMotionPreference = (): void => {
    if (reducedMotion.matches) {
      stop();
      context.clearRect(0, 0, width, height);
    } else {
      start();
    }
  };

  const themeObserver = new MutationObserver(() => {
    grade();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  resize();
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  reducedMotion.addEventListener("change", onMotionPreference);

  // Only fetch the sprite sheet if the leaves will actually run. Under reduced
  // motion this is 90KB nobody needs, and there is no gust either: a burst of
  // fast full-screen motion is exactly what that preference is asking us not
  // to do.
  if (!reducedMotion.matches) {
    let alreadyPlayed = false;
    try {
      alreadyPlayed = sessionStorage.getItem(INTRO_KEY) === "1";
    } catch {
      alreadyPlayed = false;
    }

    const requestedAt = performance.now();
    const image = new Image();
    image.decoding = "async";
    image.src = SHEET_SRC;
    image.onload = () => {
      sheet = image;
      grade();
      // On a slow connection the sheet can arrive long after the visitor has
      // started reading. Throwing a full-screen gust over them at that point
      // is an interruption, not an entrance, so past this window the site
      // just begins with the ambient drift.
      const LATE_MS = 2000;
      introArmed = !alreadyPlayed && performance.now() - requestedAt < LATE_MS;
      maybeArmIntro();
      start();
    };
    // No handler on error: the layer is decorative, so it stays empty.
  }

  return () => {
    stop();
    themeObserver.disconnect();
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVisibility);
    reducedMotion.removeEventListener("change", onMotionPreference);
  };
}
