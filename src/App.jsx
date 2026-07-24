import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase, loadContent, saveContent, uploadImage, deleteImage, pathFromUrl } from "./supabase";
import {
  Menu, X, Heart, MapPin, Clock, Calendar, Users, BookOpen,
  ShoppingBag, Instagram, Facebook, MessageCircle, Link2,
  Lock, LogOut, Plus, Trash2, Edit3, ChevronLeft, ChevronRight,
  Home, Star, HandHeart, GraduationCap, Sparkles, ExternalLink, Save
} from "lucide-react";

/* ============================================================
   MSA UW — single-page site + in-session admin dashboard
   Colors: UW Purple #4B2E83, Gold #B7A57A
   Note: content edits persist for the browser session only
   (artifacts can't use storage). Wire to a backend to persist.
   ============================================================ */

// Palette derived from the MSA at UW logo (crescent + Seattle skyline):
// near-black base, a purple→pink gradient, and gold accents.
const INK = "#141118";        // logo black base
const INK2 = "#1f1a29";       // slightly lifted black for panels
const PURPLE = "#5b3d8c";     // primary purple (deepened from logo mauve for text contrast)
const PURPLE_D = "#3a2660";   // deep purple
const VIOLET = "#8c78b4";     // logo blue-violet
const MAUVE = "#a078a8";      // logo mauve
const PINK = "#b4788c";       // logo dusty rose (gradient tail)
const GOLD = "#c9b688";       // warmer gold accent, reads on black
const GOLD_D = "#B7A57A";     // original gold, for light surfaces
// signature gradient lifted straight from the logo
const GRAD = `linear-gradient(120deg, ${VIOLET} 0%, ${MAUVE} 45%, ${PINK} 100%)`;
const GRAD_DEEP = `linear-gradient(135deg, ${INK} 0%, ${PURPLE_D} 55%, ${PURPLE} 100%)`;

const SECTIONS = [
  { id: "home", label: "Home", external: false },
  { id: "prayer", label: "Prayer", external: false },
  { id: "events", label: "Events", external: false },
  { id: "programs", label: "Programs", external: false },
  { id: "merch", label: "Merch", external: true, href: "https://intentionshq.com/products/msa-x-intentions-off-white-hoodie" },
  { id: "connect", label: "Connect", external: false },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Eight-point star — signature motif, drawn as inline SVG
function Star8({ size = 40, color = GOLD, opacity = 1, className = "" }) {
  const pts = [];
  const cx = 50, cy = 50;
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? 48 : 20;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className}
         style={{ opacity }} aria-hidden="true">
      <polygon points={pts.join(" ")} fill={color} />
    </svg>
  );
}

// Girih tessellation — interlocking 8-point stars linked into a tile grid,
// generated so the geometry is exact. Used as a repeating decorative band.
function girihTile(unit, color) {
  const c = unit / 2, outer = unit * 0.4, inner = unit * 0.21;
  const star = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    star.push(`${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`);
  }
  // spokes reaching to each edge midpoint, so stars interlock across tiles
  const spokes = [[c, c - outer, c, 0], [c, c + outer, c, unit],
    [c - outer, c, 0, c], [c + outer, c, unit, c]];
  return { star: star.join(" "), spokes };
}
function GirihBand({ color = GOLD, bg = "transparent", height = 60, opacity = 0.5, unit = 60 }) {
  const id = "girih-" + Math.round(unit) + "-" + color.replace("#", "");
  const { star, spokes } = girihTile(unit, color);
  return (
    <svg width="100%" height={height} preserveAspectRatio="xMidYMid slice"
         style={{ display: "block", background: bg }} aria-hidden="true">
      <defs>
        <pattern id={id} width={unit} height={unit} patternUnits="userSpaceOnUse">
          <g fill="none" stroke={color} strokeWidth="1.3" opacity={opacity}>
            <polygon points={star} />
            {spokes.map((s, i) => <line key={i} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} />)}
            {/* small linking diamonds at corners */}
            <polygon points={`0,0 ${unit*0.12},${-unit*0.12} 0,${-unit*0.24} ${-unit*0.12},${-unit*0.12}`}
              transform={`translate(${unit/2},${unit/2})`} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height={height} fill={`url(#${id})`} />
    </svg>
  );
}

// Pointed (mihrab) arch outline — width/height driven, exact curve.
function archPath(w, h, spring) {
  // spring = height where the straight jambs end and the arch begins
  const cx = w / 2;
  return `M0,${h} L0,${spring} Q0,${spring * 0.35} ${cx},0 Q${w},${spring * 0.35} ${w},${spring} L${w},${h} Z`;
}
function Arch({ w = 120, h = 160, spring, stroke = PURPLE, sw = 2, fill = "none", children, style }) {
  const sp = spring ?? h * 0.55;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%"
         preserveAspectRatio="none" style={style} aria-hidden="true">
      <path d={archPath(w, h, sp)} fill={fill} stroke={stroke} strokeWidth={sw} />
      {children}
    </svg>
  );
}

// Muqarnas-inspired stepped cornice — two offset tiers for a vaulted look.
function Muqarnas({ color = GOLD, height = 22, cells = 10, opacity = 0.9 }) {
  const w = 100, step = w / cells;
  const tier = (y0, h, phase) => {
    let d = `M0,${y0}`;
    for (let i = 0; i <= cells; i++) {
      const x = i * step + phase;
      d += ` L${(x - step * 0.5).toFixed(2)},${(y0 + h).toFixed(2)} L${x.toFixed(2)},${y0}`;
    }
    d += ` L${w},${y0} Z`;
    return d;
  };
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height}
         preserveAspectRatio="none" style={{ display: "block" }} aria-hidden="true">
      <path d={tier(0, height * 0.55, 0)} fill={color} opacity={opacity} />
      <path d={tier(height * 0.42, height * 0.55, step / 2)} fill={color} opacity={opacity * 0.6} />
    </svg>
  );
}

// Full-section star lattice — a soft, repeating geometric texture for the
// background of light content sections. Deliberately faint so text stays
// readable. Sits behind content via absolute positioning + low opacity.
function StarLatticeBg({ color = PURPLE, opacity = 0.05, unit = 64 }) {
  const c = unit / 2, outer = unit * 0.5, inner = unit * 0.3;
  const star = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    star.push(`${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`);
  }
  const spokes = [[c, c - outer, c, 0], [c, c + outer, c, unit],
    [c - outer, c, 0, c], [c + outer, c, unit, c]];
  const id = "lattice-" + Math.round(unit) + "-" + Math.round(opacity * 1000);
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity,
      pointerEvents: "none", zIndex: 0 }}>
      <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice"
           style={{ display: "block" }}>
        <defs>
          <pattern id={id} width={unit} height={unit} patternUnits="userSpaceOnUse">
            <g fill="none" stroke={color} strokeWidth="1.1">
              <polygon points={star.join(" ")} />
              {spokes.map((s, i) => <line key={i} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} />)}
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}



/* ── Scroll reveal ──────────────────────────────────────────────────────
   Wrap anything in <Reveal> and it fades + rises into place the first time
   it scrolls into view, then stays put. Uses IntersectionObserver — no
   scroll hijacking. Respects prefers-reduced-motion. */
/* ════════════════════════════════════════════════════════════════════════
   MOTION FOUNDATION
   Shared easing, timing, and reveal primitives. Everything animated on the
   site composes from these so timing stays consistent and tunable in one
   place. Only transform/opacity are animated (GPU-friendly, 60fps).
   ════════════════════════════════════════════════════════════════════════ */

const EASE = {
  // Primary: decelerating, calm arrival. Used for most entrances.
  out: "cubic-bezier(.16,.84,.44,1)",
  // Softer, longer tail — for large elements (hero, images).
  outSoft: "cubic-bezier(.22,.61,.36,1)",
  // Gentle both ends — for hover and state changes.
  inOut: "cubic-bezier(.65,.05,.36,1)",
  // Slight overshoot — used sparingly (buttons, badges).
  spring: "cubic-bezier(.34,1.36,.64,1)",
};

const DUR = {
  fast: 260,
  base: 620,
  slow: 900,
  hero: 1100,
};

// Single source of truth for the reduced-motion preference, kept live so
// the site responds if the user changes it mid-session.
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduced(mq.matches);
    const on = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

// Fires once when the element scrolls into view.
function useInView({ threshold = 0.15, rootMargin = "0px 0px -10% 0px", once = true } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); if (once) obs.disconnect(); }
      else if (!once) setInView(false);
    }, { threshold, rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin, once]);
  return [ref, inView];
}

/* Reveal — the workhorse entrance animation.
   variant: "up" | "down" | "left" | "right" | "fade" | "scale" | "blur"
   Composes transform + opacity only. */
const REVEAL_VARIANTS = {
  up:    (d) => `translate3d(0, ${d}px, 0)`,
  down:  (d) => `translate3d(0, ${-d}px, 0)`,
  left:  (d) => `translate3d(${d}px, 0, 0)`,
  right: (d) => `translate3d(${-d}px, 0, 0)`,
  fade:  () => "none",
  scale: (d) => `scale(${1 - d / 260})`,
  rise:  (d) => `translate3d(0, ${d}px, 0) scale(${1 - d / 900})`,
};

function Reveal({
  children, delay = 0, distance = 26, variant = "up",
  duration = DUR.base, ease = EASE.out, style, threshold = 0.15, as: Tag = "div", ...rest
}) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView({ threshold });
  const show = reduced || inView;
  const from = (REVEAL_VARIANTS[variant] || REVEAL_VARIANTS.up)(distance);
  return (
    <Tag ref={ref} style={{
      opacity: show ? 1 : 0,
      transform: show ? "translate3d(0,0,0)" : from,
      transition: reduced ? "none"
        : `opacity ${duration}ms ${ease} ${delay}ms, transform ${duration}ms ${ease} ${delay}ms`,
      willChange: show ? "auto" : "opacity, transform",
      ...style,
    }} {...rest}>{children}</Tag>
  );
}

/* Stagger — reveals children in sequence with a shared rhythm.
   Avoids hand-writing delay={n * 70} everywhere. */
function Stagger({ children, step = 80, base = 0, variant = "up", distance = 26,
  duration = DUR.base, ease = EASE.out, style, ...rest }) {
  const items = React.Children.toArray(children);
  return (
    <>
      {items.map((child, i) => (
        <Reveal key={child.key ?? i} delay={base + i * step} variant={variant}
          distance={distance} duration={duration} ease={ease} style={style} {...rest}>
          {child}
        </Reveal>
      ))}
    </>
  );
}

/* TextReveal — splits a string into words that rise in sequence.
   Uses inline-block spans; whitespace preserved so wrapping is natural. */
