"use client";

// "Your top 10 creators": the 10 demo creators best suited to the brand's brief.
// All scoring is plain code (lib/creatorScores.ts, lib/ranking.ts); no AI, no API key.
import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import CreatorDetail from "@/components/CreatorDetail";
import { getCreators, SOURCE_LABEL, SOURCE_NOTE, type Creator } from "@/lib/creatorSource";
import { GOAL_LABEL, goalFromBrief, type Goal, type Level } from "@/lib/creatorScores";
import { topCreators, type Scored } from "@/lib/ranking";
import type { Brief } from "@/lib/brief";

export const compact = (n: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const LEVEL_STYLE: Record<Level, string> = {
  High: "bg-mint-tint text-brand-teal",
  Medium: "bg-lavender text-brand-purple",
  Low: "bg-zinc-100 text-ink-soft",
};

export function authBadge(s: Scored) {
  if (s.auth.status !== "scored") return { text: "Not enough data", style: "bg-zinc-100 text-ink-soft" };
  const style = s.auth.score >= 70 ? "bg-mint-tint text-brand-teal" : s.auth.score >= 50 ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800";
  return { text: `${s.auth.score}`, style };
}

export default function TopCreators({ brief, onEditBrief, onOpenChecker }: { brief: Brief; onEditBrief: () => void; onOpenChecker: () => void }) {
  const [creators, setCreators] = useState<Creator[] | null>(null);
  const [goal, setGoal] = useState<Goal>(goalFromBrief(brief));
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    getCreators().then(setCreators); // the data source can be swapped in lib/creatorSource.ts
  }, []);

  const list = useMemo(() => (creators ? topCreators(creators, brief, goal) : null), [creators, brief, goal]);
  const briefGoal = goalFromBrief(brief);
  const open = list?.top.find((s) => s.creator.id === openId) ?? null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 text-ink">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Logo className="h-9 w-auto" />
          <h1 className="mt-4 text-2xl font-semibold">Your top 10 creators</h1>
          <p className="text-sm text-ink-soft">
            For {brief.brandName || "your brand"} · {brief.influencerNiche || brief.niche} ·{" "}
            {brief.locationMode === "anywhere" ? "anywhere" : brief.location}
            {brief.budget ? ` · up to ${rupees(Number(brief.budget.replace(/,/g, "")))} per creator` : ""}
          </p>
        </div>
        <button type="button" onClick={onEditBrief} className="text-sm text-ink-soft underline">
          Edit brief
        </button>
      </header>

      <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <strong>{SOURCE_LABEL}:</strong> {SOURCE_NOTE} Scores show how the method works.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Rank by goal">
        <span className="text-sm font-medium">Rank for:</span>
        {(["sales", "reach", "fit"] as Goal[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGoal(g)}
            aria-pressed={goal === g}
            className={`rounded-full border px-3 py-1 text-sm ${goal === g ? "border-brand-purple bg-lavender font-medium" : "border-zinc-300"}`}
          >
            {GOAL_LABEL[g]}
            {g === briefGoal && <span className="ml-1 text-xs text-ink-soft">(your goal)</span>}
          </button>
        ))}
      </div>

      {list?.note && <p className="mt-4 rounded-lg bg-lime-tint px-3 py-2 text-sm">{list.note}</p>}

      {!list ? (
        <p className="mt-6 text-sm text-ink-soft">Loading creators…</p>
      ) : (
        <ol className="mt-5 grid gap-4 md:grid-cols-2">
          {list.top.map((s, i) => (
            <CreatorCard key={s.creator.id} rank={i + 1} s={s} goal={goal} onOpen={() => setOpenId(s.creator.id)} />
          ))}
        </ol>
      )}

      <p className="mt-8 text-sm text-ink-soft">
        Have your own list of creators?{" "}
        <button type="button" onClick={onOpenChecker} className="underline">
          Check your own creator list (CSV)
        </button>
      </p>

      {open && <CreatorDetail s={open} goal={goal} brief={brief} onClose={() => setOpenId(null)} />}
    </main>
  );
}

function Rating({ label, level }: { label: string; level: Level }) {
  return (
    <span className={`rounded-md px-2 py-1 text-xs ${LEVEL_STYLE[level]}`}>
      {label}: <strong>{level}</strong>
    </span>
  );
}

function CreatorCard({ rank, s, goal, onOpen }: { rank: number; s: Scored; goal: Goal; onOpen: () => void }) {
  const c = s.creator;
  const auth = authBadge(s);
  return (
    <li className={`flex flex-col rounded-xl border p-4 ${s.warning ? "border-red-300" : "border-zinc-200"}`}>
      {s.warning && <p className="mb-3 rounded-md bg-red-50 px-2 py-1 text-xs text-red-800">⚠ {s.warning}</p>}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-ink-soft">#{rank}</p>
          <p className="font-semibold">@{c.handle}</p>
          <p className="text-sm text-ink-soft">
            {c.subNiche} ({c.niche}) · {c.city} · {compact(c.followers)} followers · {c.platform}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.ret.bestFor === goal ? "brand-gradient text-white" : "bg-zinc-100 text-ink-soft"}`}
          title="What this creator is strongest at"
        >
          Best for {GOAL_LABEL[s.ret.bestFor]}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-ink-soft">Brand Fit</p>
          <p className="text-lg font-semibold">{s.fit.score}<span className="text-xs font-normal text-ink-soft">/100</span></p>
          <div className="mt-1 h-1.5 rounded-full bg-zinc-200" aria-hidden>
            <div className="brand-gradient h-1.5 rounded-full" style={{ width: `${s.fit.score}%` }} />
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-soft">Authenticity</p>
          <p>
            <span className={`rounded-md px-2 py-0.5 text-sm font-semibold ${auth.style}`}>{auth.text}</span>
            {s.auth.status === "scored" && <span className="ml-1 text-xs text-ink-soft">{s.auth.confidence} confidence</span>}
          </p>
        </div>
      </div>

      <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
        {s.auth.status === "scored"
          ? s.auth.reasons.map((r) => (
              <li key={r.text}>
                <span className={r.direction === "good" ? "text-brand-teal" : "text-amber-700"}>{r.direction === "good" ? "✓" : "⚠"}</span> {r.text}
              </li>
            ))
          : <li>{s.auth.why}. Not scored, so this creator isn&apos;t flagged.</li>}
      </ul>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Rating label="Sales" level={s.ret.sales.level} />
        <Rating label="Reach" level={s.ret.reach.level} />
        <Rating label="Brand fit" level={s.ret.fit.level} />
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">
        Sales: {s.creator.pastCampaigns.length ? "based on past sales" : "estimated from engagement and audience match"}
      </p>

      <p className="mt-3 text-sm">
        <strong>{rupees(s.cost.ratePerPost)}</strong> per post
        {s.cost.perEngaged !== null && <span className="text-ink-soft"> · about {rupees(s.cost.perEngaged)} per engaged follower</span>}
      </p>

      {s.flags.length > 0 && (
        <ul className="mt-2 space-y-0.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          {s.flags.map((f) => (
            <li key={f}>⚠ {f}</li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-sm"><span className="font-medium">Why we picked them:</span> {s.why}</p>

      <button type="button" onClick={onOpen} className="mt-auto self-start pt-3 text-sm font-medium text-brand-purple underline">
        See every signal
      </button>
    </li>
  );
}
