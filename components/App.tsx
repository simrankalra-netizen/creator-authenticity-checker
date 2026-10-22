"use client";

// The app: opens on the onboarding questions; once the brief is ready, shows the
// existing creator authenticity screen with the brief above it as context.
import { useState } from "react";
import Onboarding, { briefRows } from "@/components/Onboarding";
import CreatorChecker from "@/components/CreatorChecker";
import { loadBrief, saveBrief, type Brief } from "@/lib/brief";

export default function App() {
  // Runs in the browser only (see app/page.tsx), so saved answers can load at once
  const [brief, setBriefState] = useState<Brief>(loadBrief);

  const setBrief = (b: Brief) => {
    setBriefState(b);
    saveBrief(b);
    window.scrollTo(0, 0);
  };

  if (brief.step <= 7) return <Onboarding brief={brief} setBrief={setBrief} />;

  return (
    <>
      <BriefPanel brief={brief} onEdit={() => setBrief({ ...brief, step: 7 })} />
      <CreatorChecker />
    </>
  );
}

// Your brief, shown as context. It doesn't change any scores.
function BriefPanel({ brief, onEdit }: { brief: Brief; onEdit: () => void }) {
  const shown = briefRows(brief).filter(([label]) =>
    ["Brand", "Influencer niche", "Location", "Main goal", "Follower range", "Budget per creator", "Platform"].includes(label),
  );
  return (
    <section className="mx-auto mt-6 w-full max-w-6xl px-4 text-ink">
      <div className="rounded-lg border border-brand-mint/40 bg-mint-tint p-4 text-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Your brief</p>
          <button type="button" onClick={onEdit} className="text-xs text-ink-soft underline">
            View or edit
          </button>
        </div>
        <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map(([label, value]) => (
            <div key={label}>
              <dt className="inline text-ink-soft">{label}: </dt>
              <dd className="inline">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-soft">Shown as context. Your CSV has no niche, location or platform columns, so creators aren&apos;t filtered by these yet.</p>
      </div>
    </section>
  );
}