function TextReveal({ text, delay = 0, step = 42, duration = DUR.slow,
  ease = EASE.outSoft, style, as: Tag = "span" }) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView({ threshold: 0.25 });
  const show = reduced || inView;
  const words = String(text).split(" ");
  return (
    <Tag ref={ref} style={{ display: "inline-block", ...style }}>
      {words.map((w, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden",
          verticalAlign: "top" }}>
          <span style={{
            display: "inline-block",
            opacity: show ? 1 : 0,
            transform: show ? "translate3d(0,0,0)" : "translate3d(0,0.9em,0)",
            transition: reduced ? "none"
              : `opacity ${duration}ms ${ease} ${delay + i * step}ms, transform ${duration}ms ${ease} ${delay + i * step}ms`,
          }}>{w}</span>
          {i < words.length - 1 && <span>&nbsp;</span>}
        </span>
      ))}
    </Tag>
  );
}


/* ── Cherry blossoms ────────────────────────────────────────────────────
   Petals drifting down behind the hero content. Pure CSS animation on a
   handful of SVG petals — cheap, and skipped for reduced-motion users. */
function Petal({ color, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 C14.5 6, 18 7, 20.5 6.5 C19.5 10, 20 13.5, 22 16 C18.5 16.5, 15.5 18.5, 14 22 C13 18.5, 12 17, 12 17 C12 17, 11 18.5, 10 22 C8.5 18.5, 5.5 16.5, 2 16 C4 13.5, 4.5 10, 3.5 6.5 C6 7, 9.5 6, 12 2 Z"
        fill={color} opacity="0.85" />
    </svg>
  );
}
function CherryBlossoms({ count = 16 }) {
  const [on, setOn] = useState(true);
  useEffect(() => { setOn(!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches); }, []);
  const petals = React.useMemo(() => {
    const colors = [PINK, MAUVE, "#e8c4d4", GOLD];
    return Array.from({ length: count }, (_, i) => ({
      id: i, left: (i * 97) % 100, size: 10 + ((i * 7) % 12),
      duration: 9 + ((i * 3) % 8), delay: -((i * 13) % 16),
      drift: (i % 2 === 0 ? 1 : -1) * (20 + (i * 11) % 50),
      color: colors[i % colors.length], spin: (i % 2 === 0 ? 1 : -1) * (180 + (i * 37) % 360),
    }));
  }, [count]);
  if (!on) return null;
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden",
      pointerEvents: "none", zIndex: 1 }}>
      <style>{`
        @keyframes petalFall {
          0% { transform: translate3d(0,-12%,0) rotate(0deg); opacity: 0; }
          8% { opacity: .9; } 92% { opacity: .75; }
          100% { transform: translate3d(var(--drift),112%,0) rotate(var(--spin)); opacity: 0; }
        }
        .petal { position:absolute; top:0; animation-name:petalFall;
                 animation-timing-function:linear; animation-iteration-count:infinite; }
      `}</style>
      {petals.map((p) => (
        <span key={p.id} className="petal" style={{ left: `${p.left}%`,
          animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`,
          "--drift": `${p.drift}px`, "--spin": `${p.spin}deg` }}>
          <Petal color={p.color} size={p.size} />
        </span>
      ))}
    </div>
  );
}

/* ── Parallax ───────────────────────────────────────────────────────────
   Drifts a decorative element as it passes through the viewport. Transform
   only (no layout thrash), rAF-throttled, off for reduced-motion users. */
function Parallax({ speed = 0.15, children, style, float = false, ...rest }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const target = useRef(0);
  const current = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    // Read scroll position into a target, then ease toward it every frame.
    // The interpolation is what removes the "stepping" feel of raw scroll
    // parallax and gives it the smooth, weighted quality of a good agency site.
    const measure = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const progress = (r.top + r.height / 2 - vh / 2) / vh;
      target.current = progress * speed * 100;
    };

    const tick = () => {
      current.current += (target.current - current.current) * 0.085; // lerp
      if (el) el.style.transform = `translate3d(0, ${current.current.toFixed(2)}px, 0)`;
      raf.current = requestAnimationFrame(tick);
    };

    measure();
    current.current = target.current;
    el.style.transform = `translate3d(0, ${current.current.toFixed(2)}px, 0)`;
    raf.current = requestAnimationFrame(tick);

    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [speed, reduced]);

  return (
    <div ref={ref} aria-hidden="true"
      className={float && !reduced ? "floaty-slow" : undefined}
      style={{
        position: "absolute", pointerEvents: "none", zIndex: 0,
        willChange: "transform", ...style,
      }} {...rest}>{children}</div>
  );
}

/* ── Botanical accents ──────────────────────────────────────────────── */
function Blossom({ size = 18, color = PINK, cx = 0, cy = 0, rot = 0 }) {
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * (Math.PI / 180);
    const px = cx + Math.cos(a) * size * 0.28, py = cy + Math.sin(a) * size * 0.28;
    petals.push(
      <ellipse key={i} cx={px} cy={py} rx={size * 0.26} ry={size * 0.34}
        transform={`rotate(${i * 72 + rot} ${px} ${py})`} fill={color} opacity="0.9" />
    );
  }
  return <g>{petals}<circle cx={cx} cy={cy} r={size * 0.11} fill={GOLD} opacity="0.95" /></g>;
}

function SakuraBranch({ width = 260, flip = false, opacity = 0.9, style }) {
  return (
    <svg width={width} height={width * 0.62} viewBox="0 0 260 160" aria-hidden="true"
      style={{ transform: flip ? "scaleX(-1)" : "none", opacity, display: "block", ...style }}>
      <path d="M-5 26 C60 34, 96 52, 132 78 C158 96, 190 106, 232 106"
        stroke="#5a4636" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M60 33 C74 46, 82 60, 84 76" stroke="#5a4636" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M132 78 C138 62, 150 50, 168 44" stroke="#5a4636" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M186 100 C196 86, 208 78, 224 74" stroke="#5a4636" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <Blossom cx={26} cy={28} size={22} color={PINK} rot={10} />
      <Blossom cx={70} cy={36} size={17} color="#e8c4d4" rot={30} />
      <Blossom cx={86} cy={78} size={19} color={MAUVE} rot={-15} />
      <Blossom cx={134} cy={80} size={22} color={PINK} rot={22} />
      <Blossom cx={168} cy={44} size={18} color="#e8c4d4" rot={-8} />
      <Blossom cx={192} cy={100} size={16} color={MAUVE} rot={40} />
      <Blossom cx={226} cy={72} size={20} color={PINK} rot={-25} />
      <Blossom cx={236} cy={108} size={15} color="#e8c4d4" rot={12} />
    </svg>
  );
}

function CrescentAccent({ size = 150, color = GOLD, opacity = 0.5, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true"
      style={{ opacity, display: "block", ...style }}>
      <path d="M62 12 A38 38 0 1 0 62 88 A30 30 0 1 1 62 12 Z" fill={color} />
      <circle cx="78" cy="30" r="3.2" fill={color} />
      <circle cx="86" cy="46" r="2.2" fill={color} />
      <circle cx="74" cy="60" r="1.8" fill={color} />
    </svg>
  );
}

function Lantern({ size = 70, color = GOLD, opacity = 0.55, style }) {
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 40 60" aria-hidden="true"
      style={{ opacity, display: "block", ...style }}>
      <line x1="20" y1="0" x2="20" y2="8" stroke={color} strokeWidth="1.5" />
      <path d="M12 8 h16 v3 h-16 Z" fill={color} />
      <path d="M9 11 C9 11, 4 22, 4 30 C4 40, 11 48, 20 48 C29 48, 36 40, 36 30 C36 22, 31 11, 31 11 Z"
        fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M4 30 h32" stroke={color} strokeWidth="1" opacity="0.6" />
      <path d="M7 21 h26 M7 39 h26" stroke={color} strokeWidth="0.9" opacity="0.45" />
      <path d="M14 48 h12 v3 h-12 Z" fill={color} />
      <line x1="20" y1="51" x2="20" y2="58" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

/* ── Animated counter — counts up when scrolled into view ───────────── */
function Counter({ to = 100, suffix = "", duration = 1600, label }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setVal(to); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started.current) return;
      started.current = true;
      obs.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);
  return (
    <div ref={ref} style={{ textAlign: "center", minWidth: 150 }}>
      <div style={{ fontSize: "clamp(34px,5vw,54px)", fontWeight: 800, color: GOLD,
        lineHeight: 1, letterSpacing: "-1px" }}>{val}{suffix}</div>
      <div style={{ marginTop: 8, fontSize: 13.5, color: "rgba(255,255,255,.75)",
        letterSpacing: ".5px" }}>{label}</div>
    </div>
  );
}

/* ── Stats band — dark strip with counting numbers ──────────────────── */
function StatsBand({ stats }) {
  return (
    <section style={{ position: "relative", overflow: "hidden", background: INK,
      padding: "72px 20px" }}>
      <AmbientGlow subtle />
      <Parallax speed={0.25} float style={{ top: -30, left: -40, opacity: .5 }}>
        <SakuraBranch width={240} opacity={.55} />
      </Parallax>
      <Parallax speed={-0.2} float style={{ bottom: -20, right: -30, opacity: .5 }}>
        <SakuraBranch width={220} flip opacity={.55} />
      </Parallax>
      <Parallax speed={0.4} float style={{ top: 30, right: "18%" }}>
        <CrescentAccent size={90} opacity={.28} />
      </Parallax>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto",
        display: "flex", justifyContent: "space-around", gap: 36, flexWrap: "wrap" }}>
        {stats.map((s, n) => (
          <Reveal key={s.id ?? n} delay={n * 110}>
            <Counter to={Number(s.value) || 0} suffix={s.suffix || ""} label={s.label} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const seed = {
  hero: {
    title: "University of Washington Muslim Student Association",
    mission: "A home away from home for Muslim Huskies — building faith, friendship, and community on Montlake and beyond.",
  },
  // To use a real photo, add img: "//your-file.jpg" (file goes in public/gallery/).
  // Without img, the card shows a colored gradient placeholder.
  gallery: [
    { id: 1, caption: "Eid on the Quad", tag: "Eid", img: "" },
    { id: 2, caption: "Friday Jummah", tag: "Jummah", img: "" },
    { id: 3, caption: "Fall Retreat", tag: "Retreat", img: "" },
    { id: 4, caption: "Welcome BBQ", tag: "Social", img: "" },
    { id: 5, caption: "Iftar Night", tag: "Ramadan", img: "" },
    { id: 6, caption: "Community Service Day", tag: "Service", img: "" },
  ],
  // To use a real logo, add logo: "/sponsors/your-file.png" (file goes in public/sponsors/).
  // Without logo, the card shows the sponsor's name as text.
  sponsors: [
    { id: 1, name: "Islamic House", logo: "" },
    { id: 2, name: "MAPS", logo: "" },
    { id: 3, name: "ASUW", logo: "" },
    { id: 4, name: "Local Halal Co.", logo: "" },
    { id: 5, name: "Ummah Foods", logo: "" },
    { id: 6, name: "Crescent Realty", logo: "" },
  ],
  prayerSpaces: [
    { id: 1, name: "HUB Reflection Room", loc: "Husky Union Building, Room 145", note: "Open during building hours · wudu station nearby" },
    { id: 2, name: "Islamic House", loc: "Near NE 45th St", note: "Full masjid · all five daily prayers" },
    { id: 3, name: "Odegaard Quiet Room", loc: "Odegaard Library, Ground Floor", note: "Quiet reflection · prayer mats available" },
    { id: 4, name: "Engineering Prayer Space", loc: "ECE Building", note: "Reservable · check MSA Discord for access" },
  ],
  prayerTimes: {
    // ── Masjidal live widget ──────────────────────────────────────────────
    // The current MSA site uses Masjidal (mymasjidal.com), which auto-updates
    // prayer times daily on its own. To use it here, get the Masjid ID from
    // whoever runs the MSA account (Settings → Web Integration on masjidal.com)
    // and paste it below. The card will then show the live, self-updating widget
    // and ignore the manual times underneath.
    //
    // If you instead have the full embed <iframe...> code from the old site,
    // paste it into masjidalEmbed as a string and it will be used as-is.
    masjidalId: "RKxwXOdO",       // e.g. "1234"
    masjidalEmbed: "",    // OR paste a full <iframe ...></iframe> string
    // ── Manual fallback (used only when both fields above are empty) ──────
    // Fajr: "5:42 AM", Dhuhr: "1:15 PM", Asr: "4:50 PM",
    // Maghrib: "7:38 PM", Isha: "9:05 PM",
    // jummah: "First khutbah 1:00 PM · Second 2:15 PM at Islamic House",
    // announcement: "Ramadan taraweeh begins after Isha — all welcome. Sisters' section on the east side.",
  },
  // Any event can take an optional img: "/events/your-file.jpg" (file in public/events/)
  // to show a banner photo at the top of its card. Monday shows the pattern.
  events: {
    Monday: [{ id: 1, name: "Quran Circle", time: "6:00 PM", loc: "HUB 145", desc: "Weekly tajweed & reflection", img: "" }],
    Tuesday: [{ id: 2, name: "Brothers' Halaqa", time: "7:00 PM", loc: "Islamic House", desc: "" }],
    Wednesday: [{ id: 3, name: "Sisters' Halaqa", time: "6:30 PM", loc: "HUB 145", desc: "" }],
    Thursday: [{ id: 4, name: "Mentorship Meetup", time: "5:00 PM", loc: "Odegaard", desc: "Pair with an upperclassman" }],
    Friday: [{ id: 5, name: "Jummah Prayer", time: "1:00 PM", loc: "Islamic House", desc: "Two khutbahs" }],
    Saturday: [{ id: 6, name: "Community Service", time: "10:00 AM", loc: "Varies", desc: "Check Discord for location" }],
    Sunday: [{ id: 7, name: "Social Night", time: "7:00 PM", loc: "Varies", desc: "Games, food, friends" }],
  },
  stats: [
    { id: 1, value: "40", suffix: "+", label: "Events each year" },
    { id: 2, value: "500", suffix: "+", label: "Students reached" },
    { id: 3, value: "6", suffix: "", label: "Weekly programs" },
  ],
  programs: [
    { id: 1, name: "Weekly Halaqas", desc: "Faith-centered circles for brothers and sisters, every week.", icon: "book" },
    { id: 2, name: "Quran Study", desc: "Tajweed, memorization, and reflection at every level.", icon: "star" },
    { id: 3, name: "Mentorship", desc: "New students paired with experienced Huskies for guidance.", icon: "grad" },
    { id: 4, name: "Sisters Program", desc: "Dedicated space, events, and support for sisters.", icon: "sparkles" },
    { id: 5, name: "Community Service", desc: "Give back through volunteering and local outreach.", icon: "hand" },
    { id: 6, name: "Social Events", desc: "BBQs, game nights, retreats, and Eid celebrations.", icon: "users" },
  ],
  links: [
    { id: 1, name: "Linktree", href: "https://linktr.ee/msauw", kind: "link" },
    { id: 2, name: "Join the Discord", href: "https://discord.gg/wb56SYhaF6", kind: "discord" },
    { id: 3, name: "Instagram", href: "https://instagram.com/msauw", kind: "instagram" },
    { id: 4, name: "MSA UW Facebook", href: "https://www.facebook.com/groups/650155172271569/", kind: "facebook" },
    { id: 5, name: "Sisters' Facebook Group", href: "https://www.facebook.com/groups/355223922312624/", kind: "facebook" },
    { id: 6, name: "Guide to being a Muslim at UW", href: "https://docs.google.com/document/d/16K_gyLqsaIWM-s6BXqNTarokx8q9srlzK3433G9VFZ0/edit?usp=sharing", kind: "link" },
    { id: 7, name: "Donate to MSA UW 💜", href: "https://www.zeffy.com/en-US/donation-form/44131d7a-557e-4fdc-9a70-14e9f67206ef", kind: "donate" },
    { id: 8, name: "Donate to the Islamic House", href: "https://www.zeffy.com/en-US/donation-form/0b12beb3-2da5-4c6b-87b9-cfc84cf47e6a", kind: "donate" },
  ],
};

const progIcon = (k, c = PURPLE) => {
  const p = { size: 26, color: c };
  return { book: <BookOpen {...p} />, star: <Star size={26} color={c} />, grad: <GraduationCap {...p} />,
    sparkles: <Sparkles {...p} />, hand: <HandHeart {...p} />, users: <Users {...p} /> }[k] || <Star size={26} color={c} />;
};

const linkIcon = (k) => {
  const p = { size: 24, color: "#fff" };
  return { link: <Link2 {...p} />, discord: <MessageCircle {...p} />, facebook: <Facebook {...p} />,
    instagram: <Instagram {...p} />, donate: <Heart {...p} /> }[k] || <Link2 {...p} />;
};

export default function App() {
  const [data, setData] = useState(seed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("home");
  const [adminOpen, setAdminOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // On load: pull saved content from Supabase (fall back to seed if empty),
  // and check whether an admin session is already active.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await loadContent();
      if (!cancelled && remote) setData({ ...seed, ...remote });
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) { setIsAdmin(!!session); setLoaded(true); }
    })();
    // keep isAdmin in sync if the session changes (login/logout/expiry)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAdmin(!!session);
    });
    return () => { cancelled = true; sub?.subscription?.unsubscribe(); };
  }, []);

  // Persist the whole content object to Supabase. Used by the admin panel's
  // Save button. Requires an authenticated session (enforced by RLS).
  const persist = useCallback(async (next) => {
    setSaving(true);
    const res = await saveContent(next);
    setSaving(false);
    return res;
  }, []);

  const scrollTo = useCallback((id) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // scroll spy
  useEffect(() => {
    const ids = SECTIONS.filter((s) => !s.external).map((s) => s.id);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [loaded]);

  return (
    <div style={{ fontFamily: "'Poppins', system-ui, sans-serif", color: "#1f1a2e", background: "#faf9fc" }}>
      <StyleTag />
      <Nav active={active} onNav={scrollTo} menuOpen={menuOpen} setMenuOpen={setMenuOpen}
           onAdmin={() => setAdminOpen(true)} isAdmin={isAdmin} />
      <main>
        <HomeSection data={data} onNav={scrollTo} />
        <PrayerSection data={data} />
        <EventsSection data={data} />
        <StatsBand stats={data.stats || []} />
        <ProgramsSection data={data} />
        <ConnectSection data={data} />
      </main>
      <Footer onAdmin={() => setAdminOpen(true)} />
      {adminOpen && (
        <AdminPanel
          data={data} setData={setData}
          isAdmin={isAdmin} setIsAdmin={setIsAdmin}
          persist={persist} saving={saving}
          onClose={() => setAdminOpen(false)}
        />
      )}
    </div>
  );
}

function StyleTag() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Amiri:wght@400;700&display=swap');
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body { margin: 0; }

      /* ── Accessibility: honour reduced-motion everywhere ────────────── */
      @media (prefers-reduced-motion: reduce) {
        html { scroll-behavior: auto; }
        *, *::before, *::after {
          animation-duration: .001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: .001ms !important;
          scroll-behavior: auto !important;
        }
      }

      /* ── Hero entrance ──────────────────────────────────────────────── */
      .reveal { opacity: 0; transform: translate3d(0,26px,0);
                animation: rise ${DUR.hero}ms ${EASE.outSoft} forwards; }
      @keyframes rise { to { opacity: 1; transform: translate3d(0,0,0); } }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* ── Card lift: two-stage easing so it feels weighted ───────────── */
      .lift { transition: transform ${DUR.fast}ms ${EASE.out},
                          box-shadow ${DUR.fast}ms ${EASE.out}; }
      .lift:hover { transform: translate3d(0,-6px,0);
                    box-shadow: 0 22px 48px rgba(75,46,131,.20); }
      .lift:active { transform: translate3d(0,-2px,0);
                     transition-duration: 90ms; }

      /* Inner media on a lifting card gets a slow counter-zoom — the depth
         cue that makes hover feel layered rather than flat. */
      .lift img, .zoomable img { transition: transform 900ms ${EASE.outSoft}; }
      .lift:hover img, .zoomable:hover img { transform: scale(1.045); }

      /* ── Buttons: press physics ─────────────────────────────────────── */
      .btn { transition: transform ${DUR.fast}ms ${EASE.spring},
                         box-shadow ${DUR.fast}ms ${EASE.out},
                         filter ${DUR.fast}ms ${EASE.out};
             will-change: transform; }
      .btn:hover { transform: translate3d(0,-2px,0); filter: brightness(1.06); }
      .btn:active { transform: translate3d(0,1px,0) scale(.985);
                    transition-duration: 80ms; }

      /* ── Nav links: underline grows from centre ─────────────────────── */
      .navlink { position: relative; }
      .navlink::after {
        content: ""; position: absolute; left: 50%; right: 50%; bottom: 4px;
        height: 2px; background: ${GOLD}; border-radius: 2px;
        transition: left ${DUR.fast}ms ${EASE.out}, right ${DUR.fast}ms ${EASE.out};
      }
      .navlink:hover::after { left: 14px; right: 14px; }

      /* ── Ambient background glow (very slow, very soft) ─────────────── */
      @keyframes glowDrift {
        0%   { transform: translate3d(0,0,0) scale(1); }
        50%  { transform: translate3d(3%,-2%,0) scale(1.12); }
        100% { transform: translate3d(0,0,0) scale(1); }
      }
      .glow { animation: glowDrift 22s ${EASE.inOut} infinite; will-change: transform; }

      /* ── Decorative float — for SVG accents ─────────────────────────── */
      @keyframes floatY {
        0%   { transform: translate3d(0,0,0) rotate(0deg); }
        50%  { transform: translate3d(0,-12px,0) rotate(1.4deg); }
        100% { transform: translate3d(0,0,0) rotate(0deg); }
      }
      .floaty { animation: floatY 9s ${EASE.inOut} infinite; }
      .floaty-slow { animation: floatY 15s ${EASE.inOut} infinite; }

      /* ── Sponsor logos: settle to full colour on hover ──────────────── */
      .sponsorlogo { filter: saturate(.55) opacity(.82);
                     transition: filter ${DUR.base}ms ${EASE.out},
                                 transform ${DUR.base}ms ${EASE.out}; }
      .lift:hover .sponsorlogo { filter: saturate(1) opacity(1);
                                 transform: scale(1.05); }

      /* ── Event cards: header tint deepens on hover ──────────────────── */
      .eventcard { transition: transform ${DUR.fast}ms ${EASE.out},
                               box-shadow ${DUR.fast}ms ${EASE.out},
                               border-color ${DUR.fast}ms ${EASE.out}; }
      .eventcard:hover { transform: translate3d(0,-5px,0);
                         box-shadow: 0 20px 44px rgba(75,46,131,.16); }

      /* ── Admin modal entrance ───────────────────────────────────────── */
      @keyframes modalBgIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes modalIn {
        from { opacity: 0; transform: translate3d(0,18px,0) scale(.975); }
        to   { opacity: 1; transform: translate3d(0,0,0) scale(1); }
      }
      .modalBg { animation: modalBgIn ${DUR.fast}ms ${EASE.out} both; }
      .modalIn { animation: modalIn ${DUR.base}ms ${EASE.out} 40ms both; }

      /* ── Gallery crossfade ──────────────────────────────────────────── */
      .xfade { transition: opacity 780ms ${EASE.outSoft},
                           transform 1500ms ${EASE.outSoft}; }

      a:focus-visible, button:focus-visible {
        outline: 3px solid ${GOLD}; outline-offset: 3px; border-radius: 6px;
      }
    `}</style>
  );
}

function Nav({ active, onNav, menuOpen, setMenuOpen, onAdmin }) {
  const [solid, setSolid] = useState(false);
  const [progress, setProgress] = useState(0);
  // rAF-throttled so scrolling stays at 60fps even on long pages.
  useEffect(() => {
    let ticking = false, raf = 0;
    const read = () => {
      const y = window.scrollY;
      setSolid(y > 24);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(y / max, 1) : 0);
      ticking = false;
    };
    const onScroll = () => { if (ticking) return; ticking = true; raf = requestAnimationFrame(read); };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: solid ? "rgba(255,255,255,.86)" : "rgba(255,255,255,.62)",
      backdropFilter: `blur(${solid ? 18 : 10}px) saturate(1.6)`,
      WebkitBackdropFilter: `blur(${solid ? 18 : 10}px) saturate(1.6)`,
      borderBottom: `1px solid ${solid ? "rgba(75,46,131,.10)" : "transparent"}`,
      boxShadow: solid ? "0 6px 28px rgba(75,46,131,.07)" : "0 0 0 rgba(0,0,0,0)",
      transition: `background ${DUR.base}ms ${EASE.out}, box-shadow ${DUR.base}ms ${EASE.out}, border-color ${DUR.base}ms ${EASE.out}, backdrop-filter ${DUR.base}ms ${EASE.out}`,
    }}>
      {/* Reading progress — a hairline that fills as you scroll */}
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: -1,
        height: 2, transformOrigin: "0 50%",
        transform: `scaleX(${progress})`,
        background: `linear-gradient(90deg, ${VIOLET}, ${GOLD})`,
        opacity: progress > 0.005 ? 1 : 0,
        transition: `opacity ${DUR.base}ms ${EASE.out}` }} />
      {/* Height is animated with a transform-driven wrapper rather than
          padding/height, so the sticky header never triggers layout on scroll. */}
      <nav style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button className="btn" onClick={() => onNav("home")} aria-label="MSA at UW — home" style={{
          display: "flex", alignItems: "center", gap: 10, background: "none", border: "none",
          cursor: "pointer", padding: 0, height: 44 }}>
          <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="MSA at UW logo"
            style={{ height: 44, width: 44, borderRadius: 10, objectFit: "cover",
              transformOrigin: "left center",
              transform: solid ? "scale(.86)" : "scale(1)",
              transition: `transform ${DUR.base}ms ${EASE.out}` }} />
        </button>

        <div className="desk" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {SECTIONS.map((s) =>
            s.external ? (
              <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer"
                 className="navlink" style={navLink(false)}>
                {s.label} <ExternalLink size={13} style={{ verticalAlign: "-1px" }} />
              </a>
            ) : (
              <button key={s.id} onClick={() => onNav(s.id)}
                className="navlink" style={navLink(active === s.id)}>
                {s.label}
              </button>
            )
          )}
          <button className="btn" onClick={onAdmin} aria-label="Admin login" style={{
            marginLeft: 8, display: "grid", placeItems: "center", width: 38, height: 38,
            borderRadius: 10, border: `1px solid rgba(75,46,131,.2)`, background: "#fff", cursor: "pointer" }}>
            <Lock size={16} color={PURPLE} />
          </button>
        </div>

        <button className="mob" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu"
          style={{ display: "none", background: "none", border: "none", cursor: "pointer" }}>
          {menuOpen ? <X size={26} color={PURPLE} /> : <Menu size={26} color={PURPLE} />}
        </button>
      </nav>

      {menuOpen && (
        <div className="mob" style={{ display: "none", padding: "8px 20px 20px", background: "#fff",
          borderTop: `1px solid rgba(75,46,131,.1)` }}>
          {SECTIONS.map((s) =>
            s.external ? (
              <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer"
                 onClick={() => setMenuOpen(false)} style={mobLink}>
                {s.label} <ExternalLink size={14} />
              </a>
            ) : (
              <button key={s.id} onClick={() => onNav(s.id)} style={mobLink}>{s.label}</button>
            )
          )}
          <button onClick={() => { setMenuOpen(false); onAdmin(); }} style={mobLink}>
            <Lock size={15} /> Admin
          </button>
        </div>
      )}
      <style>{`
        @media (max-width: 860px) { .desk { display: none !important; } .mob { display: flex !important; } }
      `}</style>
    </header>
  );
}
const navLink = (on) => ({
  padding: "9px 14px", background: on ? "rgba(75,46,131,.09)" : "transparent",
  border: "none", cursor: "pointer", borderRadius: 10, fontWeight: 600, fontSize: 14.5,
  color: on ? PURPLE : "#4a4458", fontFamily: "inherit", textDecoration: "none",
  transition: `background ${DUR.fast}ms ${EASE.out}, color ${DUR.fast}ms ${EASE.out}`,
});
const mobLink = {
  display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
  padding: "13px 8px", background: "none", border: "none", borderBottom: "1px solid rgba(0,0,0,.05)",
  fontSize: 16, fontWeight: 600, color: PURPLE, cursor: "pointer", fontFamily: "inherit",
  textDecoration: "none",
};

