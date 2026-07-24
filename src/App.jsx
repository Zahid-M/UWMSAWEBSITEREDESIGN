import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase, loadContent, saveContent, uploadImage, deleteImage, pathFromUrl } from "./supabase";
import {
  Menu, X, Heart, MapPin, Clock, Calendar, Users, BookOpen,
  ShoppingBag, Instagram, Facebook, MessageCircle, Link2,
  Lock, LogOut, Plus, Trash2, Edit3, ChevronLeft, ChevronRight,
  Home, Star, HandHeart, GraduationCap, Sparkles, ExternalLink, Save,
  Sun, Moon
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
  { id: "board", label: "Board", external: false },
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


/* Small petal glyph for the toggle button. */
function PetalIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      style={{ display: "block" }}>
      <path d="M12 2 C14.5 6, 18 7, 20.5 6.5 C19.5 10, 20 13.5, 22 16 C18.5 16.5, 15.5 18.5, 14 22 C13 18.5, 12 17, 12 17 C12 17, 11 18.5, 10 22 C8.5 18.5, 5.5 16.5, 2 16 C4 13.5, 4.5 10, 3.5 6.5 C6 7, 9.5 6, 12 2 Z"
        fill={color} />
    </svg>
  );
}

/* ── Light Markdown ─────────────────────────────────────────────────────
   Admin-entered copy supports **bold**, *italic*, [links](url) and blank
   lines for paragraphs. Rendered by building React elements — never
   dangerouslySetInnerHTML, so admin text can't inject markup. */
