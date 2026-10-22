// The Brand Profile: 9 facts about a brand, each with evidence and confidence.
// Claude fills it in; the checks here make sure nothing is invented.
import { priceSummary, type Price, type SitePage } from "./prices";

export const NOT_CLEAR = "Not clear from the website";

export const PROFILE_FIELDS = [
  { key: "sells", label: "What they sell", ask: "Product categories and the main products." },
  { key: "niche", label: "Brand niche", ask: 'One clear niche label (e.g. "sustainable skincare"), then " · " and the broader category (e.g. "Beauty").' },
  { key: "personality", label: "Personality and vibe", ask: "A few words (e.g. minimal, bold, playful, premium, luxury, budget-friendly, outgoing, quiet and clean), then \" — \" and one line on why." },
  { key: "age", label: "Target age group", ask: 'An age range, e.g. "18–24" or "25–40".' },
  { key: "gender", label: "Gender focus", ask: 'Women, men, all genders, etc. Only if the site shows one.' },
  { key: "icp", label: "Ideal customer (ICP)", ask: "Who the buyer is, their interests, and likely income level." },
  { key: "anchor", label: "Anchor target group", ask: "The core audience the brand is mainly built for." },
  { key: "users", label: "User target group", ask: 'Who actually uses the product, if different from the buyer (e.g. parents buying for kids). If the same, say "Same as the buyer".' },
  { key: "price", label: "Price positioning", ask: 'Exactly one of "Low", "Mid" or "Premium", judged from the prices listed below and how the site presents them.' },
] as const;

export type FieldKey = (typeof PROFILE_FIELDS)[number]["key"];
export type Confidence = "high" | "medium" | "low";

export type ProfileField = {
  value: string; // NOT_CLEAR when the site doesn't say
  evidence: string; // e.g. About page: "made for college students"
  confidence: Confidence;
  clear: boolean;
  edited?: boolean; // changed by the user
};

export type BrandProfile = {
  source: "website" | "description";
  pagesRead: string[]; // page labels, e.g. ["Homepage", "About page"]
  thin: boolean;
  fields: Record<FieldKey, ProfileField>;
};

// What Claude returns for each field before the checks
export type RawField = { value: string; evidence_page: string; evidence_quote: string; confidence: Confidence; clear: boolean };

const THIN_TEXT_CHARS = 1_500;

export function promptFor(pages: SitePage[], prices: Price[]) {
  const seen = priceSummary(prices);
  return [
    ...pages.map((p) => `=== ${p.label} (${p.url}) ===\n${p.text}`),
    `=== Prices found on the site by code ===\n${seen ?? "No prices were found on the pages read."}`,
  ].join("\n\n");
}

export const SYSTEM = `You build a Brand Profile for a marketing tool from a brand's own words.
Fill in each field ONLY from what the text says or clearly shows. Never guess.

For every field return:
- value: the answer, short and plain
- evidence_page: the page label the answer came from, exactly as written in the === headers (e.g. "About page")
- evidence_quote: a short phrase copied word for word from that page (3 to 15 words) that supports the answer
- confidence: "high" if the text states it directly, "medium" if it clearly implies it, "low" if it only hints at it
- clear: false if the text doesn't give enough to answer; then set value to "${NOT_CLEAR}", evidence_quote to "", confidence to "low"

Fields:
${PROFILE_FIELDS.map((f) => `- ${f.key} (${f.label}): ${f.ask}`).join("\n")}

For "price": if no prices were found by code, set clear to false.`;

