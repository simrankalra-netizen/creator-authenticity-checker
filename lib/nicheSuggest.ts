// Suggests a Step 5 niche from the brand's own description by matching keywords.
// Plain code: the niche with the most matching words wins; no match = no suggestion.

export const NICHE_KEYWORDS: Record<string, string[]> = {
  Beauty: ["skincare", "skin care", "serum", "moisturiser", "moisturizer", "sunscreen", "makeup", "make-up", "lipstick", "cosmetic", "haircare", "hair care", "shampoo", "beauty", "face wash", "cleanser", "toner", "nail"],
  Fitness: ["gym", "protein", "workout", "fitness", "yoga", "athlete", "athleisure", "sports", "running", "supplement", "whey", "pilates", "training"],
  Fashion: ["kurta", "saree", "sari", "streetwear", "clothing", "apparel", "fashion", "dress", "sneakers", "shoes", "footwear", "jewellery", "jewelry", "handbag", "t-shirt", "tshirt", "denim", "ethnic wear"],
  Food: ["food", "snack", "spice", "masala", "tea", "coffee", "chai", "beverage", "drink", "bakery", "baked", "chocolate", "recipe", "meal", "kitchen", "organic food", "pickle"],
  Tech: ["tech", "gadget", "phone", "laptop", "app", "software", "headphones", "earbuds", "smartwatch", "electronics", "charger", "gaming"],
  Home: ["home decor", "decor", "furniture", "candle", "bedding", "cushion", "plant", "planter", "kitchenware", "cookware", "interior", "lamp", "rug"],
};

export type NicheSuggestion = { niche: string; matched: string[] };

// "We sell vitamin C serum and sunscreen" -> { niche: "Beauty", matched: ["serum", "sunscreen"] }
export function suggestNicheFromText(text: string): NicheSuggestion | null {
  const lower = ` ${text.toLowerCase()} `;
  let best: NicheSuggestion | null = null;
  for (const [niche, words] of Object.entries(NICHE_KEYWORDS)) {
    const matched = words.filter((w) => new RegExp(`(^|[^a-z])${w.replace(/[-]/g, "\\-")}(s|es)?([^a-z]|$)`).test(lower));
    if (matched.length && (!best || matched.length > best.matched.length)) best = { niche, matched };
  }
  return best;
}

// A gentle check only (never blocks): does it look like a web address?
export function looksLikeLink(input: string) {
  const t = input.trim();
  if (!t) return true;
  return /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(t) || /instagram\.com\//i.test(t);
}
