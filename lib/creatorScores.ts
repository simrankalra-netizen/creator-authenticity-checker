// Scores one creator against one brand brief. Plain code only: no AI, no API key.
// Authenticity reuses the tested rules in lib/score.ts unchanged, plus a comment-quality check.
import { scoreCreator, tierFor, type Reason } from "./score";
import type { Creator } from "./creatorSource";
import type { Brief } from "./brief";

export type Goal = "sales" | "reach" | "fit";
export type Level = "High" | "Medium" | "Low";

// Onboarding goal -> list filter
export const goalFromBrief = (b: Brief): Goal => (b.goal === "sales" ? "sales" : b.goal === "awareness" ? "reach" : "fit");
export const GOAL_LABEL: Record<Goal, string> = { sales: "Sales", reach: "Reach", fit: "Brand Fit" };

const fmt = (n: number) => n.toLocaleString("en-IN");
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------- Authenticity ----------

export const COMMENT_SETTINGS = {
  minChecked: 20, // need at least 20 comments read to judge comment quality
  suspiciousShare: 0.4, // over 40% generic or repeated comments is a warning
  maxPenalty: 25,
};

export type Authenticity =
  | { status: "scored"; score: number; confidence: "High" | "Medium" | "Low"; reasons: AuthReason[]; engagementRate: number; biggest30DayGrowth: number }
  | { status: "not_enough_data"; why: string };

export type AuthReason = { text: string; evidence: string; direction: "good" | "warning"; penalty: number };

// The biggest growth over any 4-week window in the weekly history (%)
export function biggest30DayGrowth(history: number[]) {
  if (history.length < 2) return null;
  let best = 0;
  for (let i = 0; i < history.length - 1; i++) {
    const j = Math.min(history.length - 1, i + 4);
    if (history[i] > 0) best = Math.max(best, ((history[j] - history[i]) / history[i]) * 100);
  }
  return round1(best);
}

export function authenticity(c: Creator): Authenticity {
  const growth = biggest30DayGrowth(c.followerHistory);
  const base = scoreCreator({
    row: 0,
    handle: c.handle,
    followers: c.followers,
    avgLikes: c.avgLikes,
    avgComments: c.avgComments,
    growthPct: c.daysOfData < 7 ? 0 : growth, // a brand-new account is caught by days of data below
    daysOfData: c.daysOfData,
  });
  if (base.status === "not_enough_data") {
    const why = growth === null && c.daysOfData < 7 ? `Only ${c.daysOfData} days of data` : base.why;
    return { status: "not_enough_data", why };
  }

  const reasons: AuthReason[] = base.reasons.map((r: Reason) => ({ text: r.text, evidence: r.evidence, direction: r.direction, penalty: r.penalty }));
  let score = base.score;
  let confidence = base.confidence;

  // Comment quality: generic ("nice 🔥") or repeated comments suggest engagement groups or bots
  const { checked, generic, repeated } = c.commentSample;
  if (checked >= COMMENT_SETTINGS.minChecked) {
    const share = (generic + repeated) / checked;
    const evidence = `${generic + repeated} of ${checked} recent comments generic or repeated · warning above ${COMMENT_SETTINGS.suspiciousShare * 100}%`;
    if (share > COMMENT_SETTINGS.suspiciousShare) {
      const penalty = Math.round(COMMENT_SETTINGS.maxPenalty * clamp01((share - COMMENT_SETTINGS.suspiciousShare) / 0.4) + 8);
      score = Math.max(0, score - penalty);
      reasons.push({
        text: `${generic + repeated} of ${checked} recent comments are generic or repeated ("nice 🔥"), a sign of engagement groups or bots.`,
        evidence,
        direction: "warning",
        penalty,
      });
      // The other checks looked fine but the comments don't: mixed signals
      if (base.reasons.every((r) => r.direction === "good")) confidence = "Medium";
    } else {
      reasons.push({ text: `Comments read like real conversation (${generic + repeated} of ${checked} generic or repeated).`, evidence, direction: "good", penalty: 0 });
    }
  }
  reasons.sort((a, b) => b.penalty - a.penalty);
  return {
    status: "scored",
    score,
    confidence,
    reasons: reasons.slice(0, 2),
    engagementRate: Math.round(((c.avgLikes + c.avgComments) / c.followers) * 100 * 100) / 100, // %, 2 decimals
    biggest30DayGrowth: growth ?? 0,
  };
}

// ---------- Brand Fit (0–100) ----------

const NICHE_WORDS: Record<string, RegExp> = {
  Beauty: /beauty|skin|makeup|cosmetic|hair|glow|personal care|grooming/i,
  Fashion: /fashion|apparel|cloth|wear|style|jewel|footwear|shoe/i,
  Food: /food|snack|spice|cook|kitchen|beverage|drink|tea|coffee|bak|eat/i,
  Fitness: /fitness|gym|yoga|sport|workout|run|wellness|protein|athlet/i,
  Tech: /tech|gadget|phone|software|gaming|app|electronic/i,
  Home: /home|decor|furniture|plant|interior|organis|diy/i,
};
const RELATED: Record<string, string[]> = {
  Beauty: ["Fashion"], Fashion: ["Beauty"], Fitness: ["Food"], Food: ["Fitness", "Home"], Home: ["Food"], Tech: [],
};

