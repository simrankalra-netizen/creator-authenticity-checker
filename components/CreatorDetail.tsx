"use client";

// The detail view for one creator: every signal behind their scores.
import { useEffect, type ReactNode } from "react";
import { GOAL_LABEL, type Goal } from "@/lib/creatorScores";
import { GOAL_WEIGHTS, type Scored } from "@/lib/ranking";
import type { Brief } from "@/lib/brief";
import { authBadge, compact, rupees, sourceLine } from "@/components/TopCreators";
import {
  Avatar, GOAL_ICON, IconAlert, IconCheck, IconInfo, LEVEL_STYLE, Meter, ScoreDial, TONE_TEXT, toneFor,
} from "@/components/ui";

export default function CreatorDetail({ s, goal, brief, onClose }: { s: Scored; goal: Goal; brief: Brief; onClose: () => void }) {
  const c = s.creator;
  const live = c.live;
  const w = GOAL_WEIGHTS[goal];
  const auth = authBadge(s);
  const authScore = s.auth.status === "scored" ? s.auth.score : 50;
  const er = c.followers ? ((c.avgLikes + c.avgComments) / c.followers) * 100 : 0;
  const commentsPer100 = c.avgLikes ? (c.avgComments / c.avgLikes) * 100 : 0;
  const fakeComments = c.commentSample.checked ? ((c.commentSample.generic + c.commentSample.repeated) / c.commentSample.checked) * 100 : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-ink/40 backdrop-blur-[2px] sm:items-stretch" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Details for @${c.handle}`}
        onClick={(e) => e.stopPropagation()}
        className="cg-sheet h-[92vh] w-full overflow-y-auto rounded-t-[24px] bg-page text-ink shadow-2xl sm:h-full sm:max-w-xl sm:rounded-none"
      >
        <div className="header-band sticky top-0 z-10 border-b border-line px-5 pb-4 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15 sm:hidden" aria-hidden />
          <div className="flex items-start gap-3">
            <Avatar handle={c.handle} niche={c.niche} size={52} />
            <div className="min-w-0 flex-1">
              <span className="cg-pill border border-check/20 bg-check-bg text-check">{sourceLine(c)}</span>
              <h2 className="mt-1 truncate text-2xl font-extrabold">@{c.handle}</h2>
              <p className="text-sm text-ink-soft">
                {c.subNiche} ({c.niche}){c.city ? ` · ${c.city}${c.state ? `, ${c.state}` : ""}` : ""} · {c.platform}
              </p>
              {live && (
                <a href={live.profileUrl} target="_blank" rel="noopener noreferrer" className="cg-link text-sm">
                  Open the live profile on Instagram ↗
                </a>
              )}
            </div>
            <button type="button" onClick={onClose} className="cg-btn-secondary shrink-0 text-sm">
              Close
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {s.warning && (
            <p className="flex gap-2 rounded-xl bg-bad-bg px-3 py-2 text-sm font-medium text-bad">
              <span className="mt-0.5"><IconAlert /></span> {s.warning}
            </p>
          )}

          <Section title="Ranking score" aside={<span className="font-display text-2xl font-extrabold">{s.combined}<span className="text-sm font-semibold text-ink-muted">/100</span></span>}>
            <p className="text-sm text-ink-soft">Ranked for <strong className="text-ink">{GOAL_LABEL[goal]}</strong>. How the score is made:</p>
            <div className="mt-3 space-y-2.5">
              <Signal label={`Sales potential × ${Math.round(w.sales * 100)}%`} value={`${s.ret.sales.score}`}><Meter value={s.ret.sales.score} /></Signal>
              <Signal label={`Reach × ${Math.round(w.reach * 100)}%`} value={`${s.ret.reach.score}`}><Meter value={s.ret.reach.score} /></Signal>
              <Signal label={`Brand Fit × ${Math.round(w.fit * 100)}%`} value={`${s.fit.score}`}><Meter value={s.fit.score} /></Signal>
              <Signal
                label={`Authenticity × ${Math.round(w.auth * 100)}%`}
                value={s.auth.status === "scored" ? `${authScore}` : "50 (neutral)"}
                note={s.auth.status === "scored" ? undefined : "Not enough data, so counted as a neutral 50."}
              >
                <Meter value={authScore} tone={s.auth.status === "scored" ? toneFor(authScore) : "none"} />
              </Signal>
            </div>
          </Section>

          <Section title="Brand Fit" aside={<ScoreDial value={s.fit.score} label="" tone="good" gradient size={52} />}>
            <div className="space-y-3">
              {s.fit.parts.map((p) => (
                <Signal key={p.label} label={p.label} value={p.counted ? `${p.points}/${p.max}` : "Not counted"} note={p.note}>
                  {p.counted ? <Meter value={p.points} max={p.max} /> : <Meter value={0} tone="none" />}
                </Signal>
              ))}
            </div>
            {s.fit.parts[0].counted && s.fit.parts[0].points === 0 && (
              <p className="mt-3 text-xs text-ink-muted">Outside your niche, so Brand Fit is capped at 35.</p>
            )}
          </Section>

          <Section title="Authenticity" aside={<ScoreDial value={auth.score} label="" tone={auth.tone} size={52} />}>
            <p className={`text-sm font-semibold ${TONE_TEXT[auth.tone]}`}>
              {s.auth.status === "scored" ? `${s.auth.confidence} confidence` : "Not enough data"}
            </p>
            {s.auth.status === "scored" ? (
              <ul className="mt-2 space-y-2 text-sm">
                {s.auth.reasons.map((r) => (
                  <li key={r.text} className="flex gap-2">
                    <span className={`mt-0.5 shrink-0 ${r.direction === "good" ? "text-good" : "text-bad"}`}>
                      {r.direction === "good" ? <IconCheck size={15} /> : <IconAlert size={15} />}
                    </span>
                    <span>
                      {r.text}
                      <span className="block text-xs text-ink-muted">{r.evidence}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">{s.auth.why}. We don&apos;t guess, so this creator isn&apos;t scored or flagged.</p>
            )}

            <div className="mt-4 space-y-3">
              <Signal label="Engagement rate" value={c.followers ? `${er.toFixed(2)}%` : "—"} note="Likes and comments per post, as a share of followers">
                <Meter value={Math.min(er, 12)} max={12} />
              </Signal>
              <Signal label="Comments per 100 likes" value={c.avgLikes ? commentsPer100.toFixed(1) : "—"} note="Real audiences tend to talk back, not just like">
                <Meter value={Math.min(commentsPer100, 10)} max={10} />
              </Signal>
              <Signal
                label="Generic or repeated comments"
                value={c.commentSample.checked ? `${c.commentSample.generic + c.commentSample.repeated} of ${c.commentSample.checked}` : "Not available"}
                note={
                  c.commentSample.checked || !live
                    ? "Like “nice 🔥”, emoji-only or repeated; over 40% is a warning sign"
                    : "Comments weren't collected for this search (to save Apify credits), so this isn't counted"
                }
              >
                <Meter value={fakeComments} tone={fakeComments > 40 ? "bad" : fakeComments > 25 ? "check" : "good"} />
              </Signal>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Fact label="Followers" value={c.followers.toLocaleString("en-IN")} />
              <Fact label="Avg likes / comments" value={`${c.avgLikes.toLocaleString("en-IN")} / ${c.avgComments.toLocaleString("en-IN")}`} />
              <Fact label={live ? "Days covered by recent posts" : "Days of data"} value={`${c.daysOfData}`} />
            </dl>
            {live && (
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Fact label="Following" value={live.following.toLocaleString("en-IN")} />
                <Fact label="Total posts" value={live.postsCount.toLocaleString("en-IN")} />
                <Fact label="Verified" value={live.verified ? "Yes" : "No"} />
                <Fact label="Recent posts checked" value={`${live.postsChecked}`} note={live.hiddenLikePosts ? `${live.hiddenLikePosts} more have likes hidden` : "Pinned and under-a-day-old posts left out"} />
                <Fact label="Last post" value={live.lastPostDaysAgo === null ? "Not available" : live.lastPostDaysAgo === 0 ? "Today" : `${live.lastPostDaysAgo} days ago`} />
                <Fact label="Account age" value="Not available" note="Join date isn't in the public data we collect" />
              </dl>
            )}
            <Growth history={c.followerHistory} />
          </Section>

          <Section title="Expected return">
            <ul className="space-y-2.5 text-sm">
              {([
                ["sales", "Sales", s.ret.sales.level, `${s.ret.sales.basis}.`],
                ["reach", "Reach", s.ret.reach.level, `About ${compact(s.ret.reach.genuineFollowers)} genuine followers (followers × authenticity${s.auth.status === "scored" ? "" : ", counted at 50% as there's not enough data"}).`],
                ["fit", "Brand fit", s.ret.fit.level, `From the Brand Fit score (${s.fit.score}).`],
              ] as const).map(([g, label, level, text]) => {
                const Icon = GOAL_ICON[g];
                return (
                  <li key={g} className="flex flex-wrap items-start gap-2">
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs ${LEVEL_STYLE[level]}`}>
                      <Icon size={14} /> {label}: <strong>{level}</strong>
                    </span>
                    <span className="min-w-0 flex-1 text-ink-soft">{text}</span>
                  </li>
                );
              })}
            </ul>
            {c.pastCampaigns.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-page text-left text-xs text-ink-muted">
                    <tr><th className="px-3 py-2 font-medium">Past campaign</th><th className="px-3 py-2 font-medium">Orders</th><th className="px-3 py-2 font-medium">Tracked by</th></tr>
                  </thead>
                  <tbody>
                    {c.pastCampaigns.map((p, i) => (
                      <tr key={i} className="border-t border-line"><td className="px-3 py-2">{p.brand} (demo)</td><td className="px-3 py-2 font-semibold">{p.orders.toLocaleString("en-IN")}</td><td className="px-3 py-2">{p.method}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Audience">
            {c.audienceAge ? (
              <div className="space-y-2 text-sm">
                {Object.entries(c.audienceAge).map(([band, pct]) => (
                  <div key={band} className="flex items-center gap-3">
                    <span className={`w-14 shrink-0 ${band === brief.targetAge ? "font-bold text-fit" : "text-ink-soft"}`}>
                      {band.replace("-", "–")}
                    </span>
                    <div className="flex-1"><Meter value={pct} tone={band === brief.targetAge ? "brand" : "none"} /></div>
                    <span className="w-10 shrink-0 text-right font-medium">{pct}%</span>
                  </div>
                ))}
                {brief.targetAge && <p className="text-xs text-ink-muted">Highlighted: your customers&apos; age.</p>}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">
                Audience age: Not available{live ? ". Instagram only shows this to the creator, so it isn't guessed or counted." : "."}
              </p>
            )}
            <p className="mt-3 text-xs font-medium text-ink-muted">Top audience cities</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {c.audienceTopCities ? (
                c.audienceTopCities.map((x) => (
                  <span key={x.city} className="rounded-full bg-white px-2.5 py-1 text-xs ring-1 ring-line">
                    {x.city} <strong>{x.pct}%</strong>
                  </span>
                ))
              ) : (
                <span className="text-sm text-ink-soft">Not available</span>
              )}
            </div>
          </Section>

          <Section title="Cost and activity">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Fact label="Typical rate" value={c.ratePerPost === null ? "Not available" : `${rupees(c.ratePerPost)} per post`} note={c.ratePerPost === null ? "Creators don't publish rates; ask them" : undefined} />
              <Fact
                label="Cost per engaged follower"
                value={s.cost.perEngaged !== null ? `${rupees(s.cost.perEngaged)}` : c.ratePerPost === null ? "Not available" : "No engagement recorded"}
                note={s.cost.perEngaged !== null ? "Rate ÷ likes and comments per post" : undefined}
              />
              <Fact label="Posts per month" value={`${c.postsPerMonth}`} note={live ? "From the dates of their latest posts" : undefined} />
              <Fact label="Past brand collaborations" value={live ? "Not available" : c.pastBrands.length ? `${c.pastBrands.join(", ")} (demo)` : "None listed"} />
            </dl>
            {live && (live.bio || live.externalUrl) && (
              <div className="mt-3 rounded-xl bg-page px-3 py-2 text-sm">
                {live.fullName && <p className="font-medium">{live.fullName}</p>}
                {live.bio && <p className="whitespace-pre-line text-ink-soft">{live.bio}</p>}
                {live.externalUrl && <p className="mt-1 truncate text-xs text-ink-muted">Link in bio: {live.externalUrl}</p>}
              </div>
            )}
          </Section>

          <Section title="Red flags">
            {s.flags.length ? (
              <ul className="space-y-1.5 text-sm text-bad">
                {s.flags.map((f) => (
                  <li key={f} className="flex gap-2"><span className="mt-0.5 shrink-0"><IconAlert size={15} /></span>{f}</li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-good"><IconCheck size={15} /> None found.</p>
            )}
          </Section>

          <Section title="Why we picked this creator">
            <p className="flex gap-2 text-sm"><span className="mt-0.5 shrink-0 text-fit"><IconInfo size={15} /></span>{s.why}</p>
          </Section>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="cg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

// One signal: a plain-language label, its value, a meter, and an optional note
function Signal({ label, value, note, children }: { label: string; value: string; note?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="shrink-0 font-semibold">{value}</span>
      </div>
      {children}
      {note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-page px-3 py-2">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
      {note && <dd className="text-[11px] text-ink-muted">{note}</dd>}
    </div>
  );
}

// Weekly followers over 90 days as a small line, so a sudden jump is easy to see
function Growth({ history }: { history: number[] }) {
  if (history.length === 0) {
    return <p className="mt-4 text-xs text-ink-muted">Follower growth: Not available. Instagram doesn&apos;t share follower history publicly, so the growth check is skipped.</p>;
  }
  if (history.length < 2) return <p className="mt-4 text-xs text-ink-muted">Follower history: only one data point.</p>;
  const lo = Math.min(...history), hi = Math.max(...history);
  const pts = history.map((v, i) => `${(i / (history.length - 1)) * 300},${56 - ((v - lo) / Math.max(1, hi - lo)) * 48 - 4}`).join(" ");
  const growth = ((history.at(-1)! - history[0]) / history[0]) * 100;
  return (
    <figure className="mt-4 rounded-xl bg-page p-3">
      <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="h-16 w-full" role="img" aria-label="Followers over the last 90 days">
        <polyline points={`0,60 ${pts} 300,60`} fill="var(--color-lavender)" stroke="none" />
        <polyline points={pts} fill="none" stroke="var(--color-brand-purple)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-1 text-xs text-ink-muted">
        Followers over the last 90 days (weekly): {compact(history[0])} → {compact(history.at(-1)!)} ({growth >= 0 ? "+" : ""}{growth.toFixed(1)}%)
      </figcaption>
    </figure>
  );
}
