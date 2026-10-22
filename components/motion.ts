"use client";

// Small helpers so code-driven motion follows the same settings as the CSS
// (the motion settings in app/globals.css) and the device's "reduce motion" setting.
import { useEffect, useState } from "react";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Reads a duration like "--motion-dial: 800ms" from the theme
export function motionMs(name: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? (raw.endsWith("ms") ? n : n * 1000) : fallback;
}

// Counts a number up from 0 (shows the final value at once when motion is reduced)
export function useCountUp(target: number | null) {
  const [shown, setShown] = useState(() => (target === null || prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (target === null || prefersReducedMotion()) return;
    const duration = motionMs("--motion-dial", 800);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return target === null ? null : shown;
}