function Band({ children, id, alt, style, divider, lattice, decor }) {
  return (
    <section id={id} style={{ position: "relative", overflow: "hidden",
      padding: "92px 20px", background: alt ? "#fff" : "transparent", ...style }}>
      {lattice && <StarLatticeBg color={PURPLE} opacity={alt ? 0.05 : 0.045} unit={66} />}
      {/* Parallax botanicals framing the section. `decor` picks the arrangement. */}
      {decor === "left" && (
        <>
          <Parallax speed={0.22} float style={{ top: -40, left: -70 }}>
            <SakuraBranch width={230} opacity={.16} />
          </Parallax>
          <Parallax speed={-0.16} float style={{ bottom: -30, right: -60 }}>
            <CrescentAccent size={130} opacity={.09} />
          </Parallax>
        </>
      )}
      {decor === "right" && (
        <>
          <Parallax speed={0.2} float style={{ top: -50, right: -70 }}>
            <SakuraBranch width={230} flip opacity={.16} />
          </Parallax>
          <Parallax speed={-0.18} float style={{ bottom: 10, left: -40 }}>
            <Lantern size={80} opacity={.12} />
          </Parallax>
        </>
      )}
      {decor === "both" && (
        <>
          <Parallax speed={0.24} float style={{ top: -46, left: -70 }}>
            <SakuraBranch width={210} opacity={.15} />
          </Parallax>
          <Parallax speed={0.18} float style={{ top: -30, right: -60 }}>
            <SakuraBranch width={210} flip opacity={.15} />
          </Parallax>
          <Parallax speed={-0.2} float style={{ bottom: -10, left: "45%" }}>
            <CrescentAccent size={100} opacity={.08} />
          </Parallax>
        </>
      )}
      {divider && (
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "-40px auto 52px", opacity: .55 }}>
          <GirihBand color={GOLD} height={30} opacity={1} unit={44} />
        </div>
      )}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

