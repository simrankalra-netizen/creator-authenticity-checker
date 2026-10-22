// Small shared pieces for the creator screens: icons, score dial, avatar, colour helpers.
// Colours come from the theme in app/globals.css.
import { useId, type ReactNode } from "react";
import type { Goal, Level } from "@/lib/creatorScores";
import { useCountUp } from "@/components/motion";

// ---------- Icons (inline, no icon library) ----------
const Svg = ({ children, size = 16 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
export const IconSales = (p: { size?: number }) => <Svg {...p}><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" /></Svg>;
export const IconReach = (p: { size?: number }) => <Svg {...p}><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></Svg>;
export const IconFit = (p: { size?: number }) => <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></Svg>;
export const IconAlert = (p: { size?: number }) => <Svg {...p}><path d="M12 3 2.5 20h19z" /><path d="M12 10v4" /><path d="M12 17h.01" /></Svg>;
export const IconCheck = (p: { size?: number }) => <Svg {...p}><path d="m5 12 4.5 4.5L19 7" /></Svg>;
export const IconInfo = (p: { size?: number }) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></Svg>;
export const IconRupee = (p: { size?: number }) => <Svg {...p}><path d="M6 4h12M6 9h12M9 4c4.5 0 6 2.2 6 5s-2.5 5-7 5l7 6" /></Svg>;
export const IconStar = (p: { size?: number }) => <Svg {...p}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></Svg>;

export const GOAL_ICON: Record<Goal, (p: { size?: number }) => ReactNode> = { sales: IconSales, reach: IconReach, fit: IconFit };

// "Best for" tag colours: one per goal
export const GOAL_TAG: Record<Goal, string> = {
  sales: "bg-sales-bg text-sales",
  reach: "bg-reach-bg text-reach",
  fit: "bg-fit-bg text-fit",
};

// Expected-return ratings: green strong, amber medium, grey low
export const LEVEL_STYLE: Record<Level, string> = {
  High: "bg-good-bg text-good",
  Medium: "bg-check-bg text-check",
  Low: "bg-none-bg text-none",
};

// Score tone: green 70+, amber 50–69, red under 50, grey when there's no score
export type Tone = "good" | "check" | "bad" | "none";
export const toneFor = (score: number | null): Tone => (score === null ? "none" : score >= 70 ? "good" : score >= 50 ? "check" : "bad");
export const TONE_TEXT: Record<Tone, string> = { good: "text-good", check: "text-check", bad: "text-bad", none: "text-none" };
export const TONE_BG: Record<Tone, string> = { good: "bg-good-bg", check: "bg-check-bg", bad: "bg-bad-bg", none: "bg-none-bg" };
const TONE_STROKE: Record<Tone, string> = { good: "var(--color-good)", check: "#d97706", bad: "var(--color-bad)", none: "#a1a1aa" };

// ---------- Circular score dial ----------
export function ScoreDial({ value, label, tone, gradient = false, size = 64, children }: {
  value: number | null; label: string; tone: Tone; gradient?: boolean; size?: number; children?: ReactNode;
}) {
  const r = 26, c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const id = useId();
  const shown = useCountUp(value); // the number counts up while the ring fills
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`${label}: ${value === null ? "not enough data" : `${value} out of 100`}`}>
        {gradient && (
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--color-logo-violet)" />
              <stop offset="1" stopColor="var(--color-logo-teal)" />
            </linearGradient>
          </defs>
        )}
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-line)" strokeWidth="6" />
        {value !== null && (
          <circle
            className="cg-dial"
            cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
            stroke={gradient ? `url(#${id})` : TONE_STROKE[tone]}
            strokeDasharray={`${(pct / 100) * c} ${c}`}
            transform="rotate(-90 32 32)"
          />
        )}
        <text x="32" y="37" textAnchor="middle" className="font-display" fontSize={value === null ? 12 : 17} fontWeight="800" fill="var(--color-ink)">
          {value === null ? "N/A" : shown}
        </text>
      </svg>
      <div className="leading-tight">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        {children}
      </div>
    </div>
  );
}

// ---------- Avatar: initials on a niche colour (demo data has no photos) ----------
const NICHE_AVATAR: Record<string, string> = {
  Beauty: "bg-sales-bg text-sales",
  Fashion: "bg-fit-bg text-fit",
  Food: "bg-check-bg text-check",
  Fitness: "bg-reach-bg text-reach",
  Tech: "bg-tech-bg text-tech",
  Home: "bg-lime-tint text-ink",
};
export function Avatar({ handle, niche, size = 48 }: { handle: string; niche: string; size?: number }) {
  const parts = handle.replace(/\.demo$/, "").split(/[_.\d]+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold ${NICHE_AVATAR[niche] ?? "bg-none-bg text-none"}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

// ---------- Meter bar (detail view) ----------
export function Meter({ value, max = 100, tone = "brand" }: { value: number; max?: number; tone?: Tone | "brand" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill = tone === "brand" ? "brand-gradient" : { good: "bg-good", check: "bg-amber-500", bad: "bg-bad", none: "bg-zinc-400" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden>
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
