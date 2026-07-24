import React, { useEffect, useRef } from "react";
import { revealCardsIn } from "../lib/animations.js";

const GOLD = "#B7A57A";
const PURPLE = "#4B2E83";

/* ════════════════════════════════════════════════════════════════════════
   useRevealOnEnter — one IntersectionObserver per grid, firing the
   fade + scale(0.95→1) + rise stagger from animations.js the first time
   the grid enters the viewport. Shared by PrayerTimeCards & EventCards.
   ════════════════════════════════════════════════════════════════════════ */
function useRevealOnEnter(selector) {
  const gridRef = useRef(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const items = grid.querySelectorAll(selector);
    let fired = false;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fired) {
        fired = true;
        revealCardsIn(items, { staggerMs: 90, distance: 16 });
        obs.disconnect();
      }
    }, { threshold: 0.2 });
    obs.observe(grid);
    return () => obs.disconnect();
  }, [selector]);
  return gridRef;
}

/* ---------- 4. Prayer time cards ---------------------------------------- */
export function PrayerTimeCards({ times = [] }) {
  const gridRef = useRevealOnEnter(".msa-prayer-card");
  return (
    <div ref={gridRef} style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
      gap: 14,
    }}>
      {times.map((t) => (
        <div key={t.name} className="msa-prayer-card" style={{
          opacity: 0, borderRadius: 16, padding: "20px 18px",
          background: "#fff", border: "1px solid rgba(75,46,131,.08)",
          boxShadow: "0 8px 24px rgba(43,25,74,.06)", textAlign: "center",
        }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".6px",
            color: PURPLE, textTransform: "uppercase", marginBottom: 8 }}>{t.name}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#1c1424" }}>{t.time}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- 5. Event cards ------------------------------------------------
   Entrance uses the same reveal-on-enter hook; hover motion (lift, shadow,
   gold border glow, image zoom) is deliberately plain CSS — those are
   continuous, input-driven micro-interactions, not one-shot timelines, so
   CSS transitions are the cheaper and smoother tool for them. */
export function EventCards({ events = [] }) {
  const gridRef = useRevealOnEnter(".msa-event-card");
  return (
    <div ref={gridRef} style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 22,
    }}>
      {events.map((e) => (
        <a key={e.title} href={e.href || "#"} className="msa-event-card" style={{
          opacity: 0, display: "block", borderRadius: 18, overflow: "hidden",
          textDecoration: "none", background: "#fff",
          border: "1px solid rgba(75,46,131,.08)",
          boxShadow: "0 8px 20px rgba(43,25,74,.06)",
        }}>
          <div style={{ position: "relative", overflow: "hidden", aspectRatio: "16/10" }}>
            <img className="msa-event-card__img" src={e.image} alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
          <div style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 12.5, color: GOLD, fontWeight: 700, marginBottom: 6 }}>{e.date}</div>
            <div style={{ fontSize: 16.5, fontWeight: 700, color: "#1c1424" }}>{e.title}</div>
          </div>
        </a>
      ))}

      <style>{`
        .msa-event-card {
          transition: transform 420ms cubic-bezier(.2,.7,.2,1),
                      box-shadow 420ms cubic-bezier(.2,.7,.2,1),
                      border-color 420ms ease;
        }
        .msa-event-card__img { transition: transform 900ms cubic-bezier(.2,.7,.2,1); }
        .msa-event-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 22px 44px rgba(43,25,74,.16);
          border-color: rgba(183,165,122,.55);
        }
        .msa-event-card:hover .msa-event-card__img { transform: scale(1.06); }
        @media (prefers-reduced-motion: reduce) {
          .msa-event-card, .msa-event-card__img { transition: none !important; }
          .msa-event-card:hover { transform: none; }
        }
      `}</style>
    </div>
  );
}
