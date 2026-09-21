/**
 * A deck of project cards, stacked and tilted like a hand of playing cards.
 *
 * Clicking the front card sends it out and around to the back of the deck
 * while everything behind steps forward. The flight is a single Web Animations
 * keyframe run rather than a CSS transition, because the card has to travel an
 * arc: out and away first, then in behind the others. A transition can only
 * interpolate straight from A to B, which reads as the card sliding through
 * the deck rather than around it.
 *
 * Nothing here is required to read the content. Without JavaScript the cards
 * fall back to a plain stacked list, and the previous and next buttons work
 * the same as clicking.
 */

/** Flight time. Slow enough to watch, short enough not to wait on. */
const FLIGHT = 720;

/** Below this the phone geometry applies. Matches the CSS breakpoint. */
const NARROW = 768;

/** A swipe has to cover this much before it counts as one. */
const SWIPE_MIN = 44;

/** How the fan is shaped. */
interface Fan {
  /** Offset per card, as a fraction of the deck width. */
  step: number;
  /** How much of that offset goes upward. */
  lift: number;
  /** Degrees of turn per card. */
  rotate: number;
  /** How far out a card arcs on its way round, in px. */
  arc: number;
}

/**
 * Desktop keeps the numbers it was tuned with. A phone is not a small desktop:
 * the desktop fan leans a card a tenth of the deck sideways and throws it most
 * of a deck-width on the way round, which on a 390px screen is most of the
 * viewport. The document then grew wider than the window on every deal and iOS
 * Safari answered by moving the page sideways under the thumb holding it,
 * which is the shake. The phone fan is tighter and its arc is measured against
 * the window rather than the deck, so the card stays on the screen it is on.
 */
function fanFor(width: number): Fan {
  const viewport = window.innerWidth || width;
  if (viewport < NARROW) {
    return { step: 0.038, lift: 0.42, rotate: 2.2, arc: Math.min(width * 0.5, viewport * 0.22) };
  }
  return { step: 0.045, lift: 0.52, rotate: 3.6, arc: width * 0.72 };
}

interface Slot {
  x: number;
  y: number;
  rotate: number;
  scale: number;
}

/** Resting position for a card at a given depth, 0 being the front. */
function slotAt(depth: number, width: number, fan: Fan): Slot {
  // Offsets in px, scaled a little with the card so the fan holds its shape
  // at any size.
  const step = Math.max(14, width * fan.step);
  return {
    x: depth * step,
    y: depth * -step * fan.lift,
    rotate: depth * fan.rotate,
    scale: 1 - depth * 0.045,
  };
}

function transformFor(slot: Slot): string {
  return `translate3d(${slot.x.toFixed(2)}px, ${slot.y.toFixed(2)}px, 0) rotate(${slot.rotate.toFixed(2)}deg) scale(${slot.scale.toFixed(3)})`;
}

