"use client";

// The first screen: an animated welcome. Pure CSS and SVG, nothing to download,
// and "Get started" works straight away whether or not the animations run.
import { useEffect } from "react";
import Logo from "@/components/Logo";

// Made-up creator bubbles drifting in the background (decoration only)
const FLOATERS = [
  { initials: "TG", handle: "@tara_glows", score: 92, tone: "bg-sales-bg text-sales", pos: "left-[4%] top-[14%]", delay: "0s", tilt: "-3deg" },
  { initials: "KF", handle: "@kabir_fits", score: 88, tone: "bg-reach-bg text-reach", pos: "right-[6%] top-[10%]", delay: "-4s", tilt: "2deg" },
  { initials: "MS", handle: "@meera_style", score: 95, tone: "bg-fit-bg text-fit", pos: "left-[8%] bottom-[14%]", delay: "-8s", tilt: "2deg" },
  { initials: "AE", handle: "@aisha_eats", score: 81, tone: "bg-check-bg text-check", pos: "right-[5%] bottom-[18%]", delay: "-12s", tilt: "-2deg" },
  { initials: "RT", handle: "@rohan_tech", score: 90, tone: "bg-tech-bg text-tech", pos: "left-[42%] top-[4%] hidden lg:flex", delay: "-6s", tilt: "-1deg" },
];

export default function Welcome({ onStart }: { onStart: () => void }) {
  // Enter also starts, so nobody has to wait for anything
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Enter" && onStart();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);

  const line = (i: number) => ({ animationDelay: `calc(var(--motion-line-stagger) * ${i})` });

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden text-ink">
      {/* Moving background: shifting gradient + three soft glowing blobs */}
      <div aria-hidden className="cg-gradient-shift absolute inset-0" style={{ backgroundImage: "linear-gradient(120deg, #efe9ff, #e3f6ef, #f6f9e1, #ece6ff)" }} />
      <div aria-hidden className="cg-drift absolute -left-24 -top-24 h-80 w-80 rounded-full bg-logo-violet/30 blur-3xl" />
      <div aria-hidden className="cg-drift absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-brand-mint/25 blur-3xl" style={{ animationDelay: "-7s" }} />
      <div aria-hidden className="cg-drift absolute -bottom-28 left-1/4 h-80 w-80 rounded-full bg-brand-lime/25 blur-3xl" style={{ animationDelay: "-13s" }} />

      {/* Floating creator cards */}
      {FLOATERS.map((f) => (
        <div
          key={f.handle}
          aria-hidden
          className={`cg-float absolute flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 shadow-lg ring-1 ring-white backdrop-blur ${f.pos} max-sm:scale-75 max-sm:opacity-70`}
          style={{ animationDelay: f.delay, ["--tilt" as string]: f.tilt }}
        >
          <span className={`flex h-8 w-8 items-center justify-center rounded-full font-display text-xs font-bold ${f.tone}`}>{f.initials}</span>
          <span className="text-left">
            <span className="block text-xs font-semibold">{f.handle}</span>
            <span className="block text-[11px] text-good">✓ {f.score} authentic</span>
          </span>
        </div>
      ))}

      {/* Foreground: logo, tagline, button — each line fades and rises in turn */}
      <div className="relative z-10 mx-4 max-w-xl text-center">
        <div className="cg-rise flex justify-center" style={line(0)}>
          <Logo size="lg" />
        </div>
        <h1 className="cg-rise mt-8 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl" style={line(1)}>
          Find creators your
          <br />
          <span className="brand-gradient-text">brand can trust.</span>
        </h1>
        <p className="cg-rise mx-auto mt-5 max-w-md text-lg text-ink-soft" style={line(2)}>
          Spot fake followers, check credibility, and get a top 10 matched to your brief in minutes.
        </p>
        <div className="cg-rise mt-8" style={line(3)}>
          <button type="button" onClick={onStart} className="cg-btn-primary cg-glow px-8 py-4 text-lg" autoFocus>
            Get started <span aria-hidden>→</span>
          </button>
          <p className="mt-3 text-xs text-ink-muted">Takes about 2 minutes · Demo mode, no real SMS sent</p>
        </div>
      </div>
    </main>
  );
}
