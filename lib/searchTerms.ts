// Turns a brand brief into Instagram hashtags to find creators with. Plain code only.
// Niche + place: a skincare brand in Mumbai -> #mumbaiskincare, #skincaremumbai, #mumbaibeautyblogger, #skincareindia
import type { Brief } from "./brief";
import { brandNiches } from "./creatorScores";

export const MAX_HASHTAGS = 4;

// Words people actually tag niche posts with (first word = the main one)
const NICHE_TAG_WORDS: Record<string, { topic: string[]; creator: string }> = {
  Beauty: { topic: ["skincare", "makeup", "beauty"], creator: "beautyblogger" },
  Fashion: { topic: ["fashion", "ootd", "style"], creator: "fashionblogger" },
  Food: { topic: ["food", "foodie", "recipes"], creator: "foodblogger" },
  Fitness: { topic: ["fitness", "gym", "workout"], creator: "fitnessblogger" },
  Tech: { topic: ["tech", "gadgets"], creator: "techreviewer" },
  Home: { topic: ["homedecor", "interiors"], creator: "homedecorblogger" },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function hashtagsFor(b: Brief): string[] {
  const niches = brandNiches(b);
  const words = NICHE_TAG_WORDS[niches[0]] ?? { topic: [slug(b.influencerNiche || b.nicheOther || "influencer")], creator: "influencer" };
  const main = words.topic[0];
  const raw = b.locationMode === "specific" ? b.location.split(",")[0] : "";
  const place = /\bindia\b/i.test(raw) ? "" : slug(raw);

  const tags = place
    ? [`${place}${main}`, `${main}${place}`, `${place}${words.creator}`, `${main}india`]
    : [`${main}india`, `indian${words.creator}`, `${words.topic[1] ?? main}india`, main];
  return [...new Set(tags.filter(Boolean))].slice(0, MAX_HASHTAGS);
}

// One stable key per search, so the same brief reuses the 24-hour cache
export function searchKey(b: Brief): string {
  return `search-${hashtagsFor(b).join("-")}`.slice(0, 200);
}
