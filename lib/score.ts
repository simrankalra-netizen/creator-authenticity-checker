// Turns a creator's numbers into a score, a confidence level and 2 reasons.
// Plain code only: the same input always gives the same answer.

// ---- Settings: change these numbers to tune the scoring ----
export const SETTINGS = {
  minFollowers: 1000, // fewer than this = "not enough data"
  minDaysOfData: 7, // numbers covering fewer days than this = "not enough data"
  maxPenaltyPerCheck: 35, // each check can remove at most this many points
  maxPenaltyInsideNormal: 15, // a check inside its normal range removes at most this
  mildWarningBelow: 18, // a warning that removes under 18 points counts as "borderline"
  // Normal engagement range (likes + comments ÷ followers, in %) by creator size
  tiers: [
    { name: "nano", upTo: 10_000, low: 3, high: 12 },
    { name: "micro", upTo: 100_000, low: 1.5, high: 8 },
    { name: "mid", upTo: 500_000, low: 1, high: 5 },
    { name: "macro", upTo: Infinity, low: 0.5, high: 3.5 },
  ],
  minCommentsPerLikePct: 1, // fewer comments than 1% of likes looks bought
  healthyCommentsPerLikePct: 4, // 4% or more is full marks; 1–4% loses a few points
  growthSpikePct: 20, // more than 20% follower growth in 30 days is a spike
};

export type Creator = {
  row: number;
  handle: string;
  followers: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  growthPct: number | null;
  daysOfData?: number | null; // undefined = the file has no days column
};

export type Direction = "good" | "warning";

export type Reason = {
  code: "engagement" | "comments" | "growth";
  direction: Direction;
  penalty: number;
  evidence: string; // the raw numbers, shown in grey next to the sentence
  text: string; // the template sentence (may later be replaced by AI wording)
};

export type ScoredCreator = {
  status: "scored";
  handle: string;
  followers: number;
  tier: string;
  score: number;
  confidence: "High" | "Medium" | "Low";
  reasons: [Reason, Reason];
  facts: number[]; // every number the AI is allowed to mention
};

export type ThinCreator = {
  status: "not_enough_data";
  handle: string;
  followers: number | null;
  why: string;
};