function Eyebrow({ children }) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView({ threshold: 0.4 });
  const show = reduced || inView;
  return (
    <div ref={ref} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      {/* star spins gently into place */}
      <span style={{
        display: "inline-flex",
        opacity: show ? 1 : 0,
        transform: show ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(.4)",
        transition: reduced ? "none"
          : `opacity ${DUR.base}ms ${EASE.out}, transform ${DUR.slow}ms ${EASE.spring}`,
      }}><Star8 size={16} /></span>
      <span style={{ textTransform: "uppercase", letterSpacing: "2px", fontSize: 12.5,
        fontWeight: 700, color: GOLD,
        opacity: show ? 1 : 0,
        transform: show ? "translate3d(0,0,0)" : "translate3d(-10px,0,0)",
        transition: reduced ? "none"
          : `opacity ${DUR.base}ms ${EASE.out} 90ms, transform ${DUR.base}ms ${EASE.out} 90ms`,
      }}>{children}</span>
      {/* hairline rule that draws outward */}
      <span aria-hidden="true" style={{ flex: 1, height: 1, marginLeft: 4,
        background: `linear-gradient(90deg, ${GOLD}, transparent)`,
        transformOrigin: "0 50%",
        transform: show ? "scaleX(1)" : "scaleX(0)",
        opacity: .45,
        transition: reduced ? "none" : `transform ${DUR.slow}ms ${EASE.outSoft} 160ms`,
      }} />
    </div>
  );
}

function Title({ children, delay = 0 }) {
  const isText = typeof children === "string";
  return (
    <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, color: PURPLE,
      margin: "0 0 16px", letterSpacing: "-1px", lineHeight: 1.1 }}>
      {isText
        ? <TextReveal text={children} delay={delay + 90} step={48} />
        : <Reveal delay={delay + 90} variant="up" distance={20}>{children}</Reveal>}
    </h2>
  );
}

/* Lead paragraph under a Title — reveals just after it. */
function Lead({ children, delay = 260, style }) {
  return (
    <Reveal delay={delay} variant="up" distance={18}>
      <p style={{ color: "#5a5468", maxWidth: 560, margin: "0 0 36px", fontSize: 16.5,
        lineHeight: 1.65, ...style }}>{children}</p>
    </Reveal>
  );
}

