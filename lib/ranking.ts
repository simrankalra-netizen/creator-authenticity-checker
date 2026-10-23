// Picks a brand's top 10 creators. Plain code only.
import type { Creator } from "./creatorSource";
import type { Brief } from "./brief";
import {
  authenticity, brandFit, cost, expectedReturn, locationShare, redFlags, whyWePicked,
  type Authenticity, type ExpectedReturn, type FitPart, type Goal,
} from "./creatorScores";

// How much each part counts in the combined score, by the brand's main goal
export const GOAL_WEIGHTS: Record<Goal, { sales: number; reach: number; fit: number; auth: number }> = {
  sales: { sales: 0.4, auth: 0.3, fit: 0.2, reach: 0.1 },
  reach: { reach: 0.45, auth: 0.25, fit: 0.2, sales: 0.1 },
  fit: { fit: 0.5, auth: 0.25, reach: 0.15, sales: 0.1 },
};

export const LOW_AUTHENTICITY = 50; // below this, a creator is left out unless needed (and then marked)
const OVER_BUDGET = 1.25; // more than 25% over budget is "clearly outside"
const OUTSIDE_LOCATION_PCT = 10; // under 10% of the audience in the chosen place
const TOP_N = 10;

export type Scored = {
  creator: Creator;
  auth: Authenticity;
  fit: { score: number; parts: FitPart[] };
  ret: ExpectedReturn;
  cost: ReturnType<typeof cost>;
  flags: string[];
  why: string;
  combined: number;
  outside: string[]; // why this creator is outside the brand's choices (empty = inside)
  warning: string | null; // shown on the card when included despite being outside or low authenticity
};

export function scoreAll(creators: Creator[], b: Brief, goal: Goal): Scored[] {
  const budget = Number(b.budget.replace(/,/g, "")) || 0;
  const w = GOAL_WEIGHTS[goal];
  return creators.map((creator) => {
    const auth = authenticity(creator);
    const fit = brandFit(creator, b);
    const ret = expectedReturn(creator, auth, fit.score, goal);
    const authScore = auth.status === "scored" ? auth.score : 50; // "Not enough data" counts as neutral
    const combined = Math.round(w.sales * ret.sales.score + w.reach * ret.reach.score + w.fit * fit.score + w.auth * authScore);

    const outside: string[] = [];
    if (budget && creator.ratePerPost !== null && creator.ratePerPost > budget * OVER_BUDGET) outside.push("over budget");
    const share = locationShare(creator, b);
    if (share !== null && share < OUTSIDE_LOCATION_PCT && !b.location.toLowerCase().includes(creator.city.toLowerCase())) outside.push("outside your location");
    if ((b.platform === "Instagram" || b.platform === "YouTube") && creator.platform !== b.platform) outside.push(`on ${creator.platform}, not ${b.platform}`);
    const niche = fit.parts[0];
    if (niche.counted && niche.points === 0) outside.push("not your niche");
    if (auth.status === "scored" && auth.score < LOW_AUTHENTICITY) outside.push("low authenticity");

    return {
      creator, auth, fit, ret,
      cost: cost(creator),
      flags: redFlags(creator, b, auth),
      why: whyWePicked(creator, fit, ret, auth),
      combined,
      outside,
      warning: null,
    };
  });
}

export type TopList = { top: Scored[]; note: string | null; matched: number; total: number };

export function topCreators(creators: Creator[], b: Brief, goal: Goal): TopList {
  const all = scoreAll(creators, b, goal).sort((x, y) => y.combined - x.combined);
  const inside = all.filter((s) => s.outside.length === 0);
  const top = inside.slice(0, TOP_N);
  let note: string | null = null;

  if (top.length < TOP_N) {
    // Fill from the nearest misses: in your niche but over budget/elsewhere first,
    // then other niches, and low authenticity last
    const rank = (s: Scored) => (s.outside.includes("low authenticity") ? 2 : s.outside.includes("not your niche") ? 1 : 0);
    // Within a group, the closest to the brief first (Brand Fit already scores budget, place and size)
    const misses = all.filter((s) => s.outside.length > 0).sort((x, y) => rank(x) - rank(y) || y.fit.score - x.fit.score || y.combined - x.combined);
    const fill = misses.slice(0, TOP_N - top.length).map((s) => ({
      ...s,
      warning: s.outside.includes("low authenticity")
        ? "Low authenticity: shown only because fewer than 10 creators matched. Check carefully before paying."
        : `Outside your choices (${s.outside.join(", ")}): shown because fewer than 10 creators matched.`,
    }));
    const reasons = [...new Set(fill.flatMap((s) => s.outside))].join(", ");
    note = `Only ${inside.length} creator${inside.length === 1 ? "" : "s"} matched your niche, budget, location and platform, so ${fill.length} more ${fill.length === 1 ? "is" : "are"} shown with a warning (${reasons}).`;
    top.push(...fill);
  }

  return { top, note, matched: inside.length, total: all.length };
}