export type CreatorResult = ScoredCreator | ThinCreator;

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString("en-IN");
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? "" : "s"}`;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Outside the normal range: starts where the inside-normal penalty ends and
// grows with the gap from normal, capped at the maximum.
function outsidePenalty(gap: number) {
  const { maxPenaltyInsideNormal: inside, maxPenaltyPerCheck: max } = SETTINGS;
  return Math.round(inside + (max - inside) * clamp01(gap));
}

export function tierFor(followers: number) {
  return SETTINGS.tiers.find((t) => followers < t.upTo)!;
}

export function notEnoughDataReason(c: Creator): string | null {
  if (c.followers === null || c.avgLikes === null || c.avgComments === null || c.growthPct === null) {
    return "Some numbers are blank";
  }
  if (c.followers < SETTINGS.minFollowers) {
    return `Fewer than ${fmt(SETTINGS.minFollowers)} followers`;
  }
  if (c.avgLikes === 0 && c.avgComments === 0) {
    return "No likes or comments recorded";
  }
  if (c.daysOfData === null) {
    return "Days of data is blank";
  }
  if (c.daysOfData !== undefined && c.daysOfData < SETTINGS.minDaysOfData) {
    return `Only ${plural(c.daysOfData, "day")} of data (needs ${SETTINGS.minDaysOfData} or more)`;
  }
  return null;
}

export function scoreCreator(c: Creator): CreatorResult {
  const why = notEnoughDataReason(c);
  if (why) return { status: "not_enough_data", handle: c.handle, followers: c.followers, why };

  const followers = c.followers!;
  const likes = c.avgLikes!;
  const comments = c.avgComments!;
  const growth = c.growthPct!;
  const tier = tierFor(followers);

  // Check 1: engagement rate compared with normal for this creator size
  const er = round2(((likes + comments) / followers) * 100);
  const range = `${tier.low}–${tier.high}%`;
  const engagementEvidence = `engagement ${er}% · normal for ${tier.name}: ${range}`;
  let engagement: Reason;
  if (er < tier.low) {
    engagement = {
      code: "engagement",
      direction: "warning",
      penalty: outsidePenalty((tier.low - er) / (tier.low * 0.75)),
      evidence: engagementEvidence,
      text: `Engagement is only ${er}%, below the ${range} normal for a ${tier.name} creator, a sign of fake or inactive followers.`,
    };
  } else if (er > tier.high) {
    engagement = {
      code: "engagement",
      direction: "warning",
      penalty: outsidePenalty((er - tier.high) / tier.high),
      evidence: engagementEvidence,
      text: `Engagement is ${er}%, unusually high for a ${tier.name} creator (normal ${range}), a sign of bought likes or engagement groups.`,
    };
  } else {
    // Inside normal: full marks in the middle of the range, a few points off near its edges
    const position = (Math.log(er) - Math.log(tier.low)) / (Math.log(tier.high) - Math.log(tier.low));
    const offCentre = Math.abs(position - 0.5) * 2; // 0 = middle, 1 = edge
    const where = position < 0.25 ? "at the low end of" : position > 0.75 ? "at the high end of" : "in the middle of";
    engagement = {
      code: "engagement",
      direction: "good",
      penalty: Math.round(SETTINGS.maxPenaltyInsideNormal * offCentre),
      evidence: engagementEvidence,
      text: `Engagement is ${er}%, ${where} the normal ${range} for a ${tier.name} creator.`,
    };
  }

  // Check 2: comments compared with likes
  const minPct = SETTINGS.minCommentsPerLikePct;
  const healthyPct = SETTINGS.healthyCommentsPerLikePct;
  const commentPct = likes > 0 ? round2((comments / likes) * 100) : 100;
  const commentEvidence = `${plural(comments, "comment")} per ${plural(likes, "like")} = ${commentPct}% · normal: ${minPct}% or more`;
  let commentsReason: Reason;
  if (commentPct < minPct) {
    commentsReason = {
      code: "comments",
      direction: "warning",
      penalty: outsidePenalty((minPct - commentPct) / (minPct * 0.8)),
      evidence: commentEvidence,
      text: `Comments are only ${commentPct}% of likes (normal is ${minPct}% or more), a sign of bought likes.`,
    };
  } else if (commentPct < healthyPct) {
    commentsReason = {
      code: "comments",
      direction: "good",
      penalty: Math.round((SETTINGS.maxPenaltyInsideNormal * (healthyPct - commentPct)) / (healthyPct - minPct)),
      evidence: commentEvidence,
      text: `Comments are ${commentPct}% of likes: normal, though under ${healthyPct}% means fewer real conversations.`,
    };
  } else {
    commentsReason = {
      code: "comments",
      direction: "good",
      penalty: 0,
      evidence: commentEvidence,
      text: `Comments are ${commentPct}% of likes, a healthy level of real conversation.`,
    };
  }

  // Check 3: follower growth spike while engagement stays low
  const spike = SETTINGS.growthSpikePct;
  const engagementLow = er < (tier.low + tier.high) / 2;
  const growthEvidence = `followers +${growth}% in 30 days · spike: over ${spike}%`;
  let growthReason: Reason;
  if (growth > spike && engagementLow) {
    growthReason = {
      code: "growth",
      direction: "warning",
      penalty: outsidePenalty((growth - spike) / 30),
      evidence: growthEvidence,
      text: `Followers jumped ${growth}% in 30 days while engagement stayed low, a sign of bought followers.`,
    };
  } else if (growth > spike) {
    growthReason = {
      code: "growth",
      direction: "good",
      penalty: 0,
      evidence: growthEvidence,
      text: `Followers grew ${growth}% in 30 days and engagement kept up, so the growth looks real.`,
    };
  } else {
    growthReason = {
      code: "growth",
      direction: "good",
      penalty: 0,
      evidence: growthEvidence,
      text: `Followers grew ${growth}% in 30 days, a steady rate.`,
    };
  }

  const checks = [engagement, commentsReason, growthReason];
  const score = Math.max(0, 100 - checks.reduce((sum, r) => sum + r.penalty, 0));

  // Top 2 reasons = the 2 checks that moved the score most (stable order on ties)
  const top = [...checks].sort((a, b) => b.penalty - a.penalty).slice(0, 2) as [Reason, Reason];

  // Confidence: do the 3 checks agree, and is any warning only borderline?
  const borderline = checks.some((r) => r.direction === "warning" && r.penalty < SETTINGS.mildWarningBelow);
  const warnings = checks.filter((r) => r.direction === "warning").length;
  const confidence = borderline ? "Low" : warnings === 0 || warnings === 3 ? "High" : "Medium";

  const facts = [
    followers, likes, comments, growth, er, commentPct, score,
    tier.low, tier.high, tier.upTo, minPct, healthyPct, spike, 30, SETTINGS.minFollowers,
    ...SETTINGS.tiers.map((t) => t.upTo).filter(Number.isFinite),
  ];

  return {
    status: "scored",
    handle: c.handle,
    followers,
    tier: tier.name,
    score,
    confidence,
    reasons: top,
    facts,
  };
}
