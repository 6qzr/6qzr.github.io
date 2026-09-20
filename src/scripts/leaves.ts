/**
 * Wind-blown leaves drifting across a layer above the page.
 *
 * One canvas, one rAF loop, `transform`/`opacity`-free DOM — the whole effect
 * is a single composited layer, so it does not interact with page layout at
 * all. It is decoration: it never blocks pointer events and the site is
 * complete without it.
 */

interface Leaf {
  x: number;
  y: number;
  size: number;
  /** Depth in [0,1]: 0 is far (small, slow, faint), 1 is near. */
  depth: number;
  angle: number;
  spin: number;
  /** Phase of the flutter oscillation, so leaves do not beat in unison. */
  flutter: number;
  flutterRate: number;
  drift: number;
}

const MAX_DPR = 2;

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

  const leafColor = (): string => {
    const tint = getComputedStyle(document.documentElement)
      .getPropertyValue("--leaf-tint")
      .trim();
    return tint || "#4d9738";
  };
  let color = leafColor();

  /** Leaf count scales with viewport area, with a hard ceiling. */
  const targetCount = (): number => {
    if (width < 640) return 9;
    if (width < 1100) return 14;
    return 20;
  };

  const spawn = (offscreen: boolean): Leaf => {
    const depth = Math.random();
    return {
      x: offscreen ? -40 - Math.random() * 220 : Math.random() * width,
      y: Math.random() * height,
      size: 5 + depth * 9,
      depth,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.9,
      flutter: Math.random() * Math.PI * 2,
      flutterRate: 1.1 + Math.random() * 1.5,
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
    const { size } = leaf;
    // scaleY simulates the leaf turning edge-on as it flutters: at the extremes
    // it nearly vanishes, which reads as rotation in 3D without the cost of it.
    const turn = Math.cos(leaf.flutter);

    context.save();
    context.translate(leaf.x, leaf.y);
    context.rotate(leaf.angle);
    context.scale(1, Math.max(0.12, Math.abs(turn)));
    // Nearer leaves are more opaque; all of them stay faint enough to read
    // text through.
    context.globalAlpha = 0.14 + leaf.depth * 0.26;
    context.fillStyle = color;

    context.beginPath();
    context.moveTo(0, -size);
    context.bezierCurveTo(size * 0.82, -size * 0.42, size * 0.82, size * 0.42, 0, size);
    context.bezierCurveTo(-size * 0.82, size * 0.42, -size * 0.82, -size * 0.42, 0, -size);
    context.fill();

    // Midrib, only on the larger foreground leaves where it is actually visible.
    if (leaf.depth > 0.55) {
      context.globalAlpha *= 0.5;
      context.strokeStyle = color;
      context.lineWidth = Math.max(0.5, size * 0.07);
      context.beginPath();
      context.moveTo(0, -size * 0.82);
      context.lineTo(0, size * 0.82);
      context.stroke();
    }

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

      leaf.flutter += leaf.flutterRate * 0.045 * delta;
      leaf.x += speed * delta;
      // Leaves fall gently and sway; the sway is tied to the same flutter phase
      // so the sideways drift and the turn look like one motion.
      leaf.y += (leaf.drift * 0.35 + Math.sin(leaf.flutter) * 0.55) * delta;
      leaf.angle += leaf.spin * 0.012 * delta;

      // Recycle off the right edge / bottom back to the left.
      if (leaf.x - leaf.size > width + 40 || leaf.y - leaf.size > height + 40) {
        Object.assign(leaf, spawn(true), { y: Math.random() * height * 0.75 });
      }

      drawLeaf(leaf);
    }

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

  // The leaf tint differs between midday and dusk.
  const themeObserver = new MutationObserver(() => {
    color = leafColor();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  resize();
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  reducedMotion.addEventListener("change", onMotionPreference);
  start();

  return () => {
    stop();
    themeObserver.disconnect();
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVisibility);
    reducedMotion.removeEventListener("change", onMotionPreference);
  };
}