// The niches the brand asked for, from Step 6 (influencer niche) and Step 5 (brand niche)
export function brandNiches(b: Brief): string[] {
  const text = [b.influencerNiche, b.niche === "Other" ? b.nicheOther : b.niche].join(" ");
  return Object.keys(NICHE_WORDS).filter((n) => NICHE_WORDS[n].test(text));
}

const RANGES = ["nano", "micro", "mid", "macro"];
export const NICHE_MISMATCH_CAP = 35; // Brand Fit for a creator outside your niche is at most 35

export type FitPart = { label: string; points: number; max: number; note: string; counted: boolean };

// Share of the creator's audience in the brand's chosen place (null = place is "anywhere")
export function locationShare(c: Creator, b: Brief): number | null {
  const place = b.location.trim().toLowerCase();
  if (b.locationMode === "anywhere" || !place || /\bindia\b/.test(place)) return null;
  const inAudience = c.audienceTopCities?.find((x) => place.includes(x.city.toLowerCase()) || x.city.toLowerCase().includes(place));
  if (inAudience) return inAudience.pct;
  if (place.includes(c.state.toLowerCase())) return c.audienceTopCities?.[0]?.pct ?? 30; // brand chose the creator's state
  return 0;
}

export function brandFit(c: Creator, b: Brief): { score: number; parts: FitPart[] } {
  const parts: FitPart[] = [];

  const wanted = brandNiches(b);
  if (wanted.length === 0) {
    parts.push({ label: "Niche", points: 0, max: 30, note: "Your niche didn't match a known category", counted: false });
  } else if (wanted.includes(c.niche)) {
    parts.push({ label: "Niche", points: 30, max: 30, note: `${c.subNiche} is in your niche (${c.niche})`, counted: true });
  } else if (wanted.some((w) => RELATED[w]?.includes(c.niche))) {
    parts.push({ label: "Niche", points: 15, max: 30, note: `${c.niche} is related to your niche (${wanted.join(", ")})`, counted: true });
  } else {
    parts.push({ label: "Niche", points: 0, max: 30, note: `${c.niche} isn't your niche (${wanted.join(", ")})`, counted: true });
  }

  if (!b.targetAge) {
    parts.push({ label: "Audience age", points: 0, max: 20, note: "You didn't give a customer age, so this isn't counted", counted: false });
  } else if (!c.audienceAge) {
    parts.push({ label: "Audience age", points: 0, max: 20, note: "Audience age not available for this creator", counted: false });
  } else {
    const pct = c.audienceAge[b.targetAge] ?? 0;
    parts.push({ label: "Audience age", points: Math.round(20 * clamp01(pct / 60)), max: 20, note: `${pct}% of their audience is ${b.targetAge.replace("-", "–")} (full marks at 60%)`, counted: true });
  }

  const share = locationShare(c, b);
  if (share === null) {
    parts.push({ label: "Location", points: 20, max: 20, note: b.locationMode === "anywhere" ? "You chose anywhere" : `You chose ${b.location}`, counted: true });
  } else {
    parts.push({ label: "Location", points: Math.round(20 * clamp01(share / 30)), max: 20, note: `${share}% of their audience is in ${b.location} (full marks at 30%)`, counted: true });
  }

  const tier = tierFor(c.followers).name;
  if (!b.followerRange) {
    parts.push({ label: "Follower range", points: 0, max: 15, note: "No follower range chosen", counted: false });
  } else {
    const gap = Math.abs(RANGES.indexOf(tier) - RANGES.indexOf(b.followerRange));
    parts.push({ label: "Follower range", points: gap === 0 ? 15 : gap === 1 ? 7 : 0, max: 15, note: `${tier} creator; you asked for ${b.followerRange}`, counted: true });
  }

  const budget = Number(b.budget.replace(/,/g, "")) || 0;
  if (!budget) {
    parts.push({ label: "Budget", points: 15, max: 15, note: "No budget given", counted: true });
  } else {
    const ratio = c.ratePerPost / budget;
    parts.push({
      label: "Budget",
      points: ratio <= 1 ? 15 : ratio <= 1.25 ? 7 : 0,
      max: 15,
      note: `Rate ₹${fmt(c.ratePerPost)} vs your ₹${fmt(budget)} budget`,
      counted: true,
    });
  }

  const counted = parts.filter((p) => p.counted);
  const max = counted.reduce((n, p) => n + p.max, 0);
  let score = max ? Math.round((counted.reduce((n, p) => n + p.points, 0) / max) * 100) : 0;
  // A creator outside your niche can't be a strong fit, however well the rest matches
  const nichePart = parts[0];
  if (nichePart.counted && nichePart.points === 0) score = Math.min(score, NICHE_MISMATCH_CAP);
  return { score, parts };
}

// ---------- Expected return ----------

export const levelOf = (score: number): Level => (score >= 67 ? "High" : score >= 34 ? "Medium" : "Low");