/* ---------- HOME ---------- */
function HomeSection({ data, onNav }) {
  return (
    <>
      <section id="home" style={{ position: "relative", overflow: "hidden",
        background: GRAD_DEEP,
        color: "#fff", padding: "104px 20px 0" }}>
        <AmbientGlow />
        <PatternField />
        <CherryBlossoms count={22} />
        {/* central mihrab arch silhouette — strokes draw themselves in */}
        <HeroArch />
        <div style={{ maxWidth: 900, margin: "0 auto", position: "relative", zIndex: 2,
          textAlign: "center", paddingBottom: 90 }}>
          <HeroIntro delay={120}>
            <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="MSA at UW logo"
              style={{ width: 132, height: 132, borderRadius: 24, objectFit: "cover", marginBottom: 26,
                boxShadow: "0 12px 40px rgba(0,0,0,.5)", border: "1px solid rgba(201,182,136,.3)" }} />
          </HeroIntro>
          <HeroIntro delay={300} variant="scale">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
              padding: "7px 16px", borderRadius: 999, background: "rgba(201,182,136,.16)",
              border: `1px solid rgba(201,182,136,.4)`, marginBottom: 24 }}>
              <Star8 size={16} color={GOLD} /> <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".5px" }}>
                Est. at the University of Washington</span>
            </div>
          </HeroIntro>
          <h1 style={{ fontSize: "clamp(32px,5.5vw,58px)", fontWeight: 800, lineHeight: 1.08,
            letterSpacing: "-1.5px", margin: "0 0 22px" }}>
            <HeroWords text={data.hero.title} delay={430} step={62} />
          </h1>
          <HeroIntro delay={900}>
            <p style={{ fontSize: "clamp(16px,2vw,20px)", color: "rgba(255,255,255,.85)",
              maxWidth: 640, margin: "0 auto 36px", lineHeight: 1.6 }}>
              {data.hero.mission}
            </p>
          </HeroIntro>
          <HeroIntro delay={1060}>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn" onClick={() => onNav("connect")} style={btnGold}>Join MSA</button>
              <button className="btn" onClick={() => onNav("events")} style={btnGhost}>See what's on</button>
            </div>
          </HeroIntro>
        </div>
        <ScrollCue onClick={() => onNav("gallery")} />
        {/* girih band along the base of the hero */}
        <div style={{ position: "relative" }}>
          <GirihBand color="rgba(183,165,122,.45)" height={54} opacity={1} unit={54} />
        </div>
      </section>

      {/* Gallery */}
      <Band id="gallery" lattice decor="left">
        <Eyebrow>Our community</Eyebrow>
        <Title>Moments from the year</Title>
        <Lead>Eid celebrations, Jummah, retreats, and the everyday gatherings that make MSA home.</Lead>
        <Gallery items={data.gallery} />
      </Band>

      {/* Sponsors */}
      <Band alt>
        <Eyebrow>With support from</Eyebrow>
        <Title>Our sponsors & partners</Title>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))",
          gap: 16, marginTop: 32 }}>
          {data.sponsors.map((s, n) => {
            const inner = s.logo ? (
              <img src={s.logo} alt={s.name} className="sponsorlogo"
                style={{ maxHeight: 60, maxWidth: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontWeight: 700, color: PURPLE, fontSize: 15 }}>{s.name}</span>
            );
            const boxStyle = { ...card, display: "grid", placeItems: "center",
              height: 96, textAlign: "center", padding: 16, textDecoration: "none" };
            return (
              <Reveal key={s.id} delay={n * 70} variant="scale" distance={22} duration={DUR.slow}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer"
                    className="lift" style={boxStyle} title={`Visit ${s.name}`}>{inner}</a>
                ) : (
                  <div className="lift" style={boxStyle}>{inner}</div>
                )}
              </Reveal>
            );
          })}
        </div>
        <Reveal variant="rise" distance={30} duration={DUR.slow} delay={120}>
          <div style={{ marginTop: 40, ...card, padding: "32px 28px", display: "flex",
            alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap",
            position: "relative", overflow: "hidden",
            background: `linear-gradient(120deg, rgba(75,46,131,.05), rgba(183,165,122,.08))` }}>
            <div aria-hidden="true" style={{ position: "absolute", right: -30, top: -40, opacity: .07 }}>
              <Star8 size={190} color={PURPLE} />
            </div>
            <div style={{ position: "relative" }}>
              <h3 style={{ margin: "0 0 6px", color: PURPLE, fontSize: 21, fontWeight: 700 }}>
                Support the MSA</h3>
              <p style={{ margin: 0, color: "#5a5468" }}>Your donation funds events, iftars, and student programs.</p>
            </div>
            <a className="btn" href="https://www.zeffy.com/en-US/donation-form/44131d7a-557e-4fdc-9a70-14e9f67206ef"
               target="_blank" rel="noopener noreferrer"
               style={{ ...btnGold, position: "relative", textDecoration: "none",
                 display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Heart size={18} /> Donate
            </a>
          </div>
        </Reveal>
      </Band>
    </>
  );
}

/* ── Hero entrance primitives ───────────────────────────────────────────
   The hero animates on mount (not on scroll — it's already in view), so
   these use a timed reveal rather than IntersectionObserver. */
function HeroIntro({ children, delay = 0, variant = "up", distance = 24,
  duration = DUR.hero, style }) {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (reduced) { setShow(true); return; }
    const t = setTimeout(() => setShow(true), 40);
    return () => clearTimeout(t);
  }, [reduced]);
  const from = variant === "scale"
    ? "translate3d(0,14px,0) scale(.94)"
    : `translate3d(0,${distance}px,0)`;
  return (
    <div style={{
      opacity: show ? 1 : 0,
      transform: show ? "translate3d(0,0,0) scale(1)" : from,
      transition: reduced ? "none"
        : `opacity ${duration}ms ${EASE.outSoft} ${delay}ms, transform ${duration}ms ${EASE.outSoft} ${delay}ms`,
      ...style,
    }}>{children}</div>
  );
}

/* Headline words rising in sequence from behind a mask. */
function HeroWords({ text, delay = 0, step = 60 }) {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (reduced) { setShow(true); return; }
    const t = setTimeout(() => setShow(true), 40);
    return () => clearTimeout(t);
  }, [reduced]);
  const words = String(text).split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top" }}>
          <span style={{
            display: "inline-block",
            opacity: show ? 1 : 0,
            transform: show ? "translate3d(0,0,0)" : "translate3d(0,1em,0)",
            transition: reduced ? "none"
              : `opacity ${DUR.slow}ms ${EASE.outSoft} ${delay + i * step}ms, transform ${DUR.slow}ms ${EASE.outSoft} ${delay + i * step}ms`,
          }}>{w}</span>
          {i < words.length - 1 && <span>&nbsp;</span>}
        </span>
      ))}
    </>
  );
}

/* Mihrab arch whose outline draws itself, then breathes gently. */
function HeroArch() {
  const reduced = useReducedMotion();
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (reduced) { setDrawn(true); return; }
    const t = setTimeout(() => setDrawn(true), 120);
    return () => clearTimeout(t);
  }, [reduced]);
  return (
    <div aria-hidden="true" className={reduced ? "" : "floaty-slow"}
      style={{ position: "absolute", top: 40, left: "50%",
        transform: "translateX(-50%)", width: "min(560px, 88%)", height: "82%",
        opacity: 0.5, pointerEvents: "none" }}>
      <svg viewBox="0 0 200 280" width="100%" height="100%" preserveAspectRatio="none">
        <path d={archPath(200, 280, 150)} fill="none" stroke="rgba(201,182,136,.5)"
          strokeWidth="1.2" pathLength="1"
          style={{
            strokeDasharray: 1,
            strokeDashoffset: drawn ? 0 : 1,
            transition: reduced ? "none" : `stroke-dashoffset 2600ms ${EASE.outSoft} 200ms`,
          }} />
      </svg>
    </div>
  );
}

/* Two very slow, very soft colour blooms behind the hero. Pure transform
   animation on blurred radial gradients — cheap and adds real depth. */
function AmbientGlow({ subtle = false }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  const k = subtle ? 0.45 : 1;
  const blob = (color, size) => ({
    position: "absolute", width: size, height: size, borderRadius: "50%",
    background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
    filter: `blur(${subtle ? 60 : 48}px)`, pointerEvents: "none",
  });
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0 }}>
      <div className="glow" style={{ ...blob(`rgba(140,120,180,${.42 * k})`, subtle ? 520 : 620),
        top: "-18%", left: "-12%" }} />
      <div className="glow" style={{ ...blob(`rgba(180,120,140,${.34 * k})`, subtle ? 440 : 520),
        bottom: "-16%", right: "-10%", animationDelay: "-11s", animationDuration: "27s" }} />
    </div>
  );
}

/* A quiet nudge to scroll. Fades in last, drifts, hides once you move. */
function ScrollCue({ onClick }) {
  const reduced = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const f = () => setHidden(window.scrollY > 80);
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <button onClick={onClick} aria-label="Scroll to content"
      style={{
        position: "absolute", left: "50%", bottom: 74, zIndex: 3,
        transform: "translateX(-50%)", background: "none", border: "none",
        cursor: "pointer", padding: 10,
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : "auto",
        transition: `opacity ${DUR.base}ms ${EASE.out} ${hidden ? 0 : 1500}ms`,
      }}>
      <span className={reduced ? "" : "floaty"} style={{ display: "block" }}>
        <svg width="26" height="38" viewBox="0 0 26 38" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="24" height="36" rx="12"
            stroke="rgba(201,182,136,.55)" strokeWidth="1.4" />
          <circle cx="13" cy="11" r="3" fill={GOLD}>
            {!reduced && <animate attributeName="cy" values="11;22;11" dur="2.4s" repeatCount="indefinite" />}
          </circle>
        </svg>
      </span>
    </button>
  );
}

function PatternField() {
  const stars = [];
  const spots = [[6, 18], [16, 68], [30, 30], [50, 82], [72, 22], [86, 60], [92, 12], [40, 55], [64, 74]];
  spots.forEach(([l, t], i) => stars.push(
    <div key={i} style={{ position: "absolute", left: `${l}%`, top: `${t}%`,
      animation: `spin ${26 + i * 4}s linear infinite` }}>
      <Star8 size={30 + (i % 3) * 22} color="#fff" opacity={0.05 + (i % 3) * 0.02} />
    </div>
  ));
  return <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{stars}</div>;
}