function inlineMd(text, keyPrefix = "m") {
  const nodes = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m, i = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b${i++}`}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("*")) {
      nodes.push(<em key={`${keyPrefix}-i${i++}`}>{tok.slice(1, -1)}</em>);
    } else {
      const close = tok.indexOf("](");
      const label = tok.slice(1, close);
      const href = tok.slice(close + 2, -1);
      const external = /^https?:\/\//i.test(href);
      nodes.push(
        <a key={`${keyPrefix}-a${i++}`} href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          style={{ color: "var(--accent)", fontWeight: 600 }}>{label}</a>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function Markdown({ text, style }) {
  if (!text) return null;
  const paras = String(text).split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} style={{ margin: i === 0 ? "0 0 12px" : "0 0 12px", ...style }}>
          {inlineMd(p.trim(), `p${i}`)}
        </p>
      ))}
    </>
  );
}

/* Pulls a section's admin-editable copy, falling back to the seed defaults
   so a missing field never renders a blank heading. */
function useSectionCopy(data, key) {
  const fromData = data?.sections?.[key] || {};
  const fallback = seed.sections?.[key] || {};
  return {
    eyebrow: fromData.eyebrow ?? fallback.eyebrow ?? "",
    title: fromData.title ?? fallback.title ?? "",
    body: fromData.body ?? fallback.body ?? "",
  };
}

/* ── Rosette ────────────────────────────────────────────────────────────
   The circular medallion found in mosque domes, windows and tilework —
   built the way it is drawn with a compass: a ring of overlapping circles,
   concentric guides, radial spokes, and an n-point star traced by skipping
   vertices. `skip` must be coprime with `points` or the star breaks into
   separate polygons (12/3 gives three squares; 12/5 gives one star).
   Rotates with scroll: turning as you move down, unwinding as you move up. */
function Rosette({ points = 12, skip = 5, size = 260, color = "currentColor",
  opacity = 0.5, strokeWidth = 1, style }) {
  const R = 100;
  const geom = React.useMemo(() => {
    const circles = [];
    for (let i = 0; i < points; i++) {
      const a = (2 * Math.PI * i) / points;
      circles.push({
        cx: +(Math.cos(a) * R * 0.58).toFixed(2),
        cy: +(Math.sin(a) * R * 0.58).toFixed(2),
      });
    }
    const star = [];
    for (let i = 0; i < points; i++) {
      const a = (2 * Math.PI * ((i * skip) % points)) / points - Math.PI / 2;
      star.push(`${(Math.cos(a) * R * 0.78).toFixed(2)},${(Math.sin(a) * R * 0.78).toFixed(2)}`);
    }
    const spokes = [];
    for (let i = 0; i < points; i++) {
      const a = (2 * Math.PI * i) / points - Math.PI / 2;
      spokes.push({
        x1: +(Math.cos(a) * R * 0.40).toFixed(2), y1: +(Math.sin(a) * R * 0.40).toFixed(2),
        x2: +(Math.cos(a) * R).toFixed(2),        y2: +(Math.sin(a) * R).toFixed(2),
      });
    }
    return { circles, star: star.join(" "), spokes };
  }, [points, skip]);

  return (
    <svg viewBox="-110 -110 220 220" width={size} height={size} aria-hidden="true"
      style={{ display: "block", opacity, overflow: "visible", ...style }}>
      <g fill="none" stroke={color} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke">
        <circle cx="0" cy="0" r={R} />
        <circle cx="0" cy="0" r={R * 0.78} />
        <circle cx="0" cy="0" r={R * 0.40} />
        {geom.circles.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={R * 0.40} opacity="0.72" />
        ))}
        <polygon points={geom.star} />
        {geom.spokes.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} opacity="0.6" />
        ))}
      </g>
    </svg>
  );
}

/* Wraps a Rosette (or anything) and spins it from scroll position.
   `speed` is degrees per 100px scrolled; sign flips the direction. The
   rotation is eased frame-to-frame so it glides rather than snapping,
   and it naturally reverses when the user scrolls back up. */
function ScrollSpin({ speed = 26, children, style, ...rest }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const target = useRef(0);
  const current = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const measure = () => { target.current = (window.scrollY / 100) * speed; };
    const tick = () => {
      current.current += (target.current - current.current) * 0.07;
      el.style.transform = `rotate(${current.current.toFixed(2)}deg)`;
      raf.current = requestAnimationFrame(tick);
    };
    measure();
    current.current = target.current;
    el.style.transform = `rotate(${current.current.toFixed(2)}deg)`;
    raf.current = requestAnimationFrame(tick);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", measure);
    };
  }, [speed, reduced]);

  return (
    <div ref={ref} aria-hidden="true"
      style={{ willChange: "transform", ...style }} {...rest}>{children}</div>
  );
}

/* Rosettes parked in the margins of a section. Positioned mostly outside the
   content column so they fill empty edge space without crowding text. */
function EdgeRosettes({ arrangement = "left" }) {
  const sets = {
    left: [
      { top: "6%",  left: "-7%",  size: 300, points: 12, skip: 5, spin: 22,  op: .10 },
      { bottom: "8%", left: "3%", size: 150, points: 8,  skip: 3, spin: -34, op: .085 },
    ],
    right: [
      { top: "10%", right: "-6%", size: 280, points: 16, skip: 7, spin: -20, op: .10 },
      { bottom: "12%", right: "4%", size: 160, points: 12, skip: 5, spin: 30, op: .085 },
    ],
    both: [
      { top: "4%",  left: "-8%",  size: 320, points: 16, skip: 7, spin: 18,  op: .095 },
      { top: "18%", right: "-7%", size: 240, points: 12, skip: 5, spin: -26, op: .095 },
      { bottom: "6%", left: "42%", size: 130, points: 8, skip: 3, spin: 40,  op: .07 },
    ],
    wide: [
      { top: "12%", left: "-5%",  size: 220, points: 12, skip: 5, spin: 24,  op: .09 },
      { bottom: "10%", right: "-5%", size: 260, points: 16, skip: 7, spin: -18, op: .09 },
    ],
  };
  const items = sets[arrangement] || sets.left;
  return (
    <>
      {items.map((r, i) => (
        <div key={i} aria-hidden="true" style={{
          position: "absolute", pointerEvents: "none", zIndex: 0,
          top: r.top, left: r.left, right: r.right, bottom: r.bottom,
        }}>
          <ScrollSpin speed={r.spin}>
            <Rosette points={r.points} skip={r.skip} size={r.size}
              color="var(--rosette)" opacity={r.op} strokeWidth={1.1} />
          </ScrollSpin>
        </div>
      ))}
    </>
  );
}

/* ── Sakura wind (canvas) ───────────────────────────────────────────────
   Petals drift across the whole viewport and react to scroll: scrolling
   kicks up a gust that pushes them sideways and speeds their fall, then
   decays back to a calm breeze. Canvas keeps it cheap even at 40+ petals.
   Skipped entirely for reduced-motion users. */
function SakuraWind({ dark }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth, h = window.innerHeight;
    const size = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    const COUNT = w < 700 ? 20 : 38;
    const colors = dark
      ? ["rgba(216,168,214,.85)", "rgba(180,120,140,.8)", "rgba(140,120,180,.75)"]
      : ["rgba(180,120,140,.8)", "rgba(200,150,175,.75)", "rgba(140,105,180,.6)"];

    const spawn = (fromTop) => ({
      x: Math.random() * w,
      y: fromTop ? -20 - Math.random() * h : Math.random() * h,
      size: 5 + Math.random() * 9,
      vy: 0.5 + Math.random() * 1,
      vx: -0.4 + Math.random() * 0.8,
      rot: Math.random() * 360,
      vrot: -4 + Math.random() * 8,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.01 + Math.random() * 0.02,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
    let petals = Array.from({ length: COUNT }, () => spawn(false));

    let lastY = window.scrollY;
    let gust = 0;   // horizontal wind, driven by scroll velocity
    let gustV = 0;  // extra downward push while scrolling
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      gust = Math.max(-55, Math.min(55, gust + delta * 1.4));
      gustV = Math.min(30, gustV + Math.abs(delta) * 0.6);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", size, { passive: true });

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      gust *= 0.945;   // decay back to a calm breeze
      gustV *= 0.92;
      for (const p of petals) {
        p.sway += p.swaySpeed;
        p.x += p.vx + gust * 0.055 + Math.sin(p.sway) * 0.7;
        p.y += p.vy + gustV * 0.05;
        p.rot += p.vrot + gust * 0.3;
        if (p.y > h + 20 || p.x < -30 || p.x > w + 30) Object.assign(p, spawn(true));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.42, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", size);
    };
  }, [dark]);
  return (
    <canvas ref={canvasRef} aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: 40, pointerEvents: "none" }} />
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
      <div aria-hidden="true" style={{ position: "absolute", top: "-30%", left: "-4%",
        pointerEvents: "none", zIndex: 0 }}>
        <ScrollSpin speed={20}>
          <Rosette points={12} skip={5} size={260} color={GOLD} opacity={0.10} />
        </ScrollSpin>
      </div>
      <div aria-hidden="true" style={{ position: "absolute", bottom: "-34%", right: "-3%",
        pointerEvents: "none", zIndex: 0 }}>
        <ScrollSpin speed={-24}>
          <Rosette points={16} skip={7} size={230} color={GOLD} opacity={0.10} />
        </ScrollSpin>
      </div>
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
  // ── Section copy ──────────────────────────────────────────────────────
  // Every section's eyebrow, heading and intro paragraph live here so
  // officers can rewrite them from the admin panel without touching code.
  // `body` supports light Markdown: **bold**, *italic*, [text](url), and
  // blank lines for paragraphs.
  sections: {
    gallery:  { eyebrow: "Our community", title: "Moments from the year",
                body: "Eid celebrations, Jummah, retreats, and the everyday gatherings that make MSA home." },
    sponsors: { eyebrow: "With support from", title: "Our sponsors & partners",
                body: "" },
    board:    { eyebrow: "Our team", title: "Board members",
                body: "The students who keep MSA running — past and present." },
    prayer:   { eyebrow: "Prayer", title: "Places & times to pray",
                body: "" },
    events:   { eyebrow: "This week", title: "Weekly calendar",
                body: "Everything happening across the week — drop in anytime." },
    programs: { eyebrow: "Get involved", title: "Our programs",
                body: "Ways to grow, give back, and connect throughout the year." },
    connect:  { eyebrow: "Connect", title: "Find your people",
                body: "Join the group chats, follow along, and support the community." },
    donate:   { title: "Support the MSA",
                body: "Your donation funds events, iftars, and student programs." },
  },
  // ── Board members ─────────────────────────────────────────────────────
  // status: "current" | "previous". `href` is optional; when set the card
  // links out. `bio` shows in the expanded detail view.
  board: [
    { id: 1, name: "Example Name", role: "President", status: "current",
      img: "", href: "", bio: "Add a short bio from the admin panel." },
    { id: 2, name: "Example Name", role: "Vice President", status: "current",
      img: "", href: "", bio: "" },
    { id: 3, name: "Example Name", role: "Events Chair", status: "current",
      img: "", href: "", bio: "" },
    { id: 4, name: "Example Name", role: "Past President", status: "previous",
      img: "", href: "", bio: "" },
  ],
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
    // ── Manual times (used only when both Masjidal fields above are empty) ──
    Fajr: "5:42 AM", Dhuhr: "1:15 PM", Asr: "4:50 PM",
    Maghrib: "7:38 PM", Isha: "9:05 PM",
    // ── Always shown, under the widget or the manual times ──────────────
    jummah: "First khutbah 1:00 PM · Second 2:15 PM at Islamic House",
    announcement: "",
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

/* Merges saved content over the built-in defaults. Nested objects
   (sections, prayerTimes, hero, events) merge key-by-key so a field the
   admin has never touched keeps its default instead of vanishing. Arrays
   are replaced wholesale — an admin deleting the last item must stick. */
function mergeContent(base, saved) {
  const out = { ...base, ...saved };
  for (const key of ["hero", "sections", "prayerTimes", "events"]) {
    if (base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
      const savedVal = saved?.[key];
      if (savedVal && typeof savedVal === "object" && !Array.isArray(savedVal)) {
        out[key] = { ...base[key], ...savedVal };
        // sections is two levels deep — merge each section's fields too
        if (key === "sections") {
          for (const sk of Object.keys(base.sections)) {
            if (savedVal[sk] && typeof savedVal[sk] === "object") {
              out.sections[sk] = { ...base.sections[sk], ...savedVal[sk] };
            }
          }
        }
      }
    }
  }
  return out;
}

export default function App() {
  const [data, setData] = useState(seed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("home");
  const [adminOpen, setAdminOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Theme — remembers the visitor's choice, otherwise follows their OS setting.
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem("msa-theme");
      if (saved) return saved === "dark";
    } catch {}
    return typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    try { localStorage.setItem("msa-theme", dark ? "dark" : "light"); } catch {}
    // Tell the browser which scheme we're in so form controls and
    // scrollbars match the theme too.
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);

  // Cherry blossom petals — on by default, but the visitor's choice sticks.
  // Anyone who prefers reduced motion starts with them off.
  const [petals, setPetals] = useState(() => {
    try {
      const saved = localStorage.getItem("msa-petals");
      if (saved !== null) return saved === "on";
    } catch {}
    if (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
    return true;
  });
  useEffect(() => {
    try { localStorage.setItem("msa-petals", petals ? "on" : "off"); } catch {}
  }, [petals]);

  // On load: pull saved content from Supabase (fall back to seed if empty),
  // and check whether an admin session is already active.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await loadContent();
      if (!cancelled && remote) setData(mergeContent(seed, remote));
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
    <div data-theme={dark ? "dark" : "light"}
      style={{ fontFamily: "'Poppins', system-ui, sans-serif",
        color: "var(--text)", background: "var(--bg)", minHeight: "100vh" }}>
      <StyleTag />
      {petals && <SakuraWind dark={dark} />}
      <Nav active={active} onNav={scrollTo} menuOpen={menuOpen} setMenuOpen={setMenuOpen}
           onAdmin={() => setAdminOpen(true)} isAdmin={isAdmin}
           dark={dark} onToggleDark={() => setDark((d) => !d)}
           petals={petals} onTogglePetals={() => setPetals((p) => !p)} />
      <main>
        <HomeSection data={data} onNav={scrollTo} />
        <PrayerSection data={data} />
        <EventsSection data={data} />
        <StatsBand stats={data.stats || []} />
        <ProgramsSection data={data} />
        <BoardSection data={data} />
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

      /* ── Theme tokens ───────────────────────────────────────────────────
         Purple and gold stay constant across both themes — only the
         surfaces and text shift. Everything reads from these variables so
         a theme swap never needs component changes. */
      :root, [data-theme="light"] {
        --bg: #faf9fc;
        --surface: #ffffff;
        --surface-2: #faf9fc;
        --nav-bg: rgba(255,255,255,.62);
        --nav-bg-solid: rgba(255,255,255,.86);
        --text: #2c2640;
        --text-muted: #5a5468;
        --text-soft: #4a4458;
        --text-faint: #8a8498;
        --border: rgba(75,46,131,.10);
        --border-strong: rgba(0,0,0,.15);
        --card-shadow: 0 4px 20px rgba(75,46,131,.06);
        --card-shadow-hover: 0 22px 48px rgba(75,46,131,.20);
        --tint: rgba(75,46,131,.05);
        --tint-2: rgba(75,46,131,.08);
        --lattice: #5b3d8c;
        --rosette: #5b3d8c;
        /* Nav + icon accent: purple reads well on light, gold on dark. */
        --accent: #5b3d8c;
        --accent-strong: #4a3175;
        --nav-active-bg: rgba(75,46,131,.09);
        --nav-idle: #4a4458;
      }
      [data-theme="dark"] {
        --bg: #120e1a;
        --surface: #1c1628;
        --surface-2: #171122;
        --nav-bg: rgba(18,14,26,.66);
        --nav-bg-solid: rgba(18,14,26,.90);
        --text: #f1ecfa;
        --text-muted: #bcb2d4;
        --text-soft: #cfc4e6;
        --text-faint: #948ab0;
        --border: rgba(201,182,214,.14);
        --border-strong: rgba(201,182,214,.22);
        --card-shadow: 0 4px 22px rgba(0,0,0,.34);
        --card-shadow-hover: 0 22px 52px rgba(0,0,0,.46);
        --tint: rgba(201,182,214,.06);
        --tint-2: rgba(201,182,214,.10);
        --lattice: #c9b6d6;
        --rosette: #d9c79a;
        --accent: #d9c79a;
        --accent-strong: #e6d7b0;
        --nav-active-bg: rgba(201,182,136,.16);
        --nav-idle: #c3b8db;
      }
      /* Theme swap eases rather than snapping. */
      body, #root, [data-theme] {
        transition: background-color 420ms ${EASE.inOut}, color 420ms ${EASE.inOut};
      }

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
                    box-shadow: var(--card-shadow-hover); }
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
        height: 2px; background: var(--accent); border-radius: 2px;
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

      /* ── Hanging lanterns: pendulum swing + breathing glow ──────────── */
      @keyframes swing {
        0%   { transform: rotate(-2.6deg); }
        50%  { transform: rotate(2.6deg); }
        100% { transform: rotate(-2.6deg); }
      }
      .swing { animation-name: swing; animation-timing-function: ${EASE.inOut};
               animation-iteration-count: infinite; will-change: transform; }
      @keyframes lampPulse {
        0%, 100% { opacity: .55; transform: translate(-50%,-50%) scale(1); }
        50%      { opacity: 1;   transform: translate(-50%,-50%) scale(1.13); }
      }
      .lampglow { animation: lampPulse 5.5s ${EASE.inOut} infinite; }

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

function Nav({ active, onNav, menuOpen, setMenuOpen, onAdmin, dark, onToggleDark,
  petals, onTogglePetals }) {
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
      background: solid ? "var(--nav-bg-solid)" : "var(--nav-bg)",
      backdropFilter: `blur(${solid ? 18 : 10}px) saturate(1.6)`,
      WebkitBackdropFilter: `blur(${solid ? 18 : 10}px) saturate(1.6)`,
      borderBottom: `1px solid ${solid ? "var(--border)" : "transparent"}`,
      boxShadow: solid ? "var(--card-shadow)" : "0 0 0 rgba(0,0,0,0)",
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
          <button className="btn" onClick={onTogglePetals}
            aria-pressed={!!petals}
            title={petals ? "Turn off falling petals" : "Turn on falling petals"}
            aria-label={petals ? "Turn off falling petals" : "Turn on falling petals"}
            style={{
            marginLeft: 6, display: "grid", placeItems: "center", width: 38, height: 38,
            borderRadius: 10, border: `1px solid var(--border-strong)`,
            background: petals ? "var(--nav-active-bg)" : "var(--surface)", cursor: "pointer" }}>
            <span style={{ display: "grid", placeItems: "center",
              opacity: petals ? 1 : .45,
              transform: petals ? "rotate(0deg) scale(1)" : "rotate(-18deg) scale(.9)",
              transition: `transform ${DUR.base}ms ${EASE.spring}, opacity ${DUR.fast}ms ${EASE.out}` }}>
              <PetalIcon size={17} color="var(--accent)" />
            </span>
          </button>
          <button className="btn themetoggle" onClick={onToggleDark}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} style={{
            marginLeft: 6, display: "grid", placeItems: "center", width: 38, height: 38,
            borderRadius: 10, border: `1px solid var(--border-strong)`,
            background: "var(--surface)", cursor: "pointer", overflow: "hidden" }}>
            <span style={{ display: "grid", placeItems: "center",
              transform: dark ? "rotate(0deg)" : "rotate(-90deg) scale(.8)",
              opacity: 1, transition: `transform ${DUR.base}ms ${EASE.spring}` }}>
              {dark ? <Sun size={16} color="var(--accent)" /> : <Moon size={16} color="var(--accent)" />}
            </span>
          </button>
          <button className="btn" onClick={onAdmin} aria-label="Admin login" style={{
            marginLeft: 6, display: "grid", placeItems: "center", width: 38, height: 38,
            borderRadius: 10, border: `1px solid var(--border-strong)`,
            background: "var(--surface)", cursor: "pointer" }}>
            <Lock size={16} color="var(--accent)" />
          </button>
        </div>

        <button className="mob" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu"
          style={{ display: "none", background: "none", border: "none", cursor: "pointer" }}>
          {menuOpen ? <X size={26} color="var(--accent)" /> : <Menu size={26} color="var(--accent)" />}
        </button>
      </nav>

      {menuOpen && (
        <div className="mob" style={{ display: "none", padding: "8px 20px 20px", background: "var(--nav-bg-solid)",
          borderTop: `1px solid var(--border)` }}>
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
          <button onClick={onToggleDark} style={mobLink}>
            {dark ? <Sun size={15} /> : <Moon size={15} />} {dark ? "Light mode" : "Dark mode"}
          </button>
          <button onClick={onTogglePetals} style={mobLink} aria-pressed={!!petals}>
            <PetalIcon size={15} color="var(--accent)" />
            {petals ? "Petals: on" : "Petals: off"}
          </button>
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
  padding: "9px 14px", background: on ? "var(--nav-active-bg)" : "transparent",
  border: "none", cursor: "pointer", borderRadius: 10, fontWeight: 600, fontSize: 14.5,
  color: on ? "var(--accent)" : "var(--nav-idle)",
  fontFamily: "inherit", textDecoration: "none",
  transition: `background ${DUR.fast}ms ${EASE.out}, color ${DUR.fast}ms ${EASE.out}`,
});
const mobLink = {
  display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
  padding: "13px 8px", background: "none", border: "none", borderBottom: "1px solid var(--border)",
  fontSize: 16, fontWeight: 600, color: "var(--accent)", cursor: "pointer",
  fontFamily: "inherit", textDecoration: "none",
};

function Band({ children, id, alt, style, divider, lattice, decor, floats, rosettes }) {
  return (
    <section id={id} style={{ position: "relative", overflow: "hidden",
      padding: "92px 20px", background: alt ? "var(--surface)" : "transparent", ...style }}>
      {lattice && <StarLatticeBg color="var(--lattice)" opacity={alt ? 0.055 : 0.05} unit={66} />}
      {rosettes && <EdgeRosettes arrangement={rosettes} />}
      {floats}
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
    <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, color: "var(--accent)",
      margin: "0 0 16px", letterSpacing: "-1px", lineHeight: 1.1 }}>
      {isText
        ? <TextReveal text={children} delay={delay + 90} step={48} />
        : <Reveal delay={delay + 90} variant="up" distance={20}>{children}</Reveal>}
    </h2>
  );
}

/* Renders a section's eyebrow + title + intro from admin-editable copy.
   Any field left blank in the admin panel is simply skipped. */
function SectionCopy({ data, sectionKey, style }) {
  const copy = useSectionCopy(data, sectionKey);
  return (
    <>
      {copy.eyebrow && <Eyebrow>{copy.eyebrow}</Eyebrow>}
      {copy.title && <Title>{copy.title}</Title>}
      {copy.body && (
        <Reveal delay={260} variant="up" distance={18}>
          <div style={{ color: "var(--text-muted)", maxWidth: 560, marginBottom: 36,
            fontSize: 16.5, lineHeight: 1.65, ...style }}>
            <Markdown text={copy.body} style={{ margin: "0 0 10px" }} />
          </div>
        </Reveal>
      )}
    </>
  );
}

/* Lead paragraph under a Title — reveals just after it. */
function Lead({ children, delay = 260, style }) {
  return (
    <Reveal delay={delay} variant="up" distance={18}>
      <p style={{ color: "var(--text-muted)", maxWidth: 560, margin: "0 0 36px", fontSize: 16.5,
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
        {/* large medallion behind the hero content, turning with scroll */}
        <div aria-hidden="true" style={{ position: "absolute", top: "8%", left: "50%",
          marginLeft: -260, pointerEvents: "none", zIndex: 0 }}>
          <ScrollSpin speed={14}>
            <Rosette points={16} skip={7} size={520} color={GOLD}
              opacity={0.11} strokeWidth={1} />
          </ScrollSpin>
        </div>
        <HangingLanterns />
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
      <Band id="gallery" lattice decor="left" rosettes="left" floats={<>
        <Parallax speed={.12} float style={{ top: 20, right: "8%" }}>
          <Star8 size={64} color="var(--rosette)" opacity={.10} /></Parallax>
        <Parallax speed={-.08} float style={{ bottom: 40, left: "4%" }}>
          <Star8 size={38} color={GOLD} opacity={.16} /></Parallax>
      </>}>
        <SectionCopy data={data} sectionKey="gallery" />
        <Gallery items={data.gallery} />
      </Band>

      {/* Sponsors */}
      <Band alt rosettes="wide">
        <SectionCopy data={data} sectionKey="sponsors" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))",
          gap: 16, marginTop: 32 }}>
          {data.sponsors.map((s, n) => {
            const inner = s.logo ? (
              <img src={s.logo} alt={s.name} className="sponsorlogo"
                style={{ maxHeight: 60, maxWidth: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 15 }}>{s.name}</span>
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
              <Star8 size={190} color="var(--rosette)" />
            </div>
            <div style={{ position: "relative" }}>
              <h3 style={{ margin: "0 0 6px", color: "var(--accent)", fontSize: 21, fontWeight: 700 }}>
                {(data.sections?.donate?.title) ?? seed.sections.donate.title}</h3>
              <div style={{ color: "var(--text-muted)" }}>
                <Markdown text={(data.sections?.donate?.body) ?? seed.sections.donate.body}
                  style={{ margin: 0 }} />
              </div>
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

/* Lanterns strung across the top of the hero. Each hangs from its own cord,
   swings on its own cycle, and glows softly — staggered so they never move
   in unison. Hidden for reduced-motion users. */
function HangingLanterns() {
  const reduced = useReducedMotion();
  const [lit, setLit] = useState(false);
  useEffect(() => {
    if (reduced) { setLit(true); return; }
    const t = setTimeout(() => setLit(true), 500);
    return () => clearTimeout(t);
  }, [reduced]);

  // left %, drop length, scale, swing duration, phase offset
  const lamps = [
    { left: 8,  drop: 34, size: 52, dur: 6.4, delay: -0.9 },
    { left: 21, drop: 74, size: 40, dur: 7.8, delay: -2.6 },
    { left: 34, drop: 20, size: 34, dur: 5.6, delay: -1.7 },
    { left: 68, drop: 26, size: 36, dur: 7.1, delay: -0.3 },
    { left: 80, drop: 66, size: 46, dur: 6.0, delay: -3.4 },
    { left: 92, drop: 30, size: 38, dur: 8.2, delay: -1.2 },
  ];

  return (
    <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0,
      height: "56%", overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {lamps.map((l, i) => (
        <div key={i} style={{
          position: "absolute", left: `${l.left}%`, top: 0,
          transformOrigin: "50% 0%",
          opacity: lit ? 1 : 0,
          transform: lit ? "none" : "translate3d(0,-24px,0)",
          transition: reduced ? "none"
            : `opacity ${DUR.slow}ms ${EASE.outSoft} ${240 + i * 110}ms, transform ${DUR.slow}ms ${EASE.outSoft} ${240 + i * 110}ms`,
        }}>
          {/* swing wrapper — separate element so the entrance transform above
              is never clobbered by the animation */}
          <div className={reduced ? "" : "swing"} style={{
            transformOrigin: "50% 0%",
            animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s`,
          }}>
            {/* cord */}
            <div style={{ width: 1, height: l.drop, margin: "0 auto",
              background: "linear-gradient(rgba(201,182,136,.55), rgba(201,182,136,.28))" }} />
            <div style={{ position: "relative" }}>
              {/* glow behind the lamp */}
              <div className={reduced ? "" : "lampglow"} style={{
                position: "absolute", left: "50%", top: "42%",
                width: l.size * 2.4, height: l.size * 2.4,
                transform: "translate(-50%,-50%)", borderRadius: "50%",
                background: `radial-gradient(circle, rgba(201,182,136,.30) 0%, transparent 66%)`,
                filter: "blur(12px)", animationDelay: `${l.delay}s`,
              }} />
              <Lantern size={l.size} color={GOLD} opacity={0.62}
                style={{ position: "relative", margin: "0 auto" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
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
  // NOTE: the centering translate and the float animation must live on
  // separate elements — a CSS animation that sets `transform` would otherwise
  // overwrite `translateX(-50%)` and knock the arch off-centre.
  return (
    <div aria-hidden="true"
      style={{ position: "absolute", top: 40, left: "50%",
        transform: "translateX(-50%)", width: "min(560px, 88%)", height: "82%",
        opacity: 0.5, pointerEvents: "none" }}>
      <div className={reduced ? "" : "floaty-slow"} style={{ width: "100%", height: "100%" }}>
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
      <div style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", padding: "4px 0 8px" }}>
        Prayer times powered by Masjidal
      </div>
    </div>
  );
}

function PrayerSection({ data }) {
  const t = data.prayerTimes;
  return (
    <Band id="prayer" alt lattice rosettes="right">
      <SectionCopy data={data} sectionKey="prayer" />
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
                <MapPin size={20} color="var(--accent)" style={{ position: "relative", marginTop: 6 }} />
              </div>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>{s.name}</h3>
                <div style={{ color: "var(--text-muted)", fontSize: 14.5, marginBottom: 6 }}>{s.loc}</div>
                <div style={{ color: "var(--text-faint)", fontSize: 13.5 }}>{s.note}</div>
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
                  alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>{p}</span>
                  <span style={{ fontFamily: "'Amiri',serif", fontSize: 18, color: "var(--accent)", fontWeight: 700 }}>{t[p]}</span>
                </div>
              ))}
            </div>
          )}

          {t.jummah && (
            <div style={{ padding: "16px 24px", background: "rgba(183,165,122,.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Calendar size={16} color={GOLD} />
                <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--accent)" }}>Jummah</span>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
                <Markdown text={t.jummah} style={{ margin: 0 }} />
              </div>
            </div>
          )}
          {t.announcement && (
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Sparkles size={16} color={GOLD} />
                <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--accent)" }}>Announcement</span>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
                <Markdown text={t.announcement} style={{ margin: 0 }} />
              </div>
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
    <Band id="events" divider lattice decor="both" rosettes="both">
      <SectionCopy data={data} sectionKey="events" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 16 }}>
        {DAYS.map((day, dn) => {
          const evs = data.events[day] || [];
          const isFri = day === "Friday";
          return (
            <Reveal key={day} delay={dn * 75} variant="rise" distance={28} duration={DUR.slow}>
            <div className="eventcard" style={{ ...card, padding: 0, overflow: "hidden", height: "100%",
              border: isFri ? `2px solid ${GOLD}` : card.border }}>
              <div style={{ padding: "12px 18px", background: isFri ? "rgba(183,165,122,.15)" : "var(--tint)",
                display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 15 }}>{day}</span>
                {isFri && <Star8 size={15} />}
              </div>
              <div style={{ padding: 14, display: "grid", gap: 10, minHeight: 90 }}>
                {evs.length === 0 && (
                  <div style={{ color: "var(--text-faint)", fontSize: 13.5, padding: "18px 0", textAlign: "center" }}>
                    No events yet</div>
                )}
                {evs.map((e) => (
                  <div key={e.id} style={{ borderRadius: 12, overflow: "hidden",
                    background: "var(--tint)", border: "1px solid var(--border)" }}>
                    {e.img && <img src={e.img} alt={e.name}
                      style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} />}
                    <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 14.5, marginBottom: 5 }}>{e.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--accent)",
                      fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>
                      <Clock size={12} /> {e.time}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-faint)", fontSize: 12.5 }}>
                      <MapPin size={12} /> {e.loc}</div>
                    {e.desc && <div style={{ color: "var(--text-faint)", fontSize: 12, marginTop: 6 }}>{e.desc}</div>}
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

/* ---------- BOARD MEMBERS ---------- */
/* Compact revolving carousel, deliberately smaller in scale than the main
   gallery. Tabs switch between current and previous board. Clicking a card
   opens its bio; if the member has a link, the bio panel offers it. */
function BoardSection({ data }) {
  const [tab, setTab] = useState("current");
  const [open, setOpen] = useState(null);   // id of expanded member
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(4);
  const reduced = useReducedMotion();

  // How many cards fit at once — recalculated on resize.
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      setPerPage(w < 560 ? 1 : w < 860 ? 2 : w < 1120 ? 3 : 4);
    };
    calc();
    window.addEventListener("resize", calc, { passive: true });
    return () => window.removeEventListener("resize", calc);
  }, []);

  const members = (data.board || []).filter((m) => (m.status || "current") === tab);
  const pages = Math.max(1, Math.ceil(members.length / perPage));

  // Keep the page in range when the tab or viewport changes.
  useEffect(() => { setPage((p) => Math.min(p, pages - 1)); }, [pages, tab]);
  useEffect(() => { setOpen(null); setPage(0); }, [tab]);

  const openMember = members.find((m) => m.id === open);

  const switchTab = (t) => { if (t !== tab) setTab(t); };

  return (
    <Band id="board" alt lattice rosettes="right" decor="left">
      <SectionCopy data={data} sectionKey="board" />

      {/* Tabs — the active pill slides between options */}
      <Reveal variant="up" distance={16}>
        <div role="tablist" aria-label="Board member groups"
          style={{ display: "inline-flex", position: "relative", padding: 4, borderRadius: 999,
            background: "var(--tint)", border: "1px solid var(--border)", marginBottom: 28 }}>
          <span aria-hidden="true" style={{ position: "absolute", top: 4, bottom: 4,
            left: 4, width: "calc(50% - 4px)", borderRadius: 999, background: "var(--surface)",
            boxShadow: "var(--card-shadow)",
            transform: tab === "current" ? "translateX(0)" : "translateX(100%)",
            transition: reduced ? "none" : `transform ${DUR.base}ms ${EASE.out}` }} />
          {[["current", "Current board"], ["previous", "Previous board"]].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => switchTab(k)}
              style={{ position: "relative", zIndex: 1, border: "none", background: "none",
                cursor: "pointer", padding: "9px 20px", borderRadius: 999,
                fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                color: tab === k ? "var(--accent)" : "var(--text-muted)",
                transition: `color ${DUR.fast}ms ${EASE.out}` }}>
              {label}
            </button>
          ))}
        </div>
      </Reveal>

      {members.length === 0 ? (
        <div style={{ color: "var(--text-faint)", fontSize: 14.5, padding: "22px 0" }}>
          No {tab === "current" ? "current" : "previous"} board members listed yet.
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Track — translated by page, so it revolves rather than reflowing */}
          <div style={{ overflow: "hidden" }}>
            <div style={{ display: "flex",
              transform: `translate3d(-${page * 100}%, 0, 0)`,
              transition: reduced ? "none" : `transform ${DUR.slow}ms ${EASE.outSoft}` }}>
              {Array.from({ length: pages }, (_, pi) => (
                <div key={pi} style={{ flex: "0 0 100%", display: "grid", gap: 16,
                  gridTemplateColumns: `repeat(${perPage}, minmax(0, 1fr))` }}>
                  {members.slice(pi * perPage, pi * perPage + perPage).map((m, n) => (
                    <BoardCard key={m.id} member={m} delay={n * 70}
                      active={open === m.id}
                      onOpen={() => setOpen(open === m.id ? null : m.id)} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {pages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
              gap: 12, marginTop: 20 }}>
              <button className="btn" aria-label="Previous board members"
                onClick={() => setPage((p) => (p - 1 + pages) % pages)}
                style={boardNavBtn}><ChevronLeft size={18} color="var(--accent)" /></button>
              <div style={{ display: "flex", gap: 7 }}>
                {Array.from({ length: pages }, (_, n) => (
                  <button key={n} onClick={() => setPage(n)} aria-label={`Page ${n + 1}`}
                    style={{ width: 22, height: 8, borderRadius: 99, border: "none",
                      background: "transparent", cursor: "pointer", padding: 0,
                      display: "grid", placeItems: "center" }}>
                    <span aria-hidden="true" style={{ display: "block", width: 22, height: 8,
                      borderRadius: 99, transformOrigin: "50% 50%",
                      transform: n === page ? "scaleX(1)" : "scaleX(.34)",
                      background: n === page ? GOLD : "var(--border-strong)",
                      transition: `transform ${DUR.base}ms ${EASE.out}, background ${DUR.base}ms ${EASE.out}` }} />
                  </button>
                ))}
              </div>
              <button className="btn" aria-label="Next board members"
                onClick={() => setPage((p) => (p + 1) % pages)}
                style={boardNavBtn}><ChevronRight size={18} color="var(--accent)" /></button>
            </div>
          )}

          {/* Expanded bio — grid-rows trick animates height without JS measuring */}
          <div style={{ display: "grid",
            gridTemplateRows: openMember ? "1fr" : "0fr",
            opacity: openMember ? 1 : 0,
            marginTop: openMember ? 20 : 0,
            transition: reduced ? "none"
              : `grid-template-rows ${DUR.base}ms ${EASE.out}, opacity ${DUR.base}ms ${EASE.out}, margin-top ${DUR.base}ms ${EASE.out}` }}>
            <div style={{ overflow: "hidden" }}>
              {openMember && (
                <div style={{ ...card, padding: "22px 24px", display: "flex", gap: 18,
                  alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: "var(--accent)" }}>
                      {openMember.name}</div>
                    <div style={{ fontSize: 13.5, color: "var(--text-faint)", marginBottom: 10 }}>
                      {openMember.role}</div>
                    {openMember.bio
                      ? <div style={{ color: "var(--text-muted)", fontSize: 14.5, lineHeight: 1.65 }}>
                          <Markdown text={openMember.bio} style={{ margin: "0 0 8px" }} /></div>
                      : <div style={{ color: "var(--text-faint)", fontSize: 14 }}>No bio yet.</div>}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {openMember.href && (
                      <a className="btn" href={openMember.href} target="_blank" rel="noopener noreferrer"
                        style={{ ...btnPurple, textDecoration: "none", display: "inline-flex",
                          alignItems: "center", gap: 7 }}>
                        Visit <ExternalLink size={14} />
                      </a>
                    )}
                    <button className="btn" onClick={() => setOpen(null)}
                      style={{ ...btnPurple, background: "var(--tint-2)", color: "var(--accent)" }}>
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Band>
  );
}

const boardNavBtn = {
  width: 38, height: 38, borderRadius: 999, cursor: "pointer",
  border: "1px solid var(--border-strong)", background: "var(--surface)",
  display: "grid", placeItems: "center",
};

/* One board member. Compact portrait card; clicking toggles the bio panel. */
function BoardCard({ member: m, delay = 0, active, onOpen }) {
  const [hover, setHover] = useState(false);
  const initials = String(m.name || "?").trim().split(/\s+/)
    .slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
  return (
    <Reveal delay={delay} variant="rise" distance={24}>
      <button onClick={onOpen} aria-expanded={!!active}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        className="lift zoomable"
        style={{ ...card, width: "100%", padding: 0, overflow: "hidden", cursor: "pointer",
          textAlign: "left", fontFamily: "inherit", display: "block",
          borderColor: active ? GOLD : undefined,
          borderWidth: active ? 2 : 1, borderStyle: "solid" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1",
          overflow: "hidden", background: `linear-gradient(140deg, ${PURPLE_D}, ${VIOLET})` }}>
          {m.img
            ? <img src={m.img} alt="" loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
                color: "rgba(255,255,255,.9)", fontSize: 30, fontWeight: 800, letterSpacing: 1 }}>
                {initials || <Users size={30} />}
              </div>}
          {/* hover scrim hinting the card is interactive */}
          <div aria-hidden="true" style={{ position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(20,17,24,.55), transparent 55%)",
            opacity: hover || active ? 1 : 0.65,
            transition: `opacity ${DUR.fast}ms ${EASE.out}` }} />
          {m.href && (
            <span aria-hidden="true" style={{ position: "absolute", top: 8, right: 8,
              width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center",
              background: "rgba(255,255,255,.9)",
              transform: hover ? "translate3d(0,-2px,0)" : "none",
              transition: `transform ${DUR.fast}ms ${EASE.spring}` }}>
              <ExternalLink size={13} color={PURPLE} />
            </span>
          )}
        </div>
        <div style={{ padding: "12px 14px 14px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.role}</div>
        </div>
      </button>
    </Reveal>
  );
}

/* ---------- PROGRAMS ---------- */
function ProgramsSection({ data }) {
  return (
    <Band id="programs" alt divider lattice decor="right" rosettes="left">
      <SectionCopy data={data} sectionKey="programs" />
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
      <h3 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 700, color: "var(--accent)" }}>{p.name}</h3>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14.5, lineHeight: 1.6 }}>{p.desc}</p>
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
    <Band id="connect" lattice decor="left" rosettes="wide">
      <SectionCopy data={data} sectionKey="connect" />
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
        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 16 }}>{l.name}</div>
        <div style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600, display: "flex",
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
      <div onClick={(e) => e.stopPropagation()} className="modalIn" style={{ background: "var(--surface)", borderRadius: 20,
        width: "100%", maxWidth: isAdmin ? 880 : 420, maxHeight: "90vh", overflow: "hidden",
        display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0,0,0,.4)",
        transition: `max-width ${DUR.base}ms ${EASE.out}` }}>

        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)",
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
            <p style={{ margin: "0 0 18px", color: "var(--text-muted)", fontSize: 14.5, lineHeight: 1.6 }}>
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
            <p style={{ margin: "16px 0 0", fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5 }}>
              Accounts are managed by MSA admins in Supabase. Ask an admin to add you if you
              need access.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
            <div style={{ width: 190, borderRight: "1px solid var(--border)", padding: 12,
              overflowY: "auto", background: "var(--surface-2)" }}>
              {[
                ["hero", "Home / Hero"], ["copy", "Section text"],
                ["gallery", "Photos"], ["sponsors", "Sponsors"], ["board", "Board members"],
                ["spaces", "Prayer spaces"], ["times", "Prayer times"], ["events", "Events"],
                ["programs", "Programs"], ["stats", "Stats"], ["links", "Links"],
              ].map(([k, lbl]) => (
                <button key={k} onClick={() => setTab(k)} style={{ display: "block", width: "100%",
                  textAlign: "left", padding: "10px 12px", borderRadius: 9, border: "none",
                  background: tab === k ? PURPLE : "transparent",
                  color: tab === k ? "#fff" : "var(--text-soft)",
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
                gap: 12, padding: "12px 24px", borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)", flexWrap: "wrap" }}>
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
        <div style={{ margin: "4px 0 14px", padding: "10px 12px", borderRadius: 10,
          background: "var(--tint)", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
          The manual times below are only used when both Masjidal fields above are empty.
          Jummah and Announcement always show, either way.
        </div>
        {["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].map((p) => (
          <Field key={p} label={`${p} (manual fallback)`}>
            <input style={inp} value={t[p] ?? ""} onChange={(e) => setT({ [p]: e.target.value })} />
          </Field>
        ))}
        <Field label="Jummah info (always shown)">
          <input style={inp} value={t.jummah ?? ""}
            placeholder="e.g. First khutbah 1:00 PM · Second 2:15 PM at Islamic House"
            onChange={(e) => setT({ jummah: e.target.value })} />
        </Field>
        <Field label="Announcement (always shown — leave blank to hide the block)">
          <textarea style={{ ...inp, minHeight: 70 }} value={t.announcement ?? ""}
            placeholder="e.g. Ramadan taraweeh begins after Isha — all welcome."
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
          <div key={day} style={{ marginBottom: 20, border: "1px solid var(--border)",
            borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "var(--tint)", fontWeight: 700,
              color: "var(--accent)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {day}
              <button onClick={() => setDay(day, [...(data.events[day] || []),
                { id: Date.now(), name: "New event", time: "", loc: "", desc: "", img: "" }])}
                style={miniBtn}><Plus size={14} /> Add</button>
            </div>
            <div style={{ padding: 12, display: "grid", gap: 12 }}>
              {(data.events[day] || []).length === 0 &&
                <div style={{ color: "var(--text-faint)", fontSize: 13, textAlign: "center", padding: 8 }}>No events</div>}
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

  if (tab === "copy") {
    const SECTION_KEYS = [
      ["gallery", "Photo gallery"], ["sponsors", "Sponsors"], ["board", "Board members"],
      ["prayer", "Prayer"], ["events", "Events"], ["programs", "Programs"],
      ["connect", "Connect"], ["donate", "Donate banner"],
    ];
    const sections = data.sections || {};
    const setSection = (key, patch) => up({
      sections: { ...sections, [key]: { ...(sections[key] || {}), ...patch } },
    });
    return (
      <Section title="Section text">
        <p style={{ margin: "-8px 0 18px", fontSize: 13, color: "var(--text-faint)", lineHeight: 1.6 }}>
          Edit the heading and intro paragraph for each section. Leave a field blank to hide it.
          Basic formatting works in the intro: <b>**bold**</b>, <i>*italic*</i>,
          and [link text](https://example.com). Leave a blank line between paragraphs.
        </p>
        {SECTION_KEYS.map(([key, label]) => {
          const cur = sections[key] || seed.sections[key] || {};
          return (
            <div key={key} style={{ marginBottom: 18, border: "1px solid var(--border)",
              borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: "var(--tint)",
                fontWeight: 700, color: "var(--accent)", fontSize: 13.5 }}>{label}</div>
              <div style={{ padding: 14, display: "grid", gap: 10 }}>
                {key !== "donate" && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)" }}>
                      Eyebrow (small label above the heading)</label>
                    <input style={inpSm} value={cur.eyebrow || ""}
                      onChange={(e) => setSection(key, { eyebrow: e.target.value })} />
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)" }}>
                    Heading</label>
                  <input style={inpSm} value={cur.title || ""}
                    onChange={(e) => setSection(key, { title: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)" }}>
                    Intro paragraph</label>
                  <textarea style={{ ...inpSm, minHeight: 74, resize: "vertical" }}
                    value={cur.body || ""}
                    onChange={(e) => setSection(key, { body: e.target.value })} />
                </div>
              </div>
            </div>
          );
        })}
      </Section>
    );
  }

  if (tab === "board") {
    const board = data.board || [];
    const setBoard = (next) => up({ board: next });
    const edit = (i, patch) => {
      const c = [...board]; c[i] = { ...c[i], ...patch }; setBoard(c);
    };
    const add = (status) => setBoard([...board, {
      id: Date.now(), name: "New member", role: "Role", status,
      img: "", href: "", bio: "",
    }]);
    const groups = [["current", "Current board"], ["previous", "Previous board"]];
    return (
      <Section title="Board members">
        <p style={{ margin: "-8px 0 18px", fontSize: 13, color: "var(--text-faint)", lineHeight: 1.6 }}>
          Photos upload to storage; the link is optional and opens when someone clicks the card.
          Move a member to “Previous” at the end of their term rather than deleting them.
        </p>
        {groups.map(([status, label]) => (
          <div key={status} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--accent)" }}>
                {label}</h4>
              <button onClick={() => add(status)} style={miniBtn}>
                <Plus size={14} /> Add</button>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              {board.filter((m) => (m.status || "current") === status).length === 0 && (
                <div style={{ color: "var(--text-faint)", fontSize: 13, padding: 8,
                  textAlign: "center", border: "1px dashed var(--border)", borderRadius: 10 }}>
                  None yet</div>
              )}
              {board.map((m, i) => (m.status || "current") !== status ? null : (
                <div key={m.id} style={{ border: "1px solid var(--border)", borderRadius: 12,
                  padding: 14, display: "grid", gap: 8, position: "relative" }}>
                  <ImageField label="Photo" value={m.img || ""} folder="board"
                    onChange={(url) => edit(i, { img: url })} />
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)" }}>Name</label>
                      <input style={inpSm} value={m.name || ""}
                        onChange={(e) => edit(i, { name: e.target.value })} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)" }}>Role / title</label>
                      <input style={inpSm} value={m.role || ""}
                        onChange={(e) => edit(i, { role: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)" }}>
                      Link (optional)</label>
                    <input style={inpSm} placeholder="https://…" value={m.href || ""}
                      onChange={(e) => edit(i, { href: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)" }}>
                      Mini bio</label>
                    <textarea style={{ ...inpSm, minHeight: 70, resize: "vertical" }}
                      value={m.bio || ""} onChange={(e) => edit(i, { bio: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)" }}>Status</label>
                    <select style={inpSm} value={m.status || "current"}
                      onChange={(e) => edit(i, { status: e.target.value })}>
                      <option value="current">Current</option>
                      <option value="previous">Previous</option>
                    </select>
                  </div>
                  <button onClick={() => setBoard(board.filter((_, n) => n !== i))}
                    style={{ ...delBtn, position: "absolute", top: 10, right: 10 }}
                    aria-label={`Delete ${m.name}`}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>
    );
  }

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
      <h3 style={{ margin: "0 0 18px", color: "var(--accent)", fontSize: 19, fontWeight: 700 }}>{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-soft)",
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
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 5 }}>
        <div style={{ width: 74, height: 56, borderRadius: 9, overflow: "hidden", flexShrink: 0,
          border: "1px solid var(--border-strong)", background: "var(--surface-2)", display: "grid", placeItems: "center" }}>
          {value ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                 : <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>None</span>}
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
          <div key={it.id} style={{ border: "1px solid var(--border)", borderRadius: 12,
            padding: 14, display: "grid", gap: 8, position: "relative" }}>
            {fields.map(([key, lbl, kind]) => (
              kind === "image" ? (
                <ImageField key={key} label={lbl} value={it[key] || ""}
                  folder={title.toLowerCase().includes("sponsor") ? "sponsors" : "gallery"}
                  onChange={(url) => edit(i, key, url)} />
              ) : (
                <div key={key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)" }}>{lbl}</label>
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
const card = { background: "var(--surface)", borderRadius: 18, border: "1px solid var(--border)",
  boxShadow: "var(--card-shadow)" };
const btnGold = { background: GOLD, color: "#2c2418", border: "none", padding: "14px 28px",
  borderRadius: 12, fontWeight: 700, fontSize: 15.5, cursor: "pointer", fontFamily: "inherit" };
const btnGhost = { background: "rgba(255,255,255,.12)", color: "#fff",
  border: "1px solid rgba(255,255,255,.35)", padding: "14px 28px", borderRadius: 12,
  fontWeight: 600, fontSize: 15.5, cursor: "pointer", fontFamily: "inherit" };
const btnPurple = { background: PURPLE, color: "#fff", border: "none", padding: "11px 20px",
  borderRadius: 10, fontWeight: 600, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" };
const inp = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border-strong)",
  fontSize: 14.5, fontFamily: "inherit", outline: "none",
  background: "var(--surface)", color: "var(--text)" };
const inpSm = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid var(--border-strong)",
  fontSize: 13.5, fontFamily: "inherit", outline: "none",
  background: "var(--surface)", color: "var(--text)" };
const miniBtn = { display: "inline-flex", alignItems: "center", gap: 5, background: PURPLE, color: "#fff",
  border: "none", padding: "5px 11px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit" };
const delBtn = { background: "rgba(192,57,43,.1)", color: "#c0392b", border: "none", borderRadius: 8,
  width: 34, height: 34, display: "grid", placeItems: "center", cursor: "pointer" };
