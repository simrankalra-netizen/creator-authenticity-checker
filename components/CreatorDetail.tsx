"use client";

// The detail view for one creator: every signal behind their scores.
import { useEffect } from "react";
import { GOAL_LABEL, type Goal } from "@/lib/creatorScores";
import { GOAL_WEIGHTS, type Scored } from "@/lib/ranking";
import type { Brief } from "@/lib/brief";
import { authBadge, compact, LEVEL_STYLE, rupees } from "@/components/TopCreators";

export default function CreatorDetail({ s, goal, brief, onClose }: { s: Scored; goal: Goal; brief: Brief; onClose: () => void }) {
  const c = s.creator;
  const w = GOAL_WEIGHTS[goal];
  const auth = authBadge(s);
  const authScore = s.auth.status === "scored" ? s.auth.score : 50;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Details for @${c.handle}`}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 text-ink shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-ink-soft">Demo data · not a real person</p>
            <h2 className="text-xl font-semibold">@{c.handle}</h2>
            <p className="text-sm text-ink-soft">
              {c.subNiche} ({c.niche}) · {c.city}, {c.state} · {c.platform}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-3 py-1 text-sm">
            Close
          </button>
        </div>

        {s.warning && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">⚠ {s.warning}</p>}

        <Section title={`Ranking score: ${s.combined}/100 (ranked for ${GOAL_LABEL[goal]})`}>
          <p className="text-sm text-ink-soft">
            {Math.round(w.sales * 100)}% sales potential ({s.ret.sales.score}) + {Math.round(w.reach * 100)}% reach ({s.ret.reach.score}) +{" "}
            {Math.round(w.fit * 100)}% Brand Fit ({s.fit.score}) + {Math.round(w.auth * 100)}% authenticity ({authScore}
            {s.auth.status === "scored" ? "" : ", not enough data so counted as a neutral 50"}).
          </p>
        </Section>

        <Section title={`Brand Fit: ${s.fit.score}/100`}>
          <table className="w-full text-sm">
            <tbody>
              {s.fit.parts.map((p) => (
                <tr key={p.label} className="border-t border-zinc-100 align-top">
                  <td className="py-1.5 pr-2 font-medium">{p.label}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{p.counted ? `${p.points}/${p.max}` : "Not counted"}</td>
                  <td className="py-1.5 text-ink-soft">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {s.fit.parts[0].counted && s.fit.parts[0].points === 0 && (
            <p className="mt-1 text-xs text-ink-soft">Outside your niche, so Brand Fit is capped at 35.</p>
          )}
        </Section>

        <Section title="Authenticity">
          <p className="text-sm">
            <span className={`rounded-md px-2 py-0.5 font-semibold ${auth.style}`}>{auth.text}</span>
            {s.auth.status === "scored" && <span className="ml-2 text-ink-soft">{s.auth.confidence} confidence</span>}
          </p>
          {s.auth.status === "scored" ? (
            <ul className="mt-2 space-y-1 text-sm">
              {s.auth.reasons.map((r) => (
                <li key={r.text}>
                  {r.direction === "good" ? "✓" : "⚠"} {r.text}
                  <span className="block text-xs text-zinc-500">{r.evidence}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">{s.auth.why}. We don&apos;t guess, so this creator isn&apos;t scored or flagged.</p>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Fact label="Followers" value={c.followers.toLocaleString("en-IN")} />
            <Fact label="Average likes / comments" value={`${c.avgLikes.toLocaleString("en-IN")} / ${c.avgComments.toLocaleString("en-IN")}`} />
            <Fact label="Engagement rate" value={c.followers ? `${(((c.avgLikes + c.avgComments) / c.followers) * 100).toFixed(2)}%` : "—"} />
            <Fact label="Comments per 100 likes" value={c.avgLikes ? ((c.avgComments / c.avgLikes) * 100).toFixed(1) : "—"} />
            <Fact
              label="Recent comments checked"
              value={c.commentSample.checked ? `${c.commentSample.generic} generic, ${c.commentSample.repeated} repeated (of ${c.commentSample.checked})` : "None available"}
            />
            <Fact label="Days of data" value={`${c.daysOfData}`} />
          </dl>
          <Growth history={c.followerHistory} />
        </Section>

        <Section title="Expected return">
          <ul className="space-y-2 text-sm">
            <li>
              <span className={`rounded-md px-2 py-0.5 text-xs ${LEVEL_STYLE[s.ret.sales.level]}`}>Sales: {s.ret.sales.level}</span>{" "}
              <span className="text-ink-soft">{s.ret.sales.basis}.</span>
            </li>
            <li>
              <span className={`rounded-md px-2 py-0.5 text-xs ${LEVEL_STYLE[s.ret.reach.level]}`}>Reach: {s.ret.reach.level}</span>{" "}
              <span className="text-ink-soft">
                About {compact(s.ret.reach.genuineFollowers)} genuine followers (followers × authenticity
                {s.auth.status === "scored" ? "" : ", counted at 50% as there's not enough data"}).
              </span>
            </li>
            <li>
              <span className={`rounded-md px-2 py-0.5 text-xs ${LEVEL_STYLE[s.ret.fit.level]}`}>Brand fit: {s.ret.fit.level}</span>{" "}
              <span className="text-ink-soft">From the Brand Fit score ({s.fit.score}).</span>
            </li>
          </ul>
          {c.pastCampaigns.length > 0 && (
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs text-ink-soft">
                <tr><th className="py-1">Past campaign</th><th>Orders</th><th>Tracked by</th></tr>
              </thead>
              <tbody>
                {c.pastCampaigns.map((p, i) => (
                  <tr key={i} className="border-t border-zinc-100"><td className="py-1">{p.brand} (demo)</td><td>{p.orders.toLocaleString("en-IN")}</td><td>{p.method}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Audience">
          {c.audienceAge ? (
            <div className="space-y-1 text-sm">
              {Object.entries(c.audienceAge).map(([band, pct]) => (
                <div key={band} className="flex items-center gap-2">
                  <span className={`w-12 ${band === brief.targetAge ? "font-semibold" : ""}`}>{band.replace("-", "–")}</span>
                  <div className="h-2 flex-1 rounded-full bg-zinc-100"><div className="h-2 rounded-full bg-brand-purple/70" style={{ width: `${pct}%` }} /></div>
                  <span className="w-10 text-right">{pct}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Audience age not available.</p>
          )}
          <p className="mt-2 text-sm">
            <span className="text-ink-soft">Top audience cities:</span>{" "}
            {c.audienceTopCities ? c.audienceTopCities.map((x) => `${x.city} ${x.pct}%`).join(" · ") : "Not available"}
          </p>
        </Section>

        <Section title="Cost and activity">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Fact label="Typical rate" value={`${rupees(c.ratePerPost)} per post`} />
            <Fact
              label="Cost per engaged follower"
              value={s.cost.perEngaged !== null ? `${rupees(s.cost.perEngaged)} (rate ÷ likes and comments per post)` : "No engagement recorded"}
            />
            <Fact label="Posts per month" value={`${c.postsPerMonth}`} />
            <Fact label="Past brand collaborations" value={c.pastBrands.length ? `${c.pastBrands.join(", ")} (demo)` : "None listed"} />
          </dl>
        </Section>

        <Section title="Red flags">
          {s.flags.length ? (
            <ul className="space-y-1 text-sm text-amber-900">{s.flags.map((f) => <li key={f}>⚠ {f}</li>)}</ul>
          ) : (
            <p className="text-sm text-ink-soft">None found.</p>
          )}
        </Section>

        <Section title="Why we picked this creator">
          <p className="text-sm">{s.why}</p>
        </Section>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-zinc-200 pt-4">
      <h3 className="mb-2 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

// Weekly followers over 90 days as a small line, so a sudden jump is easy to see
function Growth({ history }: { history: number[] }) {
  if (history.length < 2) return <p className="mt-3 text-xs text-ink-soft">Follower history: only one data point.</p>;
  const lo = Math.min(...history), hi = Math.max(...history);
  const pts = history.map((v, i) => `${(i / (history.length - 1)) * 300},${50 - ((v - lo) / Math.max(1, hi - lo)) * 44 - 3}`).join(" ");
  const growth = ((history.at(-1)! - history[0]) / history[0]) * 100;
  return (
    <figure className="mt-3">
      <svg viewBox="0 0 300 50" className="h-14 w-full" role="img" aria-label="Followers over the last 90 days">
        <polyline points={pts} fill="none" stroke="var(--color-brand-purple)" strokeWidth="2" />
      </svg>
      <figcaption className="text-xs text-ink-soft">
        Followers over the last 90 days (weekly): {compact(history[0])} → {compact(history.at(-1)!)} ({growth >= 0 ? "+" : ""}{growth.toFixed(1)}%)
      </figcaption>
    </figure>
  );
}
