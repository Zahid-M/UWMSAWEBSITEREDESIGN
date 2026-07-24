import React, { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { twinkle, prefersReducedMotion } from "../lib/animations.js";

const GOLD = "#B7A57A";

/* ════════════════════════════════════════════════════════════════════════
   FooterOrnament — requirement 10. A small geometric motif fades in once
   near the viewport, and a scatter of tiny "stars" twinkle at a very
   slow, near-invisible pace forever after. Meant to sit quietly at the
   bottom of the page, not announce itself.
   ════════════════════════════════════════════════════════════════════════ */

export default function FooterOrnament({ starCount = 14, color = GOLD }) {
  const rootRef = useRef(null);
  const starsRef = useRef([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let fired = false;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fired) {
        fired = true;
        if (!prefersReducedMotion()) {
          animate(root.querySelector(".msa-footer-glyph"), {
            opacity: [0, 0.5],
            scale: [0.9, 1],
            duration: 1400,
            ease: "outQuad",
          });
        }
        const twinkleAnim = twinkle(starsRef.current, { staggerMs: 700, duration: 6000 });
        return () => twinkleAnim?.revert?.();
      }
    }, { threshold: 0.1 });
    obs.observe(root);
    return () => obs.disconnect();
  }, []);

  const stars = Array.from({ length: starCount }, (_, i) => ({
    id: i, left: (i * 137.5) % 100, top: 10 + ((i * 53) % 80),
  }));

  return (
    <div ref={rootRef} aria-hidden="true" style={{
      position: "relative", height: 70, overflow: "hidden",
    }}>
      {stars.map((s, i) => (
        <span key={s.id}
          ref={(el) => (starsRef.current[i] = el)}
          style={{
            position: "absolute", left: `${s.left}%`, top: `${s.top}%`,
            width: 2, height: 2, borderRadius: "50%", background: color, opacity: 0.15,
          }} />
      ))}
      <svg className="msa-footer-glyph" viewBox="0 0 100 100" width="26" height="26"
        style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -13, marginTop: -13, opacity: 0 }}>
        <polygon
          points={Array.from({ length: 16 }).map((_, i) => {
            const r = i % 2 === 0 ? 46 : 20;
            const a = (Math.PI / 8) * i - Math.PI / 2;
            return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
          }).join(" ")}
          fill={color}
        />
      </svg>
    </div>
  );
}