const squash = (s: string) =>
  s.toLowerCase().replace(/[“”"'‘’`]/g, "").replace(/[–—-]/g, "-").replace(/\s+/g, " ").trim();

// Is the quote really in the text the AI was given? (case, quotes and spacing ignored)
export function quoteFound(quote: string, pages: SitePage[], pageLabel: string) {
  const q = squash(quote);
  if (q.split(" ").length < 2) return null;
  const page = pages.find((p) => p.label === pageLabel && squash(p.text).includes(q));
  if (page) return page;
  return pages.find((p) => squash(p.text).includes(q)) ?? null; // right quote, wrong page label
}

const notClear = (why: string): ProfileField => ({ value: NOT_CLEAR, evidence: why, confidence: "low", clear: false });

// Turns Claude's answer into a checked profile. Anything without real evidence becomes "Not clear".
export function checkProfile(
  raw: Record<FieldKey, RawField>,
  pages: SitePage[],
  prices: Price[],
  source: BrandProfile["source"],
): BrandProfile {
  const totalText = pages.reduce((n, p) => n + p.text.length, 0);
  const thin = source === "website" && (pages.length === 1 || totalText < THIN_TEXT_CHARS);
  const fields = {} as Record<FieldKey, ProfileField>;

  for (const { key } of PROFILE_FIELDS) {
    const r = raw[key];
    if (!r || !r.clear || !r.value.trim() || r.value.trim() === NOT_CLEAR) {
      fields[key] = notClear(source === "website" ? "The website doesn't say." : "Your description doesn't say.");
      continue;
    }
    if (key === "price") {
      const seen = priceSummary(prices);
      const level = /premium/i.test(r.value) ? "Premium" : /mid/i.test(r.value) ? "Mid" : /low|budget/i.test(r.value) ? "Low" : null;
      fields.price = seen && level
        ? { value: level, evidence: `Prices seen on the site: ${seen}`, confidence: thin && r.confidence === "high" ? "medium" : r.confidence, clear: true }
        : notClear(seen ? "Prices were seen but the level wasn't clear." : "No prices were found on the pages read.");
      continue;
    }
    const page = quoteFound(r.evidence_quote, pages, r.evidence_page);
    if (!page) {
      fields[key] = notClear("No supporting words were found on the site, so this was left out.");
      continue;
    }
    const confidence: Confidence = thin && r.confidence === "high" ? "medium" : r.confidence;
    fields[key] = { value: r.value.trim(), evidence: `${page.label}: "${r.evidence_quote.trim()}"`, confidence, clear: true };
  }
  return { source, pagesRead: pages.map((p) => p.label), thin, fields };
}

// ---- Pre-filling later steps from the confirmed profile ----

// "Sustainable skincare · Beauty" -> "Sustainable skincare"
export const nicheName = (p: BrandProfile) => (p.fields.niche.clear ? p.fields.niche.value.split(/\s*[·|]\s*/)[0].trim() : "");

// Matches the profile's niche to the Step 5 buttons, else "Other" + the niche label
export function suggestNiche(p: BrandProfile): { niche: string; nicheOther: string } | null {
  if (!p.fields.niche.clear) return null;
  const text = p.fields.niche.value.toLowerCase();
  const map: [string, RegExp][] = [
    ["Beauty", /beauty|skin|cosmetic|makeup|hair|personal care|grooming/],
    ["Fashion", /fashion|apparel|cloth|wear|footwear|shoe|jewel|accessor/],
    ["Food", /food|snack|beverage|drink|coffee|tea|spice|grocery|nutrition|kitchen/],
    ["Fitness", /fitness|gym|sport|workout|yoga|athlet|wellness/],
    ["Tech", /tech|software|saas|app|electronic|gadget|productivity|digital/],
    ["Home", /home|decor|furniture|living|bedding|kitchenware|cleaning/],
  ];
  const hit = map.find(([, re]) => re.test(text));
  return hit ? { niche: hit[0], nicheOther: "" } : { niche: "Other", nicheOther: nicheName(p) };
}

// A simple rule, shown as "suggested": budget brands -> nano, mid -> micro, premium -> mid
export function suggestFollowerRange(p: BrandProfile): string {
  if (!p.fields.price.clear) return "";
  return { Low: "nano", Mid: "micro", Premium: "mid" }[p.fields.price.value] ?? "";
}