function Gallery({ items }) {
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const DWELL = 5600;

  const go = useCallback((n) => {
    setI((cur) => {
      if (n === cur) return cur;
      setPrev(cur);
      return (n + items.length) % items.length;
    });
  }, [items.length]);

  // Auto-advance. Pauses on hover/focus, when the tab is hidden, and for
  // reduced-motion users. Restarts cleanly whenever the slide changes.
  useEffect(() => {
    if (paused || reduced || items.length < 2) return;
    const t = setInterval(() => {
      if (!document.hidden) go(i + 1);
    }, DWELL);
    return () => clearInterval(t);
  }, [paused, reduced, items.length, i, go]);

  const grad = (n) => {
    const g = [
      `linear-gradient(135deg,${PURPLE},${VIOLET})`, `linear-gradient(135deg,${MAUVE},${PINK})`,
      `linear-gradient(135deg,${PURPLE_D},${PURPLE})`, `linear-gradient(135deg,${VIOLET},${MAUVE})`,
      `linear-gradient(135deg,${INK},${PURPLE})`, `linear-gradient(135deg,${PINK},${PURPLE})`,
    ];
    return g[n % g.length];
  };

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
         onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
      {/* Featured slide — every slide is layered and crossfaded, so there is
          never a hard swap. The active slide also drifts (Ken Burns). */}
      <Reveal variant="rise" distance={34} duration={DUR.slow}>
        <div style={{ position: "relative", borderRadius: 22, overflow: "hidden",
          aspectRatio: "16 / 9", background: grad(i), marginBottom: 16,
          boxShadow: "0 24px 60px rgba(20,17,24,.22)" }}>

          {items.map((it, n) => {
            const active = n === i;
            const wasActive = n === prev;
            return (
              <div key={it.id ?? n} aria-hidden={!active} style={{
                position: "absolute", inset: 0,
                background: grad(n),
                opacity: active ? 1 : 0,
                transition: reduced ? "none"
                  : `opacity 900ms ${EASE.outSoft}`,
                zIndex: active ? 2 : wasActive ? 1 : 0,
              }}>
                {it.img ? (
                  <img src={it.img} alt={it.caption} loading={active ? "eager" : "lazy"}
                    style={{
                      position: "absolute", inset: 0, width: "100%", height: "100%",
                      objectFit: "cover",
                      transform: active ? "scale(1.06)" : "scale(1)",
                      transition: reduced ? "none" : `transform ${DWELL + 1800}ms linear`,
                      willChange: "transform",
                    }} />
                ) : (
                  <div style={{ position: "absolute", inset: 0, opacity: .15 }}><PatternField /></div>
                )}
                {/* readability scrim */}
                <div style={{ position: "absolute", inset: 0,
                  background: it.img
                    ? "linear-gradient(to top, rgba(20,17,24,.62) 0%, rgba(20,17,24,.12) 42%, transparent 68%)"
                    : "none" }} />
              </div>
            );
          })}

          {/* Caption — re-animates on each slide change via the key */}
          <div key={i} style={{ position: "absolute", inset: 0, zIndex: 3,
            display: "grid", placeItems: "center", alignContent: "end",
            textAlign: "center", color: "#fff", paddingBottom: 34,
            pointerEvents: "none" }}>
            {!items[i].img && <Star8 size={54} color="#fff" opacity={.9} />}
            <div style={{ fontSize: 13, letterSpacing: "2px", textTransform: "uppercase",
              color: "rgba(255,255,255,.85)",
              animation: reduced ? "none" : `rise ${DUR.slow}ms ${EASE.outSoft} 120ms both` }}>
              {items[i].tag}</div>
            <div style={{ fontSize: "clamp(20px,2.6vw,28px)", fontWeight: 700, marginTop: 6,
              textShadow: "0 2px 18px rgba(0,0,0,.5)",
              animation: reduced ? "none" : `rise ${DUR.slow}ms ${EASE.outSoft} 210ms both` }}>
              {items[i].caption}</div>
          </div>

          <button className="btn" onClick={() => go(i - 1)} aria-label="Previous photo"
            style={carBtn("left")}><ChevronLeft size={22} color={PURPLE} /></button>
          <button className="btn" onClick={() => go(i + 1)} aria-label="Next photo"
            style={carBtn("right")}><ChevronRight size={22} color={PURPLE} /></button>

          {/* Progress dots — active one stretches into a bar */}
          <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, zIndex: 4,
            display: "flex", justifyContent: "center", gap: 7 }}>
            {items.map((_, n) => (
              <button key={n} onClick={() => go(n)} aria-label={`Photo ${n + 1}`}
                style={{ width: 26, height: 8, borderRadius: 99, border: "none",
                  background: "transparent", cursor: "pointer", padding: 0,
                  display: "grid", placeItems: "center" }}>
                {/* scaleX rather than width so the dot never triggers layout */}
                <span aria-hidden="true" style={{ display: "block", width: 26, height: 8,
                  borderRadius: 99, transformOrigin: "50% 50%",
                  transform: n === i ? "scaleX(1)" : "scaleX(.31)",
                  background: n === i ? GOLD : "rgba(255,255,255,.55)",
                  transition: `transform ${DUR.base}ms ${EASE.out}, background ${DUR.base}ms ${EASE.out}` }} />
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Thumbnails — stagger in, and the active one lifts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 10 }}>
        {items.map((it, n) => (
          <Reveal key={it.id ?? n} delay={n * 60} variant="up" distance={16} duration={DUR.base}>
            <button onClick={() => go(n)} aria-label={it.caption} className="zoomable"
              style={{ width: "100%", height: 66, borderRadius: 12,
                border: n === i ? `2px solid ${GOLD}` : "2px solid transparent",
                background: grad(n), cursor: "pointer", padding: 0,
                position: "relative", overflow: "hidden",
                opacity: n === i ? 1 : .72,
                transform: n === i ? "translate3d(0,-3px,0)" : "none",
                boxShadow: n === i ? "0 10px 24px rgba(75,46,131,.24)" : "none",
                transition: `opacity ${DUR.fast}ms ${EASE.out}, transform ${DUR.fast}ms ${EASE.out}, border-color ${DUR.fast}ms ${EASE.out}, box-shadow ${DUR.fast}ms ${EASE.out}` }}>
              {it.img && <img src={it.img} alt="" loading="lazy"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
              <span style={{ position: "absolute", bottom: 4, left: 6, fontSize: 10.5, fontWeight: 600,
                color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.7)", zIndex: 1 }}>{it.tag}</span>
            </button>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
const carBtn = (side) => ({
  position: "absolute", top: "50%", transform: "translateY(-50%)", [side]: 14,
  width: 42, height: 42, borderRadius: 999, border: "none", background: "rgba(255,255,255,.9)",
  cursor: "pointer", display: "grid", placeItems: "center",
});

/* ---------- PRAYER ---------- */
/* Masjidal live prayer-times widget.
   - If `embed` is set, it should be the full markup Masjidal gives you
     (an <iframe...> or <div>+<script>); it's injected as-is.
   - Else if `id` is set, we build Masjidal's standard iframe from the Masjid ID.
   Masjidal recalculates daily on their servers, so nothing here needs updating. */
function MasjidalWidget({ id, embed }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!embed || !ref.current) return;
    // Inject raw embed markup, re-executing any <script> tags it contains.
    ref.current.innerHTML = embed;
    ref.current.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      [...old.attributes].forEach((a) => s.setAttribute(a.name, a.value));
      s.text = old.textContent;
      old.replaceWith(s);
    });
  }, [embed]);

  if (embed) {
    return <div ref={ref} style={{ padding: "12px 16px" }} />;
  }
  // Masjid ID → Masjidal's daily-timings iframe (served via athanplus.com).
  return (
    <div style={{ padding: "8px 12px" }}>
      <iframe
        title="Masjidal prayer times"
        src={`https://timing.athanplus.com/masjid/widgets/embed?theme=3&masjid_id=${encodeURIComponent(id)}&color=000000`}
        style={{ width: "100%", minHeight: 500, border: "none" }}
        allowTransparency="true"
        loading="lazy"
      />
      <div style={{ fontSize: 11, color: "#9a94a8", textAlign: "center", padding: "4px 0 8px" }}>
        Prayer times powered by Masjidal
      </div>
    </div>
  );
}

function PrayerSection({ data }) {
  const t = data.prayerTimes;
  return (
    <Band id="prayer" alt lattice>
      <Eyebrow>Prayer</Eyebrow>
      <Title>Places & times to pray</Title>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, marginTop: 32,
        alignItems: "start" }} className="prayer-grid">
        <div style={{ display: "grid", gap: 16 }}>
          {data.prayerSpaces.map((s, n) => (
            <Reveal key={s.id} delay={n * 70} variant="left" distance={22}>
            <div className="lift" style={{ ...card, padding: "22px 24px", display: "flex", gap: 16 }}>
              <div style={{ flexShrink: 0, width: 46, height: 56, position: "relative",
                display: "grid", placeItems: "center" }}>
                <div style={{ position: "absolute", inset: 0 }}>
                  <Arch w={46} h={56} spring={34} stroke="none" fill="rgba(75,46,131,.08)"
                    style={{ width: "100%", height: "100%" }} />
                </div>
                <MapPin size={20} color={PURPLE} style={{ position: "relative", marginTop: 6 }} />
              </div>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: PURPLE }}>{s.name}</h3>
                <div style={{ color: "#6a6478", fontSize: 14.5, marginBottom: 6 }}>{s.loc}</div>
                <div style={{ color: "#8a8498", fontSize: 13.5 }}>{s.note}</div>
              </div>
            </div>
            </Reveal>
          ))}
        </div>

        <Reveal variant="right" distance={26} delay={140} duration={DUR.slow}
          style={{ position: "sticky", top: 90 }}>
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ background: GRAD_DEEP, color: "#fff",
            padding: "22px 24px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -20, top: -20, opacity: .2 }}>
              <Star8 size={110} color="#fff" /></div>
            <div style={{ position: "relative" }}>
              <div style={{ fontSize: 12.5, letterSpacing: "1.5px", textTransform: "uppercase",
                color: "rgba(255,255,255,.75)" }}>Islamic House</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>Today's prayer times</div>
            </div>
          </div>
          <div style={{ marginTop: -1 }}><Muqarnas color={GOLD} height={16} cells={12} opacity={.85} /></div>

          {(t.masjidalId || t.masjidalEmbed) ? (
            <MasjidalWidget id={t.masjidalId} embed={t.masjidalEmbed} />
          ) : (
            <div style={{ padding: "8px 24px" }}>
              {["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].map((p) => (
                <div key={p} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "13px 0", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                  <span style={{ fontWeight: 600, color: "#2c2640" }}>{p}</span>
                  <span style={{ fontFamily: "'Amiri',serif", fontSize: 18, color: PURPLE, fontWeight: 700 }}>{t[p]}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: "16px 24px", background: "rgba(183,165,122,.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Calendar size={16} color={GOLD} />
              <span style={{ fontWeight: 700, fontSize: 13.5, color: PURPLE }}>Jummah</span>
            </div>
            <div style={{ fontSize: 13.5, color: "#5a5468" }}>{t.jummah}</div>
          </div>
          {t.announcement && (
            <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(0,0,0,.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Sparkles size={16} color={GOLD} />
                <span style={{ fontWeight: 700, fontSize: 13.5, color: PURPLE }}>Announcement</span>
              </div>
              <div style={{ fontSize: 13.5, color: "#5a5468", lineHeight: 1.55 }}>{t.announcement}</div>
            </div>
          )}
        </div>
        </Reveal>
      </div>
      <style>{`@media (max-width:820px){.prayer-grid{grid-template-columns:1fr !important;}}`}</style>
    </Band>
  );
}

/* ---------- EVENTS ---------- */
function EventsSection({ data }) {
  return (
    <Band id="events" divider lattice decor="both">
      <Eyebrow>This week</Eyebrow>
      <Title>Weekly calendar</Title>
      <Lead>Everything happening across the week — drop in anytime.</Lead>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 16 }}>
        {DAYS.map((day, dn) => {
          const evs = data.events[day] || [];
          const isFri = day === "Friday";
          return (
            <Reveal key={day} delay={dn * 75} variant="rise" distance={28} duration={DUR.slow}>
            <div className="eventcard" style={{ ...card, padding: 0, overflow: "hidden", height: "100%",
              border: isFri ? `2px solid ${GOLD}` : card.border }}>
              <div style={{ padding: "12px 18px", background: isFri ? "rgba(183,165,122,.15)" : "rgba(75,46,131,.05)",
                display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, color: PURPLE, fontSize: 15 }}>{day}</span>
                {isFri && <Star8 size={15} />}
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10, minHeight: 90 }}>
                {evs.length === 0 && (
                  <div style={{ color: "#b0aac0", fontSize: 13.5, padding: "18px 0", textAlign: "center" }}>
                    No events yet</div>
                )}
                {evs.map((e) => (
                  <div key={e.id} style={{ borderRadius: 12, overflow: "hidden",
                    background: "rgba(75,46,131,.04)", border: "1px solid rgba(75,46,131,.08)" }}>
                    {e.img && <img src={e.img} alt={e.name}
                      style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} />}
                    <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 700, color: "#2c2640", fontSize: 14.5, marginBottom: 5 }}>{e.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color: PURPLE,
                      fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>
                      <Clock size={12} /> {e.time}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#7a7488", fontSize: 12.5 }}>
                      <MapPin size={12} /> {e.loc}</div>
                    {e.desc && <div style={{ color: "#8a8498", fontSize: 12, marginTop: 6 }}>{e.desc}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </Reveal>
          );
        })}
      </div>
    </Band>
  );
}

/* ---------- PROGRAMS ---------- */
function ProgramsSection({ data }) {
  return (
    <Band id="programs" alt divider lattice decor="right">
      <Eyebrow>Get involved</Eyebrow>
      <Title>Our programs</Title>
      <Lead>Ways to grow, give back, and connect throughout the year.</Lead>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 20 }}>
        {data.programs.map((p, n) => (
          <Reveal key={p.id} delay={n * 85} variant="rise" distance={30} duration={DUR.slow}>
            <ProgramCard program={p} />
          </Reveal>
        ))}
      </div>
    </Band>
  );
}

