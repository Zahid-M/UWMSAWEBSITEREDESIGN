import React, { useEffect, useRef } from "react";
import { patternDrift, mouseParallax, scrollScrub } from "../lib/animations.js";

/* ════════════════════════════════════════════════════════════════════════
   IslamicPattern — the subtle 8-point-star / mashrabiya lattice that
   lives behind the hero. Requirements 1, 7 (parallax) and 8 (cursor)
   all live in this one component since they all act on the same layer.

   - opacity is fixed low (default 7%) — never made a prop the caller can
     crank up, so it can't accidentally become a decoration.
   - the SVG <pattern> tile is generated once from a small unit motif,
     matching the girih-tile approach already used elsewhere on the site.
   ════════════════════════════════════════════════════════════════════════ */

function tile(unit) {
  const c = unit / 2, outer = unit * 0.42, inner = unit * 0.22;
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    pts.push(`${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`);
  }
  const spokes = [
    [c, c - outer, c, 0], [c, c + outer, c, unit],
    [c - outer, c, 0, c], [c + outer, c, unit, c],
  ];
  return { star: pts.join(" "), spokes };
}

export default function IslamicPattern({
  color = "#B7A57A",
  opacity = 0.07,
  unit = 72,
  className = "",
}) {
  const wrapRef = useRef(null);   // reacts to cursor (req. 8)
  const layerRef = useRef(null);  // drifts + rotates (req. 1) + scroll parallax (req. 7)
  const id = useRef(`msa-lattice-${Math.round(unit)}`).current;
  const { star, spokes } = tile(unit);

  useEffect(() => {
    const drift = patternDrift(layerRef.current, { rotate: 5, x: 14, y: 10, duration: 46000 });
    const cleanupMouse = mouseParallax(wrapRef.current, { target: layerRef.current, range: 14 });
    const scrub = scrollScrub(layerRef.current, { translateY: [0, 60] }, {
      container: wrapRef.current?.closest("section") || wrapRef.current,
      enter: "top bottom",
      leave: "bottom top",
    });
    return () => {
      drift?.revert?.();
      scrub?.revert?.();
      cleanupMouse();
    };
  }, []);

  return (
    <div ref={wrapRef} className={className} aria-hidden="true"
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "auto", zIndex: 0 }}>
      <svg ref={layerRef} width="140%" height="140%"
        style={{ position: "absolute", top: "-20%", left: "-20%", willChange: "transform" }}
        aria-hidden="true">
        <defs>
          <pattern id={id} width={unit} height={unit} patternUnits="userSpaceOnUse">
            <g fill="none" stroke={color} strokeWidth="1" opacity={opacity}>
              <polygon points={star} />
              {spokes.map((s, i) => <line key={i} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} />)}
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
