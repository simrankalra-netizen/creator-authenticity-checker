"use client";

// One small animated illustration per onboarding step, drawn in SVG with the
// brand colours. Pure decoration: every step works the same without it.
import { useEffect, useState } from "react";

const C = {
  violet: "var(--color-logo-violet)",
  purple: "var(--color-brand-purple)",
  teal: "var(--color-logo-teal)",
  mint: "var(--color-brand-mint)",
  lime: "var(--color-brand-lime)",
  ink: "var(--color-ink)",
  lavender: "var(--color-lavender)",
  mintTint: "var(--color-mint-tint)",
  limeTint: "var(--color-lime-tint)",
  line: "var(--color-line)",
  good: "var(--color-good)",
  goodBg: "var(--color-good-bg)",
};

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label={label}>
      <circle cx="100" cy="104" r="84" fill="#fff" opacity="0.6" />
      {children}
    </svg>
  );
}

// Step 1: a phone with a message bubble (typing dots, then the bubble pops in)
export function PhoneArt() {
  return (
    <Frame label="A phone receiving a message">
      <rect x="62" y="34" width="76" height="136" rx="16" fill={C.ink} />
      <rect x="68" y="46" width="64" height="112" rx="10" fill="#fff" />
      <rect x="88" y="39" width="24" height="3" rx="1.5" fill="#fff" opacity="0.5" />
      <g className="cg-pop" style={{ animationDelay: "0.25s" }}>
        <rect x="76" y="66" width="48" height="26" rx="10" fill={C.lavender} />
        <circle className="cg-dot" cx="90" cy="79" r="3" fill={C.purple} />
        <circle className="cg-dot" cx="100" cy="79" r="3" fill={C.purple} style={{ animationDelay: "0.2s" }} />
        <circle className="cg-dot" cx="110" cy="79" r="3" fill={C.purple} style={{ animationDelay: "0.4s" }} />
      </g>
      <g className="cg-pop" style={{ animationDelay: "0.9s" }}>
        <rect x="96" y="104" width="56" height="30" rx="12" fill={C.teal} />
        <text x="124" y="124" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" className="font-display">123456</text>
      </g>
      <circle className="cg-twinkle" cx="150" cy="60" r="4" fill={C.lime} />
    </Frame>
  );
}

// Step 2: a shield; the tick draws itself, and turns green with a burst once verified
export function ShieldArt({ verified }: { verified: boolean }) {
  return (
    <Frame label={verified ? "A green shield with a tick: verified" : "A shield waiting for your code"}>
      <path
        d="M100 32 L150 50 V96 C150 130 128 154 100 168 C72 154 50 130 50 96 V50 Z"
        fill={verified ? C.goodBg : C.lavender}
        stroke={verified ? C.good : C.purple}
        strokeWidth="6"
        strokeLinejoin="round"
        style={{ transition: "fill var(--motion-base), stroke var(--motion-base)" }}
      />
      <path
        key={verified ? "on" : "off"}
        className="cg-draw"
        d="M76 100 L94 118 L126 84"
        fill="none"
        stroke={verified ? C.good : C.purple}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ ["--len" as string]: 80, animationDelay: verified ? "0s" : "0.3s" }}
      />
      {verified &&
        [0, 60, 120, 180, 240, 300].map((deg, i) => (
          <circle
            key={deg}
            className="cg-pop"
            cx={100 + 76 * Math.cos((deg * Math.PI) / 180)}
            cy={100 + 76 * Math.sin((deg * Math.PI) / 180)}
            r="5"
            fill={i % 2 ? C.lime : C.mint}
            style={{ animationDelay: `${i * 40}ms` }}
          />
        ))}
    </Frame>
  );
}