/* Program card — the arch fills and the icon lifts on hover. */
function ProgramCard({ program: p }) {
  const [hover, setHover] = useState(false);
  return (
    <div className="lift" style={{ ...card, padding: "26px 24px", height: "100%" }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{ width: 54, height: 62, position: "relative", display: "grid",
        placeItems: "center", marginBottom: 16 }}>
        <div style={{ position: "absolute", inset: 0,
          transform: hover ? "translate3d(0,-3px,0) scale(1.06)" : "none",
          transition: `transform ${DUR.base}ms ${EASE.spring}` }}>
          <Arch w={54} h={62} spring={38}
            stroke={hover ? "rgba(183,165,122,.85)" : "rgba(183,165,122,.5)"} sw={1.2}
            fill={hover ? "rgba(183,165,122,.26)" : "rgba(183,165,122,.15)"}
            style={{ width: "100%", height: "100%", transition: `all ${DUR.base}ms ${EASE.out}` }} />
        </div>
        <div style={{ position: "relative", marginTop: 8,
          transform: hover ? "translate3d(0,-3px,0)" : "none",
          transition: `transform ${DUR.base}ms ${EASE.spring}` }}>{progIcon(p.icon)}</div>
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 700, color: PURPLE }}>{p.name}</h3>
      <p style={{ margin: 0, color: "#5a5468", fontSize: 14.5, lineHeight: 1.6 }}>{p.desc}</p>
    </div>
  );
}

/* ---------- CONNECT ---------- */
function ConnectSection({ data }) {
  const bg = (k) => ({
    discord: "#5865F2", instagram: "linear-gradient(135deg,#833AB4,#FD1D1D,#FCB045)",
    facebook: "#1877F2", donate: `linear-gradient(135deg,${PURPLE},${GOLD})`, link: PURPLE,
  }[k] || PURPLE);
  return (
    <Band id="connect" lattice decor="left">
      <Eyebrow>Connect</Eyebrow>
      <Title>Find your people</Title>
      <Lead>Join the group chats, follow along, and support the community.</Lead>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 16 }}>
        {data.links.map((l, n) => (
          <Reveal key={l.id} delay={n * 65} variant="rise" distance={26}>
            <LinkCard link={l} bg={bg(l.kind)} />
          </Reveal>
        ))}
      </div>
    </Band>
  );
}

/* Connect card — icon tile tilts, arrow slides out on hover. */
function LinkCard({ link: l, bg }) {
  const [hover, setHover] = useState(false);
  return (
    <a href={l.href} target="_blank" rel="noopener noreferrer" className="lift"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...card, padding: "22px 24px", display: "flex", alignItems: "center", gap: 16,
        textDecoration: "none", height: "100%" }}>
      <div style={{ width: 50, height: 50, borderRadius: 13, background: bg,
        display: "grid", placeItems: "center", flexShrink: 0,
        transform: hover ? "translate3d(0,-2px,0) scale(1.07) rotate(-3deg)" : "none",
        boxShadow: hover ? "0 10px 22px rgba(20,17,24,.22)" : "0 0 0 rgba(0,0,0,0)",
        transition: `transform ${DUR.base}ms ${EASE.spring}, box-shadow ${DUR.base}ms ${EASE.out}` }}>
        {linkIcon(l.kind)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "#2c2640", fontSize: 16 }}>{l.name}</div>
        <div style={{ color: PURPLE, fontSize: 13, fontWeight: 600, display: "flex",
          alignItems: "center", gap: 4, marginTop: 2 }}>
          Open
          <span style={{ display: "inline-flex",
            transform: hover ? "translate3d(4px,-2px,0)" : "none",
            transition: `transform ${DUR.base}ms ${EASE.spring}` }}>
            <ExternalLink size={12} />
          </span>
        </div>
      </div>
    </a>
  );
}

