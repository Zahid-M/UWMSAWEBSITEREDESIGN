import React, { useEffect, useRef } from "react";
import { drawThenFill } from "../lib/animations.js";

const GOLD = "#B7A57A";

/* ════════════════════════════════════════════════════════════════════════
   GeometricDivider — requirement 6. A row of interlocking 8-point stars
   whose outlines draw themselves in via strokeDashoffset as the divider
   scrolls into view, then softly fill. Triggered once via
   IntersectionObserver (not onScroll-scrubbed — this one plays through).
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

export default function GeometricDivider({ count = 5, color = GOLD, height = 90 }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let fired = false;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fired) {
        fired = true;
        const anim = drawThenFill(
          `#${root.id} .msa-divider-stroke`,
          `#${root.id} .msa-divider-fill`,
          { drawDuration: 1100, fillDuration: 700, staggerMs: 90 }
        );
        return () => anim?.revert?.();
      }
    }, { threshold: 0.3 });
    obs.observe(root);
    return () => obs.disconnect();
  }, []);

  const spacing = 100;
  const width = count * spacing;
  const d = starPath(50, 50, 34, 15);

  return (
    <div ref={rootRef} id="msa-geometric-divider" style={{
      width: "100%", display: "flex", justifyContent: "center", padding: "8px 0",
    }} aria-hidden="true">
      <svg viewBox={`0 0 ${width} 100`} width="100%" height={height}
        preserveAspectRatio="xMidYMid meet" style={{ maxWidth: 640 }}>
        {Array.from({ length: count }).map((_, i) => (
          <g key={i} transform={`translate(${i * spacing},0)`}>
            <path className="msa-divider-fill" d={d} fill={color} opacity="0" />
            <path className="msa-divider-stroke" d={d} fill="none" stroke={color} strokeWidth="1.4" />
          </g>
        ))}
      </svg>
    </div>
  );
}
