// The onboarding answers. Kept in this browser tab's sessionStorage only:
// they survive a refresh and disappear when the tab is closed. No database.
import type { CountryCode } from "libphonenumber-js";
import type { BrandProfile } from "./brandProfile";

export const NICHES = ["Fashion", "Beauty", "Food", "Fitness", "Tech", "Home", "Other"] as const;
export const GOALS = [
  { value: "awareness", label: "Create buzz and awareness" },
  { value: "sales", label: "Drive sales and conversions" },
  { value: "audience", label: "Reach the right audience size for my category" },
] as const;
export const FOLLOWER_RANGES = [
  { value: "nano", label: "Nano", detail: "under 10k followers" },
  { value: "micro", label: "Micro", detail: "10k–100k" },
  { value: "mid", label: "Mid", detail: "100k–500k" },
  { value: "macro", label: "Macro", detail: "500k+" },
] as const;
export const PLATFORMS = ["Instagram", "YouTube", "Other"] as const;
export const AGE_RANGES = ["18-24", "25-34", "35-44", "45+"] as const;

export type Brief = {
  step: number; // 1–6 = onboarding question, 7 = "Your brief is ready", 8 = top 10 creators, 9 = CSV creator check
  returnToBrief: boolean; // editing one answer from the brief screen
  country: CountryCode;
  phoneNumber: string;
  phoneE164: string;
  codeSentAt: number; // when the last code was sent (for the 30-second resend wait)
  smsMode: "" | "demo" | "twilio";
  verifiedPhone: string; // the number that passed the code check ("" = not verified)
  brandName: string;
  link: string;
  summary: string; // the user's own description, used when the website can't be read
  summarySource: "" | "website" | "manual";
  profile: BrandProfile | null; // the confirmed Brand Profile from Step 4
  followerRangeSuggested: boolean; // follower range was pre-filled from the profile
  niche: string;
  nicheOther: string;
  nicheSuggested: string; // the niche pre-selected from the description ("" = none, or the user chose their own)
  influencerNiche: string;
  targetAge: string; // optional: the brand's customers' age range, e.g. "25-34" ("" = not given)
  locationMode: "anywhere" | "specific";
  location: string;
  goal: string;
  followerRange: string;
  budget: string;
  platform: string;
  platformOther: string;
};

export const EMPTY_BRIEF: Brief = {
  step: 1,
  returnToBrief: false,
  country: "IN",
  phoneNumber: "",
  phoneE164: "",
  codeSentAt: 0,
  smsMode: "",
  verifiedPhone: "",
  brandName: "",
  link: "",
  summary: "",
  summarySource: "",
  profile: null,
  followerRangeSuggested: false,
  niche: "",
  nicheOther: "",
  nicheSuggested: "",
  influencerNiche: "",
  targetAge: "",
  locationMode: "anywhere",
  location: "",
  goal: "",
  followerRange: "",
  budget: "",
  platform: "",
  platformOther: "",
};

const KEY = "collabgram-brief";

export function loadBrief(): Brief {
  try {
    const saved = sessionStorage.getItem(KEY);
    return saved ? { ...EMPTY_BRIEF, ...JSON.parse(saved) } : EMPTY_BRIEF;
  } catch {
    return EMPTY_BRIEF; // private window or storage blocked: start fresh
  }
}

export function saveBrief(brief: Brief) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(brief));
  } catch {
    // storage blocked: answers still work until the page is closed
  }
}

export const nicheLabel = (b: Brief) => (b.niche === "Other" ? b.nicheOther || "Other" : b.niche);
export const goalLabel = (b: Brief) => GOALS.find((g) => g.value === b.goal)?.label ?? "";
export const rangeLabel = (b: Brief) => {
  const r = FOLLOWER_RANGES.find((x) => x.value === b.followerRange);
  return r ? `${r.label} (${r.detail})` : "";
};
export const platformLabel = (b: Brief) => (b.platform === "Other" ? b.platformOther || "Other" : b.platform);
export const locationLabel = (b: Brief) => (b.locationMode === "anywhere" ? "Anywhere" : b.location);
