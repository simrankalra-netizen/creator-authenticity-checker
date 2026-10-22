// The Collabgram logo, drawn in code from the brand logo: a magnifier with a
// person inside, three small bars, then "collab" + "gram" in the brand gradient.
import { useId } from "react";

const SIZES = { sm: { icon: 28, text: "text-xl" }, md: { icon: 36, text: "text-2xl" }, lg: { icon: 48, text: "text-4xl" } };

export function LogoIcon({ size = 36 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-logo-violet)" />
          <stop offset="0.55" stopColor="var(--color-brand-mint)" />
          <stop offset="1" stopColor="var(--color-brand-lime)" />
        </linearGradient>
      </defs>
      {/* magnifier ring and handle */}
      <circle cx="19" cy="19" r="14" fill="#fff" stroke={`url(#${id}-ring)`} strokeWidth="5" />
      <line x1="29.5" y1="29.5" x2="36" y2="36" stroke="var(--color-ink)" strokeWidth="5" strokeLinecap="round" />
      {/* person */}
      <circle cx="19" cy="15" r="4.6" fill="var(--color-ink)" />
      <path d="M10.5 27.5c0-4.9 3.8-7.6 8.5-7.6s8.5 2.7 8.5 7.6z" fill="var(--color-ink)" />
      {/* three bars */}
      <rect x="35" y="41" width="3" height="6" rx="1.5" fill="var(--color-logo-violet)" />
      <rect x="40" y="38" width="3" height="9" rx="1.5" fill="var(--color-brand-mint)" />
      <rect x="45" y="34" width="3" height="13" rx="1.5" fill="var(--color-brand-lime)" />
    </svg>
  );
}

export default function Logo({ size = "md", className = "" }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="Collabgram" role="img">
      <LogoIcon size={s.icon} />
      <span className={`font-display font-extrabold tracking-tight ${s.text}`} aria-hidden="true">
        <span className="text-ink">collab</span>
        <span className="brand-gradient-text">gram</span>
      </span>
    </span>
  );
}
