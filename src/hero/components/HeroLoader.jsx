import React, { useEffect, useRef, useState } from "react";
import { drawThenFill, prefersReducedMotion } from "../lib/animations.js";

/* ════════════════════════════════════════════════════════════════════════
   HeroLoader — requirement 9. A single gold eight-point star is drawn
   with SVG strokes, glows softly, then the whole overlay fades to reveal
   the page underneath. Mount this once above the rest of the hero;
   it removes itself from the DOM after onDone fires.

   Kept intentionally simple (no logo asset assumed) — swap the star for
   an <image> of the real UW MSA logo and cross-fade the same way if you
   want the "morph into the logo" variant described in the brief.
   ════════════════════════════════════════════════════════════════════════ */

function starPath(cx, cy, outer, inner) {
  let d = "";
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    d += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2) + " ";
  }
  return d + "Z";
}

export default function HeroLoader({ onDone, gold = "#B7A57A", ink = "#141118" }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(false);
      onDone?.();
      return;
    }
    const anim = drawThenFill(".msa-loader-stroke", ".msa-loader-fill", {
      drawDuration: 1500,
      fillDuration: 700,
      onComplete: () => {
        setFading(true);
        setTimeout(() => {
          setVisible(false);
          onDone?.();
        }, 650); // matches the CSS fade-out transition below
      },
    });
    return () => anim?.revert?.();
  }, [onDone]);

  if (!visible) return null;

  const d = starPath(100, 100, 74, 32);

  return (
    <div ref={rootRef} aria-hidden="true" style={{
      position: "fixed", inset: 0, zIndex: 999, display: "grid", placeItems: "center",
      background: ink,
      opacity: fading ? 0 : 1,
      transition: "opacity 650ms cubic-bezier(.4,0,.2,1)",
      pointerEvents: fading ? "none" : "auto",
    }}>
      <svg viewBox="0 0 200 200" width="120" height="120">
        <defs>
          <filter id="msa-star-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path className="msa-loader-fill" d={d} fill={gold} opacity="0" filter="url(#msa-star-glow)" />
        <path className="msa-loader-stroke" d={d} fill="none" stroke={gold} strokeWidth="1.6"
          strokeLinejoin="round" filter="url(#msa-star-glow)" />
      </svg>
    </div>
  );
}
