/**
 * Wind-blown leaves drifting across a layer above the page.
 *
 * The leaves are a sprite sheet rendered in Blender (see tools/render_leaves.py):
 * three colour variants, each a full 360-degree turn about the leaf's long axis
 * across 24 frames. Stepping through a row plays a real lit 3D tumble, with the
 * leaf going edge-on and flat again, which a flat 2D shape cannot fake. The row
 * loops seamlessly because the rotation completes exactly one turn.
 *
 * One canvas, one rAF loop, no DOM. The whole effect is a single composited
 * layer. It is decoration: pointer events are off, and the site is complete
 * without it, so every failure path here simply draws nothing.
 */

const SHEET_SRC = "/images/leaves.webp";
const FRAMES = 24;
const VARIANTS = 3;
const TILE = 64;
const MAX_DPR = 2;

interface Leaf {
  x: number;
  y: number;
  size: number;
  /** Depth in [0,1]: 0 is far (small, slow, faint), 1 is near. */
  depth: number;
  /** Which colour row of the sheet this leaf uses. */
  variant: number;
  /** In-plane rotation, on top of the rendered tumble. */
  angle: number;
  spin: number;
  /** Position within the tumble cycle, in turns. */
  phase: number;
  phaseRate: number;
  drift: number;
}

export function initLeaves(canvas: HTMLCanvasElement): () => void {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return () => {};

  let leaves: Leaf[] = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let running = false;
  let lastTime = 0;
  /** Slowly wandering gust strength, so the wind is never metronomic. */
  let gustPhase = Math.random() * Math.PI * 2;

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

  /** Leaf count scales with viewport, with a hard ceiling. */
  const targetCount = (): number => {
    if (width < 640) return 8;
    if (width < 1100) return 13;
    return 18;
  };

  const spawn = (offscreen: boolean): Leaf => {
    const depth = Math.random();
    return {
      x: offscreen ? -60 - Math.random() * 240 : Math.random() * width,
      y: Math.random() * height,
      size: 9 + depth * 15,
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

  const resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = targetCount();
    if (leaves.length > count) {
      leaves.length = count;
    } else {
      while (leaves.length < count) leaves.push(spawn(false));
    }
  };

  const drawLeaf = (leaf: Leaf): void => {
    if (!graded) return;
    const col = Math.floor(leaf.phase * FRAMES) % FRAMES;
    const size = leaf.size;

    context.save();
    context.translate(leaf.x, leaf.y);
    context.rotate(leaf.angle);
    // Nearer leaves are more opaque; all stay faint enough to read text through.
    context.globalAlpha = 0.2 + leaf.depth * 0.42;
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
    // Delta in 60fps-equivalent frames, clamped so a backgrounded tab does not
    // teleport every leaf on the next frame.
    const delta = lastTime === 0 ? 1 : Math.min((time - lastTime) / 16.67, 3);
    lastTime = time;

    gustPhase += 0.0042 * delta;
    const gust = 1 + Math.sin(gustPhase) * 0.45 + Math.sin(gustPhase * 2.3) * 0.18;

    context.clearRect(0, 0, width, height);

    for (const leaf of leaves) {
      const speed = (0.55 + leaf.depth * 1.75) * gust;

      leaf.phase = (leaf.phase + leaf.phaseRate * (delta / 60)) % 1;
      leaf.x += speed * delta;
      // Leaves fall gently and sway. The sway is tied to the tumble phase, so
      // the sideways drift and the turn read as one motion.
      leaf.y += (leaf.drift * 0.32 + Math.sin(leaf.phase * Math.PI * 2) * 0.6) * delta;
      leaf.angle += leaf.spin * 0.01 * delta;

      if (leaf.x - leaf.size > width + 60 || leaf.y - leaf.size > height + 60) {
        Object.assign(leaf, spawn(true), { y: Math.random() * height * 0.7 });
      }

      drawLeaf(leaf);
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
    if (document.hidden) stop();
    else start();
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
  // motion this is 48KB nobody needs.
  if (!reducedMotion.matches) {
    const image = new Image();
    image.decoding = "async";
    image.src = SHEET_SRC;
    image.onload = () => {
      sheet = image;
      grade();
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
