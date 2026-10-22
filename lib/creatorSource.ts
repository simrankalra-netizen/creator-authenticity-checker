// THE ONLY FILE THAT KNOWS WHERE CREATORS COME FROM.
// Everything else asks getCreators() and works with the Creator shape below.
//
// Today: 100 made-up demo creators from data/demo-creators.json (not real people).
// To connect a real source later, change only this file:
//   - CSV export: parse the file and map each row into a Creator (same fields).
//   - Apify Instagram actor: call it from a server route with APIFY_TOKEN in .env.local,
//     then map followers, recent posts' likes/comments and comments into a Creator.
//     Public scraping can't see audience age or audience cities (only a creator's own
//     Insights can), so set those to null; Brand Fit then says "not available".
import demo from "../data/demo-creators.json";

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
  followerHistory: number[]; // weekly follower counts over the last 90 days, oldest first
  daysOfData: number; // how many days of history the numbers cover
  postsPerMonth: number;
  audienceAge: Record<string, number> | null; // % per age band, e.g. { "18-24": 40, ... }
  audienceTopCities: { city: string; pct: number }[] | null;
  commentSample: { checked: number; generic: number; repeated: number }; // recent comments read
  pastBrands: string[];
  ratePerPost: number; // ₹ per post
  pastCampaigns: { brand: string; orders: number; method: string }[]; // promo code / link sales
};

export const SOURCE_LABEL = "Demo data";
export const SOURCE_NOTE = "Made-up creators for this demo. Not real people.";

export async function getCreators(): Promise<Creator[]> {
  return demo as Creator[];
}
