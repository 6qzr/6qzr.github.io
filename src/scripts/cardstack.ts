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

/** How far out the card arcs before coming back in, as a fraction of width. */
const ARC = 0.72;

interface Slot {
  x: number;
  y: number;
  rotate: number;
  scale: number;
}

/** Resting position for a card at a given depth, 0 being the front. */
function slotAt(depth: number, width: number): Slot {
  // Offsets in px, scaled a little with the card so the fan holds its shape
  // at any size.
  const step = Math.max(14, width * 0.045);
  return {
    x: depth * step,
    y: depth * -step * 0.52,
    rotate: depth * 3.6,
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

  /** Card indices, front first. */
  let order = cards.map((_, i) => i);
  let flying = false;
  let width = root.getBoundingClientRect().width || 480;

  const layout = (): void => {
    order.forEach((cardIndex, depth) => {
      const card = cards[cardIndex];
      if (!card) return;
      card.style.transform = transformFor(slotAt(depth, width));
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
    const from = slotAt(0, width);
    const to = slotAt(backDepth, width);

    if (reducedMotion.matches) {
      order = [...order.slice(1), frontIndex];
      layout();
      return;
    }

    flying = true;

    // Everything else steps forward immediately, under CSS transitions, while
    // the front card takes the long way round.
    const rest = order.slice(1);
    rest.forEach((cardIndex, depth) => {
      const other = cards[cardIndex];
      if (!other) return;
      other.style.transform = transformFor(slotAt(depth, width));
      other.style.zIndex = String(cards.length - depth);
    });

    const flight = card.animate(
      [
        { transform: transformFor(from), offset: 0 },
        {
          // Out and away, lifted and turned, clearly in front of the deck.
          transform: `translate3d(${(width * ARC).toFixed(2)}px, ${(-width * 0.1).toFixed(2)}px, 0) rotate(13deg) scale(1.04)`,
          offset: 0.42,
        },
        {
          // Dropping in behind, still wide of the stack.
          transform: `translate3d(${(width * 0.34).toFixed(2)}px, ${(to.y - 10).toFixed(2)}px, 0) rotate(${(to.rotate + 4).toFixed(2)}deg) scale(${(to.scale - 0.02).toFixed(3)})`,
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
      const flight = card.animate(
        [
          { transform: transformFor(slotAt(backDepth, width)), offset: 0 },
          {
            transform: `translate3d(${(width * ARC).toFixed(2)}px, ${(-width * 0.1).toFixed(2)}px, 0) rotate(13deg) scale(1.04)`,
            offset: 0.5,
          },
          { transform: transformFor(slotAt(0, width)), offset: 1 },
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
      other.style.transform = transformFor(slotAt(i + 1, width));
      other.style.zIndex = String(cards.length - (i + 1));
    });
  };

  const onCardClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    // A click on a link inside the card is a click on that link, not a deal.
    if (target.closest("a, button")) return;
    next();
  };

  for (const card of cards) {
    card.addEventListener("click", onCardClick);
  }

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

  const onResize = (): void => {
    width = root.getBoundingClientRect().width || width;
    if (!flying) layout();
  };
  window.addEventListener("resize", onResize, { passive: true });

  root.classList.add("is-ready");
  layout();

  return () => {
    window.removeEventListener("resize", onResize);
    root.removeEventListener("keydown", onKey);
    for (const card of cards) card.removeEventListener("click", onCardClick);
  };
}