function Footer({ onAdmin }) {
  return (
    <footer style={{ background: INK, color: "rgba(255,255,255,.72)", padding: 0 }}>
      <GirihBand color={`rgba(201,182,136,.35)`} height={34} opacity={1} unit={48} />
      <div style={{ padding: "40px 20px 36px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between",
          alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="MSA at UW logo"
              style={{ width: 52, height: 52, borderRadius: 12, objectFit: "cover",
                border: "1px solid rgba(201,182,136,.3)" }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>MSA at UW</div>
              <div style={{ fontSize: 13 }}>Muslim Student Association · University of Washington</div>
            </div>
          </div>
          <button className="btn" onClick={onAdmin} style={{ display: "flex", alignItems: "center", gap: 7,
            background: "rgba(201,182,136,.14)", border: "1px solid rgba(201,182,136,.3)", color: GOLD,
            padding: "10px 16px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            fontSize: 14, fontWeight: 600 }}>
            <Lock size={15} /> Admin login
          </button>
        </div>
        <div style={{ maxWidth: 1200, margin: "28px auto 0", paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,.12)", fontSize: 13 }}>
          © {new Date().getFullYear()} MSA at UW. Built with care for the community.
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   ADMIN
   ============================================================ */
function AdminPanel({ data, setData, isAdmin, setIsAdmin, persist, saving, onClose }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("hero");
  const [savedMsg, setSavedMsg] = useState("");

  const login = async () => {
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) setErr(error.message || "Login failed. Check your email and password.");
    else { setIsAdmin(true); setPw(""); }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false); setEmail(""); setPw("");
  };

  const save = async () => {
    setSavedMsg("");
    const res = await persist(data);
    if (res.ok) { setSavedMsg("Saved — changes are now live."); setTimeout(() => setSavedMsg(""), 3000); }
    else setSavedMsg("Save failed: " + res.error);
  };

  return (
    <div role="dialog" aria-modal="true" className="modalBg" style={{ position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(20,12,40,.55)", backdropFilter: "blur(5px)", display: "grid",
      placeItems: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="modalIn" style={{ background: "#fff", borderRadius: 20,
        width: "100%", maxWidth: isAdmin ? 880 : 420, maxHeight: "90vh", overflow: "hidden",
        display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0,0,0,.4)",
        transition: `max-width ${DUR.base}ms ${EASE.out}` }}>

        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(0,0,0,.08)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: GRAD_DEEP, color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isAdmin ? <Edit3 size={20} /> : <Lock size={20} />}
            <span style={{ fontWeight: 700, fontSize: 17 }}>
              {isAdmin ? "Admin dashboard" : "Admin login"}</span>
          </div>
          <button className="btn" onClick={onClose} aria-label="Close" style={{ background: "rgba(255,255,255,.15)",
            border: "none", borderRadius: 8, width: 34, height: 34, cursor: "pointer",
            display: "grid", placeItems: "center" }}>
            <X size={18} color="#fff" /></button>
        </div>

        {!isAdmin ? (
          <div style={{ padding: 28 }}>
            <p style={{ margin: "0 0 18px", color: "#5a5468", fontSize: 14.5, lineHeight: 1.6 }}>
              Officer login. Sign in to edit events, prayer times, programs, and more.
            </p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="Email" autoComplete="username" style={{ ...inp, marginBottom: 10 }} autoFocus />
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="Password" autoComplete="current-password" style={inp} />
            {err && <div style={{ color: "#c0392b", fontSize: 13.5, marginTop: 10 }}>{err}</div>}
            <button className="btn" onClick={login} disabled={busy}
              style={{ ...btnPurple, width: "100%", marginTop: 16, opacity: busy ? .6 : 1 }}>
              {busy ? "Signing in…" : "Log in"}</button>
            <p style={{ margin: "16px 0 0", fontSize: 12, color: "#b0aac0", lineHeight: 1.5 }}>
              Accounts are managed by MSA admins in Supabase. Ask an admin to add you if you
              need access.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
            <div style={{ width: 190, borderRight: "1px solid rgba(0,0,0,.08)", padding: 12,
              overflowY: "auto", background: "#faf9fc" }}>
              {[
                ["hero", "Home / Hero"], ["gallery", "Photos"], ["sponsors", "Sponsors"],
                ["spaces", "Prayer spaces"], ["times", "Prayer times"], ["events", "Events"],
                ["programs", "Programs"], ["stats", "Stats"], ["links", "Links"],
              ].map(([k, lbl]) => (
                <button key={k} onClick={() => setTab(k)} style={{ display: "block", width: "100%",
                  textAlign: "left", padding: "10px 12px", borderRadius: 9, border: "none",
                  background: tab === k ? PURPLE : "transparent", color: tab === k ? "#fff" : "#4a4458",
                  fontWeight: 600, fontSize: 13.5, cursor: "pointer", marginBottom: 3,
                  fontFamily: "inherit" }}>{lbl}</button>
              ))}
              <button onClick={logout} style={{ display: "flex",
                alignItems: "center", gap: 7, width: "100%", padding: "10px 12px", borderRadius: 9,
                border: "none", background: "transparent", color: "#c0392b", fontWeight: 600,
                fontSize: 13.5, cursor: "pointer", marginTop: 12, fontFamily: "inherit" }}>
                <LogOut size={15} /> Log out</button>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 12, padding: "12px 24px", borderBottom: "1px solid rgba(0,0,0,.08)",
                background: "#faf9fc", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: savedMsg.startsWith("Save failed") ? "#c0392b" : "#5a5468" }}>
                  {savedMsg || "Edit below, then Save to publish to the live site."}</span>
                <button className="btn" onClick={save} disabled={saving}
                  style={{ ...btnPurple, display: "inline-flex", alignItems: "center", gap: 7,
                    opacity: saving ? .6 : 1 }}>
                  <Save size={15} /> {saving ? "Saving…" : "Save changes"}</button>
              </div>
              <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
                <Editor tab={tab} data={data} setData={setData} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Editor({ tab, data, setData }) {
  const up = (patch) => setData({ ...data, ...patch });

  if (tab === "hero")
    return (
      <Section title="Home hero">
        <Field label="Title">
          <textarea style={{ ...inp, minHeight: 70 }} value={data.hero.title}
            onChange={(e) => up({ hero: { ...data.hero, title: e.target.value } })} />
        </Field>
        <Field label="Mission statement">
          <textarea style={{ ...inp, minHeight: 90 }} value={data.hero.mission}
            onChange={(e) => up({ hero: { ...data.hero, mission: e.target.value } })} />
        </Field>
      </Section>
    );

  if (tab === "gallery")
    return (
      <ListEditor title="Photos" items={data.gallery}
        onChange={(gallery) => up({ gallery })}
        blank={{ caption: "New photo", tag: "Tag" }}
        fields={[["img", "Photo", "image"], ["caption", "Caption"], ["tag", "Tag"]]} />
    );

  if (tab === "sponsors")
    return (
      <ListEditor title="Sponsors" items={data.sponsors}
        onChange={(sponsors) => up({ sponsors })}
        blank={{ name: "New sponsor", url: "" }}
        fields={[["logo", "Logo", "image"], ["name", "Name"], ["url", "Website URL (optional)"]]} />
    );

  if (tab === "spaces")
    return (
      <ListEditor title="Prayer spaces" items={data.prayerSpaces}
        onChange={(prayerSpaces) => up({ prayerSpaces })}
        blank={{ name: "New space", loc: "Location", note: "" }}
        fields={[["name", "Name"], ["loc", "Location"], ["note", "Note"]]} />
    );

  if (tab === "times") {
    const t = data.prayerTimes;
    const setT = (patch) => up({ prayerTimes: { ...t, ...patch } });
    return (
      <Section title="Islamic House prayer times">
        <Field label="Masjidal Masjid ID (leave blank to use manual times below)">
          <input style={inp} value={t.masjidalId || ""}
            onChange={(e) => setT({ masjidalId: e.target.value })}
            placeholder="e.g. RKxwXOdO" />
        </Field>
        <Field label="Masjidal full embed code (optional — overrides Masjid ID above if filled in)">
          <textarea style={{ ...inp, minHeight: 70 }} value={t.masjidalEmbed || ""}
            onChange={(e) => setT({ masjidalEmbed: e.target.value })}
            placeholder="<iframe ...></iframe>" />
        </Field>
        {["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].map((p) => (
          <Field key={p} label={p}>
            <input style={inp} value={t[p]} onChange={(e) => setT({ [p]: e.target.value })} />
          </Field>
        ))}
        <Field label="Jummah info">
          <input style={inp} value={t.jummah} onChange={(e) => setT({ jummah: e.target.value })} />
        </Field>
        <Field label="Announcement">
          <textarea style={{ ...inp, minHeight: 70 }} value={t.announcement}
            onChange={(e) => setT({ announcement: e.target.value })} />
        </Field>
      </Section>
    );
  }

  if (tab === "events") {
    const setDay = (day, evs) => up({ events: { ...data.events, [day]: evs } });
    return (
      <Section title="Weekly events">
        {DAYS.map((day) => (
          <div key={day} style={{ marginBottom: 20, border: "1px solid rgba(0,0,0,.1)",
            borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "rgba(75,46,131,.06)", fontWeight: 700,
              color: PURPLE, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {day}
              <button onClick={() => setDay(day, [...(data.events[day] || []),
                { id: Date.now(), name: "New event", time: "", loc: "", desc: "", img: "" }])}
                style={miniBtn}><Plus size={14} /> Add</button>
            </div>
            <div style={{ padding: 12, display: "grid", gap: 12 }}>
              {(data.events[day] || []).length === 0 &&
                <div style={{ color: "#b0aac0", fontSize: 13, textAlign: "center", padding: 8 }}>No events</div>}
              {(data.events[day] || []).map((e, idx) => (
                <div key={e.id} style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr auto" }}>
                  <input style={inpSm} placeholder="Name" value={e.name}
                    onChange={(ev) => { const c = [...data.events[day]]; c[idx] = { ...e, name: ev.target.value }; setDay(day, c); }} />
                  <input style={inpSm} placeholder="Time" value={e.time}
                    onChange={(ev) => { const c = [...data.events[day]]; c[idx] = { ...e, time: ev.target.value }; setDay(day, c); }} />
                  <button onClick={() => setDay(day, data.events[day].filter((_, i) => i !== idx))}
                    style={delBtn} aria-label="Delete"><Trash2 size={15} /></button>
                  <input style={{ ...inpSm, gridColumn: "1 / 3" }} placeholder="Location" value={e.loc}
                    onChange={(ev) => { const c = [...data.events[day]]; c[idx] = { ...e, loc: ev.target.value }; setDay(day, c); }} />
                  <input style={{ ...inpSm, gridColumn: "1 / 4" }} placeholder="Description (optional)" value={e.desc}
                    onChange={(ev) => { const c = [...data.events[day]]; c[idx] = { ...e, desc: ev.target.value }; setDay(day, c); }} />
                  <div style={{ gridColumn: "1 / 4" }}>
                    <ImageField label="Event photo (optional)" value={e.img || ""} folder="events"
                      onChange={(url) => { const c = [...data.events[day]]; c[idx] = { ...e, img: url }; setDay(day, c); }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>
    );
  }

  if (tab === "programs")
    return (
      <ListEditor title="Programs" items={data.programs}
        onChange={(programs) => up({ programs })}
        blank={{ name: "New program", desc: "", icon: "star" }}
        fields={[["name", "Name"], ["desc", "Description"], ["icon", "Icon (book/star/grad/sparkles/hand/users)"]]} />
    );

  if (tab === "stats")
    return (
      <ListEditor title="Stats" items={data.stats || []}
        onChange={(stats) => up({ stats })}
        blank={{ value: "0", suffix: "+", label: "New stat" }}
        fields={[["value", "Number"], ["suffix", "Suffix (e.g. + or %)"], ["label", "Label"]]} />
    );

  if (tab === "links")
    return (
      <ListEditor title="External links" items={data.links}
        onChange={(links) => up({ links })}
        blank={{ name: "New link", href: "https://", kind: "link" }}
        fields={[["name", "Label"], ["href", "URL"], ["kind", "Icon (link/discord/facebook/instagram/donate)"]]} />
    );

  return null;
}

function Section({ title, children }) {
  return (
    <div>
      <h3 style={{ margin: "0 0 18px", color: PURPLE, fontSize: 19, fontWeight: 700 }}>{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#4a4458",
        marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
// Upload / preview / remove a single image (gallery, sponsors, events).
function ImageField({ value, onChange, folder = "gallery", label = "Image" }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setBusy(true);
    const res = await uploadImage(file, folder);
    setBusy(false);
    if (res.ok) onChange(res.url); else setErr(res.error);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async () => {
    const p = pathFromUrl(value);
    onChange("");
    if (p) await deleteImage(p);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#7a7488" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 5 }}>
        <div style={{ width: 74, height: 56, borderRadius: 9, overflow: "hidden", flexShrink: 0,
          border: "1px solid rgba(0,0,0,.12)", background: "#f4f2f8", display: "grid", placeItems: "center" }}>
          {value ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                 : <span style={{ fontSize: 10.5, color: "#b0aac0" }}>None</span>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
            style={{ ...miniBtn, opacity: busy ? .6 : 1 }}>
            {busy ? "Uploading…" : value ? "Replace" : "Upload"}
          </button>
          {value && <button type="button" onClick={remove}
            style={{ ...miniBtn, background: "rgba(192,57,43,.1)", color: "#c0392b" }}>Remove</button>}
          <input ref={inputRef} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
        </div>
      </div>
      {err && <div style={{ color: "#c0392b", fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
function ListEditor({ title, items, onChange, blank, fields }) {
  const add = () => onChange([...items, { id: Date.now(), ...blank }]);
  const del = (i) => onChange(items.filter((_, n) => n !== i));
  const edit = (i, key, val) => { const c = [...items]; c[i] = { ...c[i], [key]: val }; onChange(c); };
  return (
    <Section title={title}>
      <button className="btn" onClick={add} style={{ ...btnPurple, marginBottom: 16, display: "inline-flex",
        alignItems: "center", gap: 6 }}><Plus size={16} /> Add</button>
      <div style={{ display: "grid", gap: 14 }}>
        {items.map((it, i) => (
          <div key={it.id} style={{ border: "1px solid rgba(0,0,0,.1)", borderRadius: 12,
            padding: 14, display: "grid", gap: 8, position: "relative" }}>
            {fields.map(([key, lbl, kind]) => (
              kind === "image" ? (
                <ImageField key={key} label={lbl} value={it[key] || ""}
                  folder={title.toLowerCase().includes("sponsor") ? "sponsors" : "gallery"}
                  onChange={(url) => edit(i, key, url)} />
              ) : (
                <div key={key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#7a7488" }}>{lbl}</label>
                  <input style={inpSm} value={it[key] || ""} onChange={(e) => edit(i, key, e.target.value)} />
                </div>
              )
            ))}
            <button onClick={() => del(i)} style={{ ...delBtn, position: "absolute", top: 10, right: 10 }}
              aria-label="Delete"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------- shared styles ---------- */
const card = { background: "#fff", borderRadius: 18, border: "1px solid rgba(75,46,131,.1)",
  boxShadow: "0 4px 20px rgba(75,46,131,.06)" };
const btnGold = { background: GOLD, color: "#2c2418", border: "none", padding: "14px 28px",
  borderRadius: 12, fontWeight: 700, fontSize: 15.5, cursor: "pointer", fontFamily: "inherit" };
const btnGhost = { background: "rgba(255,255,255,.12)", color: "#fff",
  border: "1px solid rgba(255,255,255,.35)", padding: "14px 28px", borderRadius: 12,
  fontWeight: 600, fontSize: 15.5, cursor: "pointer", fontFamily: "inherit" };
const btnPurple = { background: PURPLE, color: "#fff", border: "none", padding: "11px 20px",
  borderRadius: 10, fontWeight: 600, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" };
const inp = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,.15)",
  fontSize: 14.5, fontFamily: "inherit", outline: "none" };
const inpSm = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid rgba(0,0,0,.15)",
  fontSize: 13.5, fontFamily: "inherit", outline: "none" };
const miniBtn = { display: "inline-flex", alignItems: "center", gap: 5, background: PURPLE, color: "#fff",
  border: "none", padding: "5px 11px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit" };
const delBtn = { background: "rgba(192,57,43,.1)", color: "#c0392b", border: "none", borderRadius: 8,
  width: 34, height: 34, display: "grid", placeItems: "center", cursor: "pointer" };
