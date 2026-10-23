"use client";

// "Your top 10 creators": the 10 creators best suited to the brand's brief, from demo data
// or real public Instagram data (see lib/creatorSource.ts).
// All scoring is plain code (lib/creatorScores.ts, lib/ranking.ts); no AI, no API key.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motionMs, prefersReducedMotion } from "@/components/motion";
import Logo from "@/components/Logo";
import CreatorDetail from "@/components/CreatorDetail";
import { demoCreators, getCreators, SOURCE_LABEL, SOURCE_NOTE, SourceError, type Creator, type CreatorList, type SourceStage } from "@/lib/creatorSource";
import { GOAL_LABEL, goalFromBrief, type Goal, type Level } from "@/lib/creatorScores";
import { topCreators, type Scored } from "@/lib/ranking";
import { hashtagsFor, searchKey } from "@/lib/searchTerms";
import type { Brief } from "@/lib/brief";
import {
  Avatar, GOAL_ICON, GOAL_TAG, IconAlert, IconCheck, IconInfo, IconStar, LEVEL_STYLE, ScoreDial, TONE_BG, TONE_TEXT, toneFor,
} from "@/components/ui";

export const compact = (n: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export { LEVEL_STYLE };

export const collectedOn = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
// The label every card carries, so demo and real data are never confused
export const sourceLine = (c: Creator) =>
  c.source === "live" && c.collectedAt ? `Live data from Instagram, collected on ${collectedOn(c.collectedAt)}` : "Demo data · not a real person";

const SEARCH_TIMEOUT_MS = 130_000; // the server stops at 110 s; this catches a stuck connection

const STAGE_TEXT: Record<SourceStage, { title: string; detail: (b: Brief) => string }> = {
  finding: { title: "Finding creators", detail: (b) => `Looking at recent public posts under ${hashtagsFor(b).map((h) => `#${h}`).join(", ")}.` },
  checking: { title: "Checking posts", detail: () => "Reading up to 50 public profiles and their latest 12 posts." },
  scoring: { title: "Scoring", detail: () => "Working out authenticity and brand fit from what was collected." },
};

// What the person sees when the live search doesn't work
const ERROR_TEXT: Record<string, string> = {
  no_token: "Live data isn't set up: there's no Apify token on the server.",
  bad_token: "Apify didn't accept the token on the server, so live data couldn't be collected.",
  no_credits: "The Apify account has run out of credits, so live data couldn't be collected.",
  timeout: "Collecting live data took longer than 2 minutes, so it was stopped.",
  empty: "Instagram returned no public creators for this search.",
  failed: "Something went wrong while collecting live data.",
};

export function authBadge(s: Scored) {
  const score = s.auth.status === "scored" ? s.auth.score : null;
  const tone = toneFor(score);
  return { text: score === null ? "Not enough data" : `${score}`, style: `${TONE_BG[tone]} ${TONE_TEXT[tone]}`, tone, score };
}

export default function TopCreators({ brief, onEditBrief, onOpenChecker }: { brief: Brief; onEditBrief: () => void; onOpenChecker: () => void }) {
  const [data, setData] = useState<CreatorList | null>(null);
  const [stage, setStage] = useState<SourceStage | null>(null);
  const [failure, setFailure] = useState<{ reason: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [goal, setGoal] = useState<Goal>(goalFromBrief(brief));
  const [openId, setOpenId] = useState<string | null>(null);

  const [loaderDone, setLoaderDone] = useState(false);
  const key = searchKey(brief);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const stop = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, SEARCH_TIMEOUT_MS);
    setData(null);
    setFailure(null);
    setStage(null);
    getCreators(brief, setStage, controller.signal) // the source is picked in lib/creatorSource.ts
      .then(setData)
      .catch((e) => {
        if (timedOut) setFailure({ reason: "timeout", message: "No reply within 2 minutes" });
        else if (!controller.signal.aborted) setFailure(e instanceof SourceError ? { reason: e.reason, message: e.message } : { reason: "failed", message: String(e) });
      })
      .finally(() => clearTimeout(stop));
    // "Scanning creators…" shows for at least --motion-loader-min so it feels intentional
    setLoaderDone(false);
    const t = setTimeout(() => setLoaderDone(true), motionMs("--motion-loader-min", 1200));
    return () => {
      clearTimeout(t);
      clearTimeout(stop);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the search itself changes
  }, [key, attempt]);

  const creators = data?.creators ?? null;
  const source = data?.source ?? "demo";
  const computed = useMemo(() => (creators ? topCreators(creators, brief, goal) : null), [creators, brief, goal]);
  const list = loaderDone ? computed : null;
  const briefGoal = goalFromBrief(brief);
  const open = list?.top.find((s) => s.creator.id === openId) ?? null;

  // Smooth re-ranking: when the order changes, each card glides from its old spot to its new one
  const cardEls = useRef(new Map<string, HTMLLIElement>());
  const lastRects = useRef(new Map<string, DOMRect>());
  const order = list?.top.map((s) => s.creator.id).join() ?? "";
  useLayoutEffect(() => {
    const rects = new Map<string, DOMRect>();
    cardEls.current.forEach((el, id) => rects.set(id, el.getBoundingClientRect()));
    if (!prefersReducedMotion()) {
      rects.forEach((rect, id) => {
        const old = lastRects.current.get(id);
        const dx = old ? old.left - rect.left : 0;
        const dy = old ? old.top - rect.top : 0;
        if (dx || dy) {
          cardEls.current.get(id)?.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
            duration: motionMs("--motion-rerank", 450),
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          });
        }
      });
    }
    lastRects.current = rects;
  }, [order]);
  const trackCard = (id: string) => (el: HTMLLIElement | null) => {
    if (el) cardEls.current.set(id, el);
    else cardEls.current.delete(id);
  };

  return (
    <div className="min-h-screen w-full">
      <header className="header-band border-b border-line">
        <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-6 text-ink">
          <div className="flex items-center justify-between gap-3">
            <Logo />
            {data && (
              <span className="cg-pill border border-check/20 bg-check-bg text-check" title={SOURCE_NOTE[source]}>
                <IconInfo size={13} /> {SOURCE_LABEL[source]}
              </span>
            )}
          </div>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">Your top 10 creators</h1>
              <p className="mt-2 text-ink-soft">
                For <strong className="text-ink">{brief.brandName || "your brand"}</strong> · {brief.influencerNiche || brief.niche} ·{" "}
                {brief.locationMode === "anywhere" ? "anywhere" : brief.location}
                {brief.budget ? ` · up to ${rupees(Number(brief.budget.replace(/,/g, "")))} per creator` : ""}
              </p>
              {data && (
                <p className="mt-1 text-xs text-ink-muted">
                  {source === "live"
                    ? `${SOURCE_NOTE.live} Collected on ${collectedOn(data.collectedAt!)}${data.cached ? " (saved search, refreshed every 24 hours)" : ""} from ${data.hashtags.map((h) => `#${h}`).join(", ")}.`
                    : `${SOURCE_NOTE.demo} Scores show how the method works.`}
                </p>
              )}
            </div>
            <button type="button" onClick={onEditBrief} className="cg-btn-secondary text-sm">
              Edit brief
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-ink-soft">Rank for</span>
            <div className="inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-line" role="group" aria-label="Rank by goal">
              {(["sales", "reach", "fit"] as Goal[]).map((g) => {
                const Icon = GOAL_ICON[g];
                const active = goal === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGoal(g)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors sm:px-4 ${
                      active ? "brand-gradient text-white shadow" : "text-ink-soft hover:bg-lavender hover:text-ink"
                    }`}
                  >
                    <Icon size={15} />
                    {GOAL_LABEL[g]}
                    {g === briefGoal && <span className={`hidden text-[11px] font-medium sm:inline ${active ? "text-white/85" : "text-ink-muted"}`}>(your goal)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-16 text-ink">
        {list?.note && (
          <p className="cg-rise mt-6 flex gap-2 rounded-2xl border border-brand-lime/40 bg-lime-tint px-4 py-3 text-sm">
            <span className="mt-0.5 text-ink-soft"><IconInfo /></span>
            <span>{list.note}</span>
          </p>
        )}

        {failure ? (
          <div className="cg-card mt-6 p-6 sm:p-8" role="alert">
            <p className="flex items-center gap-2 font-display text-xl font-bold text-bad">
              <IconAlert /> Live creator data isn&apos;t available right now
            </p>
            <p className="mt-2 text-ink-soft">{ERROR_TEXT[failure.reason] ?? ERROR_TEXT.failed}</p>
            <p className="mt-1 text-xs text-ink-muted">Details: {failure.message}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => { setFailure(null); setData(demoCreators()); }} className="cg-btn-primary">
                Continue with demo data
              </button>
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className="cg-btn-secondary">
                Try again
              </button>
            </div>
            <p className="mt-3 text-xs text-ink-muted">Demo creators are made up and every card is labelled &quot;Demo data&quot;.</p>
          </div>
        ) : !list ? (
          <ScanningLoader stage={stage} brief={brief} />
        ) : list.top.length === 0 ? (
          <div className="cg-card mt-6 p-8 text-center">
            <p className="font-display text-xl font-bold">No creators to show yet</p>
            <p className="mt-2 text-ink-soft">Try widening your budget or location in your brief.</p>
            <button type="button" onClick={onEditBrief} className="cg-btn-primary mt-5">Edit brief</button>
          </div>
        ) : (
          <ol className="mt-6 grid gap-5 md:grid-cols-2">
            {list.top.map((s, i) => (
              <CreatorCard key={s.creator.id} liRef={trackCard(s.creator.id)} rank={i + 1} s={s} goal={goal} onOpen={() => setOpenId(s.creator.id)} />
            ))}
          </ol>
        )}

        <div className="cg-card mt-10 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm text-ink-soft">Have your own list of creators? Check them with the same authenticity rules.</p>
          <button type="button" onClick={onOpenChecker} className="cg-btn-secondary text-sm">
            Check your own creator list (CSV)
          </button>
        </div>
      </main>

      {open && <CreatorDetail s={open} goal={goal} brief={brief} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Rating({ goal, label, level }: { goal: Goal; label: string; level: Level }) {
  const Icon = GOAL_ICON[goal];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${LEVEL_STYLE[level]}`}>
      <Icon size={14} />
      {label}: <strong>{level}</strong>
    </span>
  );
}

function CreatorCard({ rank, s, goal, onOpen, liRef }: { rank: number; s: Scored; goal: Goal; onOpen: () => void; liRef: (el: HTMLLIElement | null) => void }) {
  const c = s.creator;
  const auth = authBadge(s);
  const BestIcon = GOAL_ICON[s.ret.bestFor];
  const top = rank === 1;

  const body = (
    <div className={`cg-card cg-card-hover flex h-full flex-col p-5 ${s.warning ? "border-bad/40" : ""} ${top ? "border-transparent" : ""}`}>
      {s.warning && (
        <p className="mb-4 flex gap-2 rounded-xl bg-bad-bg px-3 py-2 text-xs font-medium text-bad">
          <span className="mt-px"><IconAlert size={14} /></span> {s.warning}
        </p>
      )}

      <div className="flex items-start gap-3">
        <Avatar handle={c.handle} niche={c.niche} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-ink-muted">#{rank}</span>
            {top && (
              <span className="cg-pill brand-gradient text-white">
                <IconStar size={12} /> Top pick
              </span>
            )}
          </div>
          <p className="truncate font-display text-lg font-bold">@{c.handle}</p>
          <p className="text-sm text-ink-soft">
            {c.subNiche} ({c.niche}){c.city ? ` · ${c.city}` : ""}
          </p>
          <p className="text-sm text-ink-soft">
            <strong className="text-ink">{compact(c.followers)}</strong> followers · {c.platform}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">{sourceLine(c)}</p>
        </div>
        <span className={`cg-pill shrink-0 ${GOAL_TAG[s.ret.bestFor]} ${s.ret.bestFor === goal ? "ring-2 ring-current/30" : ""}`} title="What this creator is strongest at">
          <BestIcon size={13} /> Best for {GOAL_LABEL[s.ret.bestFor]}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-page p-3">
        <ScoreDial value={s.fit.score} label="Brand Fit" tone="good" gradient>
          <p className="text-xs text-ink-soft">out of 100</p>
        </ScoreDial>
        <ScoreDial value={auth.score} label="Authenticity" tone={auth.tone}>
          <p className={`text-xs font-semibold ${TONE_TEXT[auth.tone]}`}>
            {s.auth.status === "scored" ? `${s.auth.confidence} confidence` : "Not enough data"}
          </p>
        </ScoreDial>
      </div>

      <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
        {s.auth.status === "scored" ? (
          s.auth.reasons.map((r) => (
            <li key={r.text} className="flex gap-2">
              <span className={`mt-0.5 shrink-0 ${r.direction === "good" ? "text-good" : "text-bad"}`}>
                {r.direction === "good" ? <IconCheck size={15} /> : <IconAlert size={15} />}
              </span>
              <span>{r.text}</span>
            </li>
          ))
        ) : (
          <li className="flex gap-2">
            <span className="mt-0.5 shrink-0 text-none"><IconInfo size={15} /></span>
            <span>{s.auth.why}. Not scored, so this creator isn&apos;t flagged.</span>
          </li>
        )}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <Rating goal="sales" label="Sales" level={s.ret.sales.level} />
        <Rating goal="reach" label="Reach" level={s.ret.reach.level} />
        <Rating goal="fit" label="Brand fit" level={s.ret.fit.level} />
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">
        Sales: {s.creator.pastCampaigns.length ? "based on past sales" : "estimated from engagement and audience match"}
      </p>

      <p className="mt-4 text-sm">
        {s.cost.ratePerPost === null ? (
          <span className="text-ink-soft">Rate per post: Not available (creators don&apos;t publish it)</span>
        ) : (
          <>
            <strong className="font-display text-base">{rupees(s.cost.ratePerPost)}</strong> <span className="text-ink-soft">per post</span>
            {s.cost.perEngaged !== null && <span className="text-ink-soft"> · about {rupees(s.cost.perEngaged)} per engaged follower</span>}
          </>
        )}
      </p>

      {s.flags.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl border border-bad/15 bg-bad-bg px-3 py-2 text-xs text-bad">
          {s.flags.map((f) => (
            <li key={f} className="flex gap-1.5"><span className="mt-px shrink-0"><IconAlert size={13} /></span>{f}</li>
          ))}
        </ul>
      )}

      <p className="mt-4 rounded-xl bg-lavender/60 px-3 py-2 text-sm">
        <span className="font-semibold text-fit">Why we picked them:</span> {s.why}
      </p>

      <button type="button" onClick={onOpen} className="cg-link mt-auto self-start pt-4 text-sm">
        See every signal →
      </button>
    </div>
  );

  return (
    <li ref={liRef} className="cg-rise" style={{ animationDelay: `calc(var(--motion-stagger) * ${Math.min(rank - 1, 9)})` }}>
      {top ? <div className="brand-gradient h-full rounded-[22px] p-[2px]">{body}</div> : body}
    </li>
  );
}