export type ExpectedReturn = {
  sales: { level: Level; score: number; basis: string };
  reach: { level: Level; score: number; genuineFollowers: number };
  fit: { level: Level; score: number };
  bestFor: Goal;
};

export function expectedReturn(c: Creator, auth: Authenticity, fitScore: number, goal: Goal): ExpectedReturn {
  const authFactor = auth.status === "scored" ? auth.score / 100 : 0.5; // unknown = neutral
  const engaged = c.followers * ((c.avgLikes + c.avgComments) / Math.max(1, c.followers));

  let sales: ExpectedReturn["sales"];
  if (c.pastCampaigns.length) {
    const avgOrders = Math.round(c.pastCampaigns.reduce((n, p) => n + p.orders, 0) / c.pastCampaigns.length);
    const pastScore = clamp01(Math.log10(1 + avgOrders) / Math.log10(1 + 300)); // 300+ orders = full marks
    // Past sales were for other brands: scale by how well this creator's audience matches yours
    const score = Math.round(100 * pastScore * (0.5 + 0.5 * (fitScore / 100)));
    sales = {
      level: levelOf(score),
      score,
      basis: `Based on past sales: ${fmt(avgOrders)} orders per campaign on average (${c.pastCampaigns.length} campaign${c.pastCampaigns.length > 1 ? "s" : ""}), adjusted for how well their audience matches you`,
    };
  } else {
    const likelyBuyers = engaged * authFactor * (fitScore / 100);
    const score = Math.round(100 * clamp01(Math.log10(1 + likelyBuyers) / Math.log10(1 + 8_000)));
    sales = { level: levelOf(score), score, basis: "Estimated from engagement and audience match (no past sales data)" };
  }

  const genuineFollowers = Math.round(c.followers * authFactor);
  const reachScore = Math.round(100 * clamp01((Math.log10(Math.max(1, genuineFollowers)) - 3) / 3)); // 1,000 = 0, 10 lakh = 100
  const reachLevel: Level = genuineFollowers >= 2_00_000 ? "High" : genuineFollowers >= 30_000 ? "Medium" : "Low";

  const fitLevel: Level = fitScore >= 75 ? "High" : fitScore >= 50 ? "Medium" : "Low";

  const scores: Record<Goal, number> = { sales: sales.score, reach: reachScore, fit: fitScore };
  const best = (Object.keys(scores) as Goal[]).sort((a, b) => scores[b] - scores[a] || (a === goal ? -1 : b === goal ? 1 : 0))[0];

  return { sales, reach: { level: reachLevel, score: reachScore, genuineFollowers }, fit: { level: fitLevel, score: fitScore }, bestFor: best };
}

// ---------- Cost ----------

export function cost(c: Creator) {
  const engaged = c.avgLikes + c.avgComments;
  return { ratePerPost: c.ratePerPost, perEngaged: engaged > 0 ? Math.round((c.ratePerPost / engaged) * 100) / 100 : null };
}

// ---------- Red flags ----------

export function redFlags(c: Creator, b: Brief, auth: Authenticity): string[] {
  const flags: string[] = [];
  if (auth.status === "scored") {
    for (const r of auth.reasons) if (r.direction === "warning" && r.penalty >= 15) flags.push(r.text);
  }
  if (c.postsPerMonth < 2) flags.push(`Posts rarely (${c.postsPerMonth} a month).`);
  const budget = Number(b.budget.replace(/,/g, "")) || 0;
  if (budget && c.ratePerPost > budget) flags.push(`Rate ₹${fmt(c.ratePerPost)} is above your ₹${fmt(budget)} budget.`);
  const share = locationShare(c, b);
  if (share !== null && share < 10) flags.push(`Only ${share}% of their audience is in ${b.location}.`);
  return flags;
}

// ---------- "Why we picked this creator" ----------
// Plain-code template. This is the one place an AI could later write a friendlier
// sentence: keep it optional, and fall back to this template when there's no API key.
export function whyWePicked(c: Creator, fit: { parts: FitPart[] }, ret: ExpectedReturn, auth: Authenticity): string {
  const bits: string[] = [];
  const niche = fit.parts.find((p) => p.label === "Niche");
  if (niche && niche.points === niche.max) bits.push(`${c.subNiche.toLowerCase()} creator in ${c.city}`);
  else bits.push(`${c.niche.toLowerCase()} creator in ${c.city}`);
  const age = fit.parts.find((p) => p.label === "Audience age" && p.counted && p.points >= 14);
  if (age) bits.push(age.note.split(" (")[0].replace("% of their audience is", "% of followers are"));
  const loc = fit.parts.find((p) => p.label === "Location" && p.counted && p.max === 20 && p.note.includes("% of their audience"));
  if (loc && loc.points >= 14) bits.push(loc.note.split(" (")[0].replace("% of their audience is", "% of followers are"));
  if (c.pastCampaigns.length) bits.push(ret.sales.basis.replace("Based on past sales: ", "past campaigns sold ").split(" (")[0]);
  else if (auth.status === "scored" && auth.score >= 80) bits.push("engagement looks genuine");
  return bits.join("; ").replace(/^./, (s) => s.toUpperCase()) + ".";
}
