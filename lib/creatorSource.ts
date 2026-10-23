// THE ONLY FILE THAT KNOWS WHERE CREATORS COME FROM.
// Everything else asks getCreators() and works with the Creator shape below.
//
// Two sources, picked by DATA_SOURCE in .env.local (read on the server by app/api/creators):
//   - demo (default): 100 made-up creators from data/demo-creators.json (not real people).
//   - apify: real public Instagram creators, collected on the server by lib/apifySource.ts.
//     Public data can't show audience age or cities, follower history or rates, so those
//     are left empty and the screens say "Not available".
// If the live search fails, the screen offers demoCreators() instead, clearly labelled.
import demo from "../data/demo-creators.json";
import type { Brief } from "./brief";

export type Creator = {
  id: string;
  handle: string;
  platform: "Instagram" | "YouTube";
  niche: string; // Fashion, Beauty, Food, Fitness, Tech or Home
  subNiche: string;
  city: string;
  state: string;
  followers: number;
  avgLikes: number;
  avgComments: number;
  followerHistory: number[]; // weekly follower counts over the last 90 days, oldest first ([] = not available)
  daysOfData: number; // how many days of history the numbers cover
  postsPerMonth: number;
  audienceAge: Record<string, number> | null; // % per age band, e.g. { "18-24": 40, ... }
  audienceTopCities: { city: string; pct: number }[] | null;
  commentSample: { checked: number; generic: number; repeated: number }; // recent comments read
  pastBrands: string[];
  ratePerPost: number | null; // ₹ per post (null = not public)
  pastCampaigns: { brand: string; orders: number; method: string }[]; // promo code / link sales
  source?: "demo" | "live"; // missing = demo
  collectedAt?: string; // live data: when it was collected (ISO date)
  live?: LiveFacts; // live data: the public profile facts behind the scores
};

// What public Instagram data tells us about one creator (see lib/fromInstagram.ts)
export type LiveFacts = {
  fullName: string;
  bio: string;
  following: number;
  postsCount: number;
  verified: boolean;
  businessCategory: string;
  externalUrl: string;
  profileUrl: string;
  postsChecked: number; // recent posts with visible likes used for the numbers
  hiddenLikePosts: number; // recent posts with likes hidden by the creator
  likesPerPost: number[]; // likes on each checked post, newest first
  lastPostDaysAgo: number | null;
};

export const SOURCE_LABEL = { demo: "Demo data", live: "Live Instagram data" } as const;
export const SOURCE_NOTE = {
  demo: "Made-up creators for this demo. Not real people.",
  live: "Based on public Instagram data. Scores are signals, not proof.",
} as const;

export type CreatorList = { source: "demo" | "live"; creators: Creator[]; collectedAt: string | null; cached: boolean; hashtags: string[] };
export type SourceStage = "finding" | "checking" | "scoring";

// Why the live search didn't work, in words the screen can show
export class SourceError extends Error {
  constructor(public reason: string, message: string) {
    super(message);
  }
}

export function demoCreators(): CreatorList {
  return { source: "demo", creators: (demo as Creator[]).map((c) => ({ ...c, source: "demo" })), collectedAt: null, cached: false, hashtags: [] };
}

// Asks the server which source to use and, for live data, reports each stage as it happens
export async function getCreators(brief: Brief, onStage: (s: SourceStage) => void, signal?: AbortSignal): Promise<CreatorList> {
  let res: Response;
  try {
    res = await fetch("/api/creators", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief }), signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new SourceError("failed", "Couldn't reach the server");
  }
  if (!res.ok || !res.body) throw new SourceError("failed", `Server error ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const l of lines.filter(Boolean)) {
      const msg = JSON.parse(l);
      if (msg.type === "stage") onStage(msg.stage);
      if (msg.type === "error") throw new SourceError(msg.reason, msg.message);
      if (msg.type === "done") {
        if (msg.source === "demo") return demoCreators();
        return { source: "live", creators: msg.creators, collectedAt: msg.collectedAt, cached: msg.cached, hashtags: msg.hashtags };
      }
    }
    if (done) throw new SourceError("failed", "The search stopped before it finished");
  }
}
