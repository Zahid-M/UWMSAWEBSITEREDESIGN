import React, { useEffect, useRef, useState } from "react";
import IslamicPattern from "./IslamicPattern.jsx";
import HeroLoader from "./HeroLoader.jsx";
import { heroRevealTimeline, floatingGlow, scrollScrub, prefersReducedMotion } from "../lib/animations.js";

const PURPLE_DEEP = "#2c1f47";
const PURPLE = "#4B2E83";
const GOLD = "#B7A57A";

/* ════════════════════════════════════════════════════════════════════════
   Hero — requirements 2 (reveal), 3 (floating light), 7 (scroll scale +
   pattern parallax, handled partly inside IslamicPattern), 9 (loader).

   Sequence on load: HeroLoader draws + fades → hero fades in from black
   → title / subtitle / CTAs rise into place with staggered timing.
   ════════════════════════════════════════════════════════════════════════ */

export default function Hero({
  eyebrow = "University of Washington",
  title = "Muslim Student Association",
  subtitle = "A home for faith, community, and belonging on the UW campus.",
  primaryCta = { label: "Join MSA", href: "#connect" },
  secondaryCta = { label: "See what's on", href: "#events" },
}) {
  const [loaderDone, setLoaderDone] = useState(prefersReducedMotion());
  const sectionRef = useRef(null);
  const stageRef = useRef(null);     // scales down on scroll
  const eyebrowRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const ctaRef = useRef(null);
  const glowARef = useRef(null);
  const glowBRef = useRef(null);

  // Staggered entrance, only once the loader has handed off.
  useEffect(() => {
    if (!loaderDone) return;
    const tl = heroRevealTimeline([
      { target: eyebrowRef.current, distance: 16, duration: 700, at: 0 },
      { target: titleRef.current, distance: 26, duration: 950, at: 120 },
      { target: subtitleRef.current, distance: 18, duration: 800, at: 480 },
      { target: ctaRef.current, distance: 18, duration: 800, at: 680 },
    ]);
    return () => tl?.revert?.();
  }, [loaderDone]);

  // Floating golden light, drifting almost imperceptibly behind content.
  useEffect(() => {
    const a = floatingGlow(glowARef.current, { x: 46, y: 30, duration: 16000 });
    const b = floatingGlow(glowBRef.current, { x: -38, y: 24, duration: 19000, delay: 2000 });
    return () => { a?.revert?.(); b?.revert?.(); };
  }, []);

  // Scroll: hero scales down slightly and the gold light drifts with it.
  useEffect(() => {
    const stage = scrollScrub(stageRef.current, { scale: [1, 0.94], opacity: [1, 0.85] }, {
      container: sectionRef.current, enter: "top top", leave: "bottom top",
    });
    const glow = scrollScrub(glowARef.current, { translateY: [0, 90] }, {
      container: sectionRef.current, enter: "top top", leave: "bottom top",
    });
    return () => { stage?.revert?.(); glow?.revert?.(); };
  }, []);

  return (
    <section ref={sectionRef} style={{
      position: "relative", overflow: "hidden", minHeight: "100vh",
      display: "grid", placeItems: "center",
      background: `radial-gradient(120% 100% at 50% 0%, ${PURPLE_DEEP} 0%, #141118 70%)`,
      color: "#fff",
    }}>
      <HeroLoader onDone={() => setLoaderDone(true)} />

      <IslamicPattern color={GOLD} opacity={0.07} />

      {/* Floating golden light — requirement 3 */}
      <div aria-hidden="true" ref={glowARef} style={{
        position: "absolute", top: "12%", left: "18%", width: 420, height: 420,
        borderRadius: "50%", filter: "blur(90px)",
        background: `radial-gradient(circle, ${GOLD}33 0%, transparent 70%)`,
      }} />
      <div aria-hidden="true" ref={glowBRef} style={{
        position: "absolute", bottom: "8%", right: "14%", width: 360, height: 360,
        borderRadius: "50%", filter: "blur(80px)",
        background: `radial-gradient(circle, ${PURPLE}44 0%, transparent 70%)`,
      }} />

      <div ref={stageRef} style={{
        position: "relative", zIndex: 2, textAlign: "center",
        maxWidth: 780, padding: "0 24px", willChange: "transform, opacity",
      }}>
        <div ref={eyebrowRef} style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 16px",
          borderRadius: 999, background: "rgba(183,165,122,.14)",
          border: `1px solid rgba(183,165,122,.35)`, marginBottom: 22,
          fontSize: 13, fontWeight: 600, letterSpacing: ".4px", opacity: 0,
        }}>
          {eyebrow}
        </div>

        <h1 ref={titleRef} style={{
          fontSize: "clamp(34px,5.4vw,60px)", fontWeight: 800, lineHeight: 1.08,
          letterSpacing: "-1.4px", margin: "0 0 22px", opacity: 0,
        }}>
          {title}
        </h1>

        <p ref={subtitleRef} style={{
          fontSize: "clamp(16px,1.9vw,19px)", color: "rgba(255,255,255,.82)",
          maxWidth: 560, margin: "0 auto 34px", lineHeight: 1.65, opacity: 0,
        }}>
          {subtitle}
        </p>

        <div ref={ctaRef} style={{
          display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", opacity: 0,
        }}>
          <a href={primaryCta.href} style={{
            background: GOLD, color: "#2c2418", padding: "14px 28px", borderRadius: 12,
            fontWeight: 700, fontSize: 15.5, textDecoration: "none",
          }}>{primaryCta.label}</a>
          <a href={secondaryCta.href} style={{
            background: "rgba(255,255,255,.1)", color: "#fff", padding: "14px 28px",
            borderRadius: 12, fontWeight: 600, fontSize: 15.5, textDecoration: "none",
            border: "1px solid rgba(255,255,255,.28)",
          }}>{secondaryCta.label}</a>
        </div>
      </div>
    </section>
  );
}
