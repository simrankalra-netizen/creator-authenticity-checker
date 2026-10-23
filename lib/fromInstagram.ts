// Turns raw public Instagram data (from Apify) into the Creator record the scoring code expects.
// Plain code only. Anything Instagram doesn't share publicly is left empty ("Not available"), never guessed.
import type { Creator } from "./creatorSource";
import { suggestNicheFromText } from "./nicheSuggest";

// The parts of Apify's Instagram Profile Scraper output we use
export type RawComment = { text?: string; ownerUsername?: string };
export type RawPost = {
  type?: string;
  url?: string;
  caption?: string | null;
  hashtags?: string[];
  likesCount?: number | null; // -1 or missing = the creator hides likes
  commentsCount?: number | null;
  timestamp?: string;
  isPinned?: boolean;
  latestComments?: RawComment[];
};
export type RawProfile = {
  username: string;
  url?: string;
  fullName?: string;
  biography?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  verified?: boolean;
  private?: boolean;
  isBusinessAccount?: boolean;
  businessCategoryName?: string | null;
  businessAddress?: { city_name?: string | null } | string | null;
  externalUrl?: string | null;
  latestPosts?: RawPost[];
};

const DAY = 24 * 60 * 60 * 1000;
const round1 = (n: number) => Math.round(n * 10) / 10;

// Business categories that mean a shop or company, not a creator
const BRAND_CATEGORY = /shop|store|retail|brand|company|product|e-?commerce|restaurant|cafe|salon|clinic|spa\b|hospital|agency|media|news|publisher|magazine|school|college|organi[sz]ation|service/i;

// Public, a real audience, and not obviously a brand or shop
export function looksLikeCreator(p: RawProfile): boolean {
  if (p.private || !p.username) return false;
  if ((p.followersCount ?? 0) < 1000) return false;
  if (p.isBusinessAccount && p.businessCategoryName && BRAND_CATEGORY.test(p.businessCategoryName)) return false;
  return true;
}

const CITIES: [string, RegExp][] = [
  ["Mumbai", /\bmumbai|bombay\b/i], ["Delhi", /\bdelhi\b|\bncr\b/i], ["Bengaluru", /\bbengaluru|bangalore\b/i],
  ["Pune", /\bpune\b/i], ["Hyderabad", /\bhyderabad\b/i], ["Chennai", /\bchennai\b/i], ["Kolkata", /\bkolkata|calcutta\b/i],
  ["Jaipur", /\bjaipur\b/i], ["Ahmedabad", /\bahmedabad\b/i], ["Goa", /\bgoa\b/i], ["Lucknow", /\blucknow\b/i],
  ["Chandigarh", /\bchandigarh\b/i], ["Gurugram", /\bgurgaon|gurugram\b/i], ["Noida", /\bnoida\b/i], ["Indore", /\bindore\b/i],
  ["Kochi", /\bkochi|cochin\b/i], ["Surat", /\bsurat\b/i],
];

// Only a city the creator shows: their business address, or one named in their bio
export function cityShown(p: RawProfile): string {
  const addr = typeof p.businessAddress === "string" ? safeJson(p.businessAddress) : p.businessAddress;
  const fromAddress = addr && typeof addr === "object" ? (addr as { city_name?: string | null }).city_name : null;
  if (fromAddress) return fromAddress.split(",")[0].trim();
  return CITIES.find(([, re]) => re.test(p.biography ?? ""))?.[0] ?? "";
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Generic comments: emoji-only, or short praise that could be left on any post
const GENERIC = /^(nice|wow|cool|great|awesome|amazing|beautiful|gorgeous|lovely|super|so good|so cute|love it|love this|nice pic|nice post|great post|great content|looks good|so pretty|stunning|perfect|first|fire|lit)[\s!.]*$/i;
const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Component}\s❤️]+$/u;

export function commentQuality(comments: RawComment[], creator: string) {
  const seen = new Set<string>();
  let checked = 0, generic = 0, repeated = 0;
  for (const c of comments) {
    const text = (c.text ?? "").trim();
    if (!text || c.ownerUsername === creator) continue; // the creator's own replies don't count
    checked++;
    const plain = text.replace(/@\w[\w.]*/g, "").trim();
    const key = plain.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) repeated++;
    else if (!plain || EMOJI_ONLY.test(plain) || GENERIC.test(plain)) generic++;
    seen.add(key);
  }
  return { checked, generic, repeated };
}

export function toCreator(p: RawProfile, collectedAt: Date, extraComments: RawComment[] = []): Creator {
  const now = collectedAt.getTime();
  const all = (p.latestPosts ?? []).filter((x) => x.timestamp);
  const recent = all.filter((x) => !x.isPinned); // pinned posts are old favourites, not recent activity
  // Posts under a day old are still collecting likes; hidden likes can't be counted
  const usable = recent.filter((x) => typeof x.likesCount === "number" && x.likesCount >= 0 && now - Date.parse(x.timestamp!) >= DAY);
  const hidden = recent.filter((x) => typeof x.likesCount !== "number" || x.likesCount < 0).length;

  const likes = usable.map((x) => x.likesCount as number);
  const comments = usable.map((x) => Math.max(0, x.commentsCount ?? 0));
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

  const times = recent.map((x) => Date.parse(x.timestamp!)).filter(Number.isFinite);
  const oldest = times.length ? Math.min(...times) : now;
  const newest = times.length ? Math.max(...times) : null;
  const days = Math.max(0, Math.round((now - oldest) / DAY));
  const postsPerMonth = times.length ? round1((times.length * 30) / Math.max(days, 1)) : 0;

  const text = [p.biography ?? "", ...recent.map((x) => `${x.caption ?? ""} ${(x.hashtags ?? []).map((h) => `#${h}`).join(" ")}`)].join(" ");
  const niche = suggestNicheFromText(text);
  const sub = niche?.matched[0] ?? "";

  return {
    id: `ig_${p.username}`,
    handle: p.username,
    platform: "Instagram",
    niche: niche?.niche ?? "Other",
    subNiche: sub ? sub.charAt(0).toUpperCase() + sub.slice(1) : niche?.niche ?? "Other",
    city: cityShown(p),
    state: "",
    followers: p.followersCount ?? 0,
    avgLikes: avg(likes),
    avgComments: avg(comments),
    followerHistory: [], // not public
    daysOfData: days,
    postsPerMonth,
    audienceAge: null, // not public
    audienceTopCities: null, // not public
    commentSample: commentQuality([...recent.flatMap((x) => x.latestComments ?? []), ...extraComments], p.username),
    pastBrands: [],
    ratePerPost: null, // not public
    pastCampaigns: [],
    source: "live",
    collectedAt: collectedAt.toISOString(),
    live: {
      fullName: p.fullName ?? "",
      bio: p.biography ?? "",
      following: p.followsCount ?? 0,
      postsCount: p.postsCount ?? 0,
      verified: Boolean(p.verified),
      businessCategory: p.businessCategoryName ?? "",
      externalUrl: p.externalUrl ?? "",
      profileUrl: p.url || `https://www.instagram.com/${p.username}/`,
      postsChecked: usable.length,
      hiddenLikePosts: hidden,
      likesPerPost: likes,
      lastPostDaysAgo: newest === null ? null : Math.round((now - newest) / DAY),
    },
  };
}