// Step 3: a storefront; the awning sways and the sign shows your brand name
export function StoreArt({ name }: { name: string }) {
  const label = (name.trim() || "Your brand").slice(0, 14);
  return (
    <Frame label="A storefront with your brand's sign">
      <rect x="44" y="84" width="112" height="80" rx="6" fill="#fff" stroke={C.ink} strokeWidth="5" />
      <rect x="86" y="118" width="28" height="46" rx="3" fill={C.lavender} stroke={C.ink} strokeWidth="4" />
      <rect x="54" y="116" width="24" height="22" rx="3" fill={C.mintTint} stroke={C.ink} strokeWidth="3" />
      <rect x="122" y="116" width="24" height="22" rx="3" fill={C.mintTint} stroke={C.ink} strokeWidth="3" />
      <g className="cg-sway" style={{ transformOrigin: "100px 66px" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M${38 + i * 21} 66 h21 v18 a10.5 10.5 0 0 1 -21 0 z`} fill={i % 2 ? "#fff" : C.purple} stroke={C.ink} strokeWidth="3" />
        ))}
      </g>
      <g className="cg-pop" style={{ animationDelay: "0.4s" }}>
        <rect x="52" y="36" width="96" height="24" rx="8" fill={C.ink} />
        <text x="100" y="52" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" className="font-display">{label}</text>
      </g>
      <circle className="cg-twinkle" cx="162" cy="44" r="4" fill={C.lime} />
    </Frame>
  );
}

// Step 4: a magnifying glass gliding over a page of text
export function SearchArt() {
  return (
    <Frame label="A magnifying glass reading a page">
      <rect x="40" y="40" width="110" height="128" rx="10" fill="#fff" stroke={C.ink} strokeWidth="5" />
      <rect x="54" y="56" width="50" height="8" rx="4" fill={C.purple} />
      {[78, 94, 110, 126, 142].map((y, i) => (
        <rect key={y} x="54" y={y} width={i % 2 ? 64 : 82} height="6" rx="3" fill={C.line} />
      ))}
      <g className="cg-glide">
        <circle cx="96" cy="96" r="24" fill={C.mintTint} fillOpacity="0.6" stroke={C.teal} strokeWidth="7" />
        <line x1="113" y1="113" x2="134" y2="134" stroke={C.ink} strokeWidth="9" strokeLinecap="round" />
      </g>
    </Frame>
  );
}

// Step 4: a notepad; a pen writes three lines, one after another (once, when the step opens)
export function WriteArt() {
  const lines = [
    { y: 82, w: 70, delay: 0.2 },
    { y: 104, w: 58, delay: 1.0 },
    { y: 126, w: 64, delay: 1.8 },
  ];
  return (
    <Frame label="A notepad where your brand story is being written">
      <rect x="48" y="40" width="96" height="124" rx="12" fill="#fff" stroke={C.ink} strokeWidth="5" />
      <rect x="70" y="32" width="52" height="16" rx="6" fill={C.purple} />
      <rect x="62" y="60" width="44" height="7" rx="3.5" fill={C.lavender} />
      {lines.map((l) => (
        <line
          key={l.y}
          className="cg-draw"
          x1="62" y1={l.y} x2={62 + l.w} y2={l.y}
          stroke={C.teal} strokeWidth="6" strokeLinecap="round"
          style={{ ["--len" as string]: l.w, animationDelay: `${l.delay}s` }}
        />
      ))}
      <g className="cg-write">
        <rect x="128" y="96" width="12" height="52" rx="4" fill={C.purple} transform="rotate(35 134 122)" />
        <path d="M118 140 l6 12 l5 -9 z" fill={C.ink} />
      </g>
      <Sparkle x={156} y={58} s={9} color={C.lime} delay="0.4s" />
    </Frame>
  );
}

// Step 5: a price tag with slowly twinkling sparkles
const Sparkle = ({ x, y, s, color, delay }: { x: number; y: number; s: number; color: string; delay: string }) => (
  <path
    className="cg-twinkle"
    style={{ animationDelay: delay }}
    d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`}
    fill={color}
  />
);
export function TagArt() {
  return (
    <Frame label="A tag with sparkles for your niche">
      <path d="M58 62 L112 62 L156 106 L110 152 L58 100 Z" fill={C.lavender} stroke={C.purple} strokeWidth="6" strokeLinejoin="round" />
      <circle cx="78" cy="82" r="8" fill="#fff" stroke={C.purple} strokeWidth="5" />
      <rect x="92" y="98" width="34" height="8" rx="4" fill={C.purple} transform="rotate(45 109 102)" />
      <Sparkle x={150} y={50} s={12} color={C.lime} delay="0s" />
      <Sparkle x={46} y={142} s={9} color={C.mint} delay="0.9s" />
      <Sparkle x={160} y={150} s={7} color={C.violet} delay="1.6s" />
    </Frame>
  );
}

// Step 6: a target with people bubbles slowly orbiting, and an arrow that lands
export function TargetArt() {
  const people = [
    { a: 0, color: C.purple },
    { a: 120, color: C.teal },
    { a: 240, color: C.lime },
  ];
  return (
    <Frame label="A target with the creators you want">
      <circle cx="100" cy="100" r="44" fill="#fff" stroke={C.purple} strokeWidth="6" />
      <circle cx="100" cy="100" r="28" fill={C.lavender} stroke={C.purple} strokeWidth="5" />
      <circle cx="100" cy="100" r="11" fill={C.purple} />
      <g className="cg-pop" style={{ animationDelay: "0.5s" }}>
        <line x1="100" y1="100" x2="146" y2="54" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />
        <path d="M146 54 l-2 14 m2 -14 l-14 2" stroke={C.ink} strokeWidth="6" strokeLinecap="round" />
      </g>
      <g className="cg-orbit">
        {people.map((p) => {
          const x = 100 + 76 * Math.cos((p.a * Math.PI) / 180);
          const y = 100 + 76 * Math.sin((p.a * Math.PI) / 180);
          return (
            <g key={p.a} className="cg-counter-orbit">
              <circle cx={x} cy={y} r="15" fill="#fff" stroke={p.color} strokeWidth="4" />
              <circle cx={x} cy={y - 4} r="4.5" fill={C.ink} />
              <path d={`M${x - 8} ${y + 9} a8 7 0 0 1 16 0 z`} fill={C.ink} />
            </g>
          );
        })}
      </g>
    </Frame>
  );
}

// "Your brief is ready": a big tick that draws itself
export function DoneArt() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24" role="img" aria-label="Done">
      <circle cx="60" cy="60" r="52" fill="var(--color-good-bg)" className="cg-pop" />
      <path className="cg-draw" d="M36 62 L53 79 L86 44" fill="none" stroke="var(--color-good)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" style={{ ["--len" as string]: 80, animationDelay: "0.25s" }} />
    </svg>
  );
}

// Light confetti that falls once, then removes itself (hidden when motion is reduced)
const CONFETTI_COLORS = ["#7a5cde", "#129a82", "#b9d930", "#31bda0", "#e5487a"];
export function Confetti() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 3200);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 40 }, (_, i) => {
        const left = (i * 37) % 100; // spread across the screen without randomness
        return (
          <span
            key={i}
            className="cg-confetti-piece"
            style={{
              left: `${left}%`,
              width: i % 3 ? 8 : 6,
              height: i % 3 ? 12 : 6,
              borderRadius: i % 3 ? 2 : 999,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 10) * 70}ms`,
              ["--dx" as string]: `${((i % 7) - 3) * 22}px`,
              ["--spin" as string]: `${360 + (i % 5) * 120}deg`,
            }}
          />
        );
      })}
    </div>
  );
}
