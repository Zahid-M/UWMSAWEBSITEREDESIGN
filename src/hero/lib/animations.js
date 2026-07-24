/* ════════════════════════════════════════════════════════════════════════
   animations.js — shared anime.js v4 helpers for the UW MSA hero system.

   Every effect in the hero (reveal, drift, glow, scroll-scrub, hover-draw)
   is built from these few primitives so there is one place that owns
   easing curves, timing, and the reduced-motion escape hatch. Nothing
   here is UI — it only returns anime instances / cleanup functions.
   ════════════════════════════════════════════════════════════════════════ */

import { animate, createTimeline, createDrawable, onScroll, stagger, utils } from "animejs";

/* Cinematic, slow, never-bouncy easing. Reused everywhere so the whole
   page feels like it was cut by one editor. */
export const EASE = {
  reveal: "outExpo",       // hero text / cards settling into place
  drift: "inOutSine",      // background pattern breathing
  glow: "inOutQuad",       // floating light movement
  draw: "inOutSine",       // SVG stroke drawing
  scroll: "linear",        // scroll-scrubbed values should track 1:1 by default
};

export function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/* ---------- 2. Hero reveal --------------------------------------------
   Fades + slides a set of elements upward in a staggered sequence.
   Pass an array of refs/selectors in the order they should appear; each
   gets its own entry in the timeline via `at`, so gaps read as intent
   rather than a fixed stagger(). */
export function heroRevealTimeline(steps, { onComplete } = {}) {
  if (prefersReducedMotion()) {
    steps.forEach(({ target }) => utils.set(target, { opacity: 1, translateY: 0 }));
    onComplete?.();
    return null;
  }
  const tl = createTimeline({ defaults: { ease: EASE.reveal }, onComplete });
  steps.forEach(({ target, distance = 22, duration = 900, at }) => {
    tl.add(target, {
      opacity: [0, 1],
      translateY: [distance, 0],
      duration,
    }, at); // `at` is a timeline position label/offset e.g. "-=600" or a ms mark
  });
  return tl;
}

/* ---------- 4/5. Viewport-entrance reveal for cards --------------------
   Fade + scale-from-0.95 + slight rise, staggered across a NodeList.
   Used by both prayer-time cards and event cards on first appearance. */
export function revealCardsIn(targets, { staggerMs = 90, distance = 16 } = {}) {
  if (prefersReducedMotion()) {
    utils.set(targets, { opacity: 1, scale: 1, translateY: 0 });
    return null;
  }
  return animate(targets, {
    opacity: [0, 1],
    scale: [0.95, 1],
    translateY: [distance, 0],
    duration: 700,
    delay: stagger(staggerMs),
    ease: EASE.reveal,
  });
}

/* ---------- 3. Floating gold light --------------------------------------
   An imperceptibly slow, looping drift for the radial-gradient glows
   behind the hero content. Uses a timeline with alternate direction
   instead of CSS keyframes so easing stays consistent with the rest
   of the system and can be paused/reverted from JS. */
export function floatingGlow(target, { x = 40, y = 30, duration = 14000, delay = 0 } = {}) {
  if (prefersReducedMotion()) return null;
  return animate(target, {
    translateX: [0, x, 0],
    translateY: [0, y, 0],
    duration,
    delay,
    loop: true,
    ease: EASE.glow,
  });
}

/* ---------- 1. Background pattern drift + rotate -----------------------
   Very slow continuous rotation plus a slight positional breathe, tuned
   to feel alive without ever drawing the eye. */
export function patternDrift(target, { rotate = 6, x = 18, y = 12, duration = 42000 } = {}) {
  if (prefersReducedMotion()) return null;
  return animate(target, {
    rotate: [-rotate, rotate],
    translateX: [-x, x],
    translateY: [-y, y],
    duration,
    loop: true,
    alternate: true,
    ease: EASE.drift,
  });
}

/* ---------- 8. Mouse-reactive parallax ----------------------------------
   Shifts `target` by at most `range` px toward the cursor. Deliberately
   small (10–20px) per spec. Returns a cleanup function. Movement itself
   is animated (not snapped) so it stays smooth at 60fps. */
export function mouseParallax(el, { target, range = 16, duration = 900 } = {}) {
  if (prefersReducedMotion() || !el) return () => {};
  const node = target || el;
  let frame = null;

  const onMove = (e) => {
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;   // -0.5 .. 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      animate(node, {
        translateX: px * range * 2,
        translateY: py * range * 2,
        duration,
        ease: "outQuad",
      });
    });
  };
  const onLeave = () => {
    animate(node, { translateX: 0, translateY: 0, duration: 1200, ease: "outQuad" });
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerleave", onLeave);
  return () => {
    cancelAnimationFrame(frame);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerleave", onLeave);
  };
}

/* ---------- 7. Scroll-scrubbed transform --------------------------------
   Thin wrapper around anime's onScroll() so every scroll-linked effect
   in the hero (scale-down, parallax drift, gold light follow) shares the
   same enter/leave thresholds and easing curve. */
export function scrollScrub(target, props, { container, sync = true, enter = "top top", leave = "bottom top" } = {}) {
  if (prefersReducedMotion()) return null;
  return animate(target, {
    ...props,
    ease: EASE.scroll,
    autoplay: onScroll({
      target: container || target,
      enter,
      leave,
      sync,
    }),
  });
}

/* ---------- 6/9. Self-drawing SVG geometry -------------------------------
   Draws stroked paths on the given selector, then (optionally) fades a
   fill layer in once the stroke completes — the "draw, then become a
   filled geometric pattern" effect used for the loader and dividers. */
export function drawThenFill(strokeSelector, fillSelector, { drawDuration = 1400, fillDuration = 900, staggerMs = 40, onComplete } = {}) {
  if (prefersReducedMotion()) {
    utils.set(strokeSelector, { opacity: 1 });
    utils.set(fillSelector, { opacity: 1 });
    onComplete?.();
    return null;
  }
  return animate(createDrawable(strokeSelector), {
    draw: ["0 0", "0 1"],
    duration: drawDuration,
    delay: stagger(staggerMs),
    ease: EASE.draw,
    onComplete: () => {
      animate(fillSelector, {
        opacity: [0, 1],
        duration: fillDuration,
        ease: "outQuad",
        onComplete,
      });
    },
  });
}

/* ---------- 10. Very slow twinkle ----------------------------------------
   Near-invisible opacity pulse for footer ornament stars. */
export function twinkle(targets, { staggerMs = 900, duration = 5200 } = {}) {
  if (prefersReducedMotion()) return null;
  return animate(targets, {
    opacity: [0.12, 0.4, 0.12],
    duration,
    delay: stagger(staggerMs, { from: "random" }),
    loop: true,
    ease: "inOutSine",
  });
}

export { utils };