export function initCardStack(root: HTMLElement): () => void {
  const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-card]"));
  if (cards.length < 2) return () => {};

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const status = root.querySelector<HTMLElement>("[data-stack-status]");
  const dots = Array.from(root.querySelectorAll<HTMLElement>("[data-stack-dot]"));
  const box = root.querySelector<HTMLElement>("[data-card-box]");

  /** Card indices, front first. */
  let order = cards.map((_, i) => i);
  let flying = false;
  let width = root.getBoundingClientRect().width || 480;
  let fan = fanFor(width);

  const layout = (): void => {
    order.forEach((cardIndex, depth) => {
      const card = cards[cardIndex];
      if (!card) return;
      card.style.transform = transformFor(slotAt(depth, width, fan));
      card.style.zIndex = String(cards.length - depth);
      const isFront = depth === 0;
      card.classList.toggle("is-front", isFront);
      // Background cards are visually behind and mostly covered, so they are
      // taken out of the tab order and the accessibility tree. The controls
      // below the deck are how everything stays reachable.
      card.inert = !isFront;
      card.setAttribute("aria-hidden", isFront ? "false" : "true");
    });

    if (status) status.textContent = `${order[0]! + 1} of ${cards.length}`;
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-current", i === order[0]);
      dot.setAttribute("aria-current", i === order[0] ? "true" : "false");
    });
  };

  const settle = (): void => {
    flying = false;
    root.classList.remove("is-flying");
    layout();
  };

  /** Send the front card around to the back. */
  const next = (): void => {
    if (flying) return;
    const frontIndex = order[0];
    if (frontIndex === undefined) return;
    const card = cards[frontIndex];
    if (!card) return;

    const backDepth = cards.length - 1;
    const from = slotAt(0, width, fan);
    const to = slotAt(backDepth, width, fan);

    if (reducedMotion.matches) {
      order = [...order.slice(1), frontIndex];
      layout();
      return;
    }

    flying = true;
    root.classList.add("is-flying");

    // Everything else steps forward immediately, under CSS transitions, while
    // the front card takes the long way round.
    const rest = order.slice(1);
    rest.forEach((cardIndex, depth) => {
      const other = cards[cardIndex];
      if (!other) return;
      other.style.transform = transformFor(slotAt(depth, width, fan));
      other.style.zIndex = String(cards.length - depth);
    });

    const flight = card.animate(
      [
        { transform: transformFor(from), offset: 0 },
        {
          // Out and away, lifted and turned, clearly in front of the deck.
          transform: `translate3d(${fan.arc.toFixed(2)}px, ${(-width * 0.1).toFixed(2)}px, 0) rotate(13deg) scale(1.04)`,
          offset: 0.42,
        },
        {
          // Dropping in behind, still wide of the stack.
          transform: `translate3d(${(fan.arc * 0.47).toFixed(2)}px, ${(to.y - 10).toFixed(2)}px, 0) rotate(${(to.rotate + 4).toFixed(2)}deg) scale(${(to.scale - 0.02).toFixed(3)})`,
          offset: 0.74,
        },
        { transform: transformFor(to), offset: 1 },
      ],
      { duration: FLIGHT, easing: "cubic-bezier(0.33, 0, 0.2, 1)", fill: "forwards" },
    );

    // Drop it behind the others once it is clear of them. z-index cannot be
    // animated smoothly, so it is switched at the point the card is furthest
    // out and the change cannot be seen.
    const dropBehind = window.setTimeout(() => {
      card.style.zIndex = "0";
    }, FLIGHT * 0.5);

    flight.addEventListener("finish", () => {
      window.clearTimeout(dropBehind);
      flight.cancel();
      order = [...order.slice(1), frontIndex];
      settle();
    });
    flight.addEventListener("cancel", () => window.clearTimeout(dropBehind));
  };

  /** Bring the back card to the front. The same flight, played backwards. */
  const previous = (): void => {
    if (flying) return;
    const backIndex = order[order.length - 1];
    if (backIndex === undefined) return;
    order = [backIndex, ...order.slice(0, -1)];

    if (reducedMotion.matches) {
      layout();
      return;
    }

    const card = cards[backIndex];
    const backDepth = cards.length - 1;
    if (card) {
      flying = true;
      root.classList.add("is-flying");
      const flight = card.animate(
        [
          { transform: transformFor(slotAt(backDepth, width, fan)), offset: 0 },
          {
            transform: `translate3d(${fan.arc.toFixed(2)}px, ${(-width * 0.1).toFixed(2)}px, 0) rotate(13deg) scale(1.04)`,
            offset: 0.5,
          },
          { transform: transformFor(slotAt(0, width, fan)), offset: 1 },
        ],
        { duration: FLIGHT, easing: "cubic-bezier(0.33, 0, 0.2, 1)", fill: "forwards" },
      );
      card.style.zIndex = String(cards.length + 1);
      flight.addEventListener("finish", () => {
        flight.cancel();
        settle();
      });
    }

    // The rest slide back a place while it travels.
    order.slice(1).forEach((cardIndex, i) => {
      const other = cards[cardIndex];
      if (!other) return;
      other.style.transform = transformFor(slotAt(i + 1, width, fan));
      other.style.zIndex = String(cards.length - (i + 1));
    });
  };

  /** Set by a swipe, so the click it ends with is not also a deal. */
  let swiped = false;

  const onCardClick = (event: MouseEvent): void => {
    if (swiped) {
      swiped = false;
      return;
    }
    const target = event.target as HTMLElement;
    // A click on a link inside the card is a click on that link, not a deal.
    if (target.closest("a, button")) return;
    next();
  };

  for (const card of cards) {
    card.addEventListener("click", onCardClick);
  }

  /*
    Swiping is how a deck of cards is dealt with a thumb, and on a phone it is
    the gesture people try first. The page still scrolls: touch-action on the
    card box hands horizontal movement to us and keeps vertical movement with
    the browser, and the axis is settled once per gesture, so a slightly
    diagonal scroll does not also turn the deck.
  */
  let startX = 0;
  let startY = 0;
  let axis: "x" | "y" | null = null;

  const onTouchStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (!touch || event.touches.length > 1) return;
    startX = touch.clientX;
    startY = touch.clientY;
    axis = null;
    swiped = false;
  };

  const onTouchMove = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (!touch || axis !== null) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
  };

  const onTouchEnd = (event: TouchEvent): void => {
    if (axis !== "x") return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    if (Math.abs(dx) < SWIPE_MIN) return;
    swiped = true;
    if (dx < 0) next();
    else previous();
  };

  // Passive throughout: nothing here calls preventDefault, because the CSS has
  // already told the browser which axis it may scroll.
  box?.addEventListener("touchstart", onTouchStart, { passive: true });
  box?.addEventListener("touchmove", onTouchMove, { passive: true });
  box?.addEventListener("touchend", onTouchEnd, { passive: true });

  const nextButton = root.querySelector<HTMLElement>("[data-stack-next]");
  const prevButton = root.querySelector<HTMLElement>("[data-stack-prev]");
  nextButton?.addEventListener("click", next);
  prevButton?.addEventListener("click", previous);

  const onKey = (event: KeyboardEvent): void => {
    if (!root.contains(document.activeElement)) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      previous();
    }
  };
  root.addEventListener("keydown", onKey);

  /*
    iOS fires resize every time the Safari toolbar slides away, which happens
    repeatedly during an ordinary scroll and never changes the width. Re-laying
    the deck out on each of those is work for nothing, and doing it mid-flight
    would snap the travelling card back into the stack.
  */
  const onResize = (): void => {
    const measured = root.getBoundingClientRect().width || width;
    if (measured === width) return;
    width = measured;
    fan = fanFor(width);
    if (!flying) layout();
  };
  window.addEventListener("resize", onResize, { passive: true });

  root.classList.add("is-ready");
  layout();

  return () => {
    window.removeEventListener("resize", onResize);
    root.removeEventListener("keydown", onKey);
    box?.removeEventListener("touchstart", onTouchStart);
    box?.removeEventListener("touchmove", onTouchMove);
    box?.removeEventListener("touchend", onTouchEnd);
    for (const card of cards) card.removeEventListener("click", onCardClick);
  };
}