// "Scanning creators…": a light line sweeps over placeholder cards while the list is prepared.
// For live data it names the real step the server is on.
function ScanningLoader({ stage, brief }: { stage: SourceStage | null; brief: Brief }) {
  const steps: SourceStage[] = ["finding", "checking", "scoring"];
  return (
    <div className="mt-6" role="status" aria-live="polite">
      {stage && (
        <ol className="mb-3 flex flex-wrap gap-2 text-xs">
          {steps.map((s, i) => {
            const now = steps.indexOf(stage);
            return (
              <li key={s} className={`cg-pill ${i < now ? "bg-good-bg text-good" : i === now ? "bg-lavender text-fit" : "bg-white text-ink-muted ring-1 ring-line"}`}>
                {i < now ? <IconCheck size={12} /> : null} {STAGE_TEXT[s].title}
              </li>
            );
          })}
        </ol>
      )}
      <p className="flex items-center gap-2 font-display text-lg font-bold">
        {stage ? STAGE_TEXT[stage].title : "Scanning creators"}
        <span aria-hidden className="inline-flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="cg-dot inline-block h-1.5 w-1.5 rounded-full bg-brand-purple" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </span>
      </p>
      <p className="text-sm text-ink-soft">
        {stage ? `${STAGE_TEXT[stage].detail(brief)} This can take up to 2 minutes.` : "Checking engagement, comments and growth."}
      </p>
      <div className="relative mt-4 overflow-hidden rounded-[22px]">
        <ul className="grid gap-5 md:grid-cols-2" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className={`cg-card p-5 ${i > 1 ? "hidden md:block" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="cg-skeleton h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2"><div className="cg-skeleton h-4 w-1/2" /><div className="cg-skeleton h-3 w-3/4" /></div>
              </div>
              <div className="cg-skeleton mt-5 h-16" />
              <div className="cg-skeleton mt-3 h-8" />
            </li>
          ))}
        </ul>
        <div aria-hidden className="cg-scan pointer-events-none absolute inset-x-0 top-0 h-10">
          <div className="h-full w-full bg-gradient-to-b from-transparent via-logo-violet/15 to-transparent" />
          <div className="brand-gradient h-0.5 w-full opacity-70" />
        </div>
      </div>
    </div>
  );
}
