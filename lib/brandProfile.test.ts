// Automatic checks for the Brand Profile's plain-code rules. Run with: npm test
import { describe, expect, it } from "vitest";
import { pickPages } from "./readSite";
import { findPrices, priceSummary, type SitePage } from "./prices";
import { checkProfile, NOT_CLEAR, suggestFollowerRange, suggestNiche, PROFILE_FIELDS, type FieldKey, type RawField } from "./brandProfile";

const HOME = `<html><body>
  <a href="/collections/all">Shop all</a>
  <a href="/pages/about-us">About us</a>
  <a href="/pages/faq">FAQ</a>
  <a href="/cart">Cart</a>
  <a href="https://instagram.com/brand">Instagram</a>
  <a href="/policies/privacy-policy">Privacy</a>
</body></html>`;

describe("choosing pages to read", () => {
  it("picks the product, About and FAQ pages, and skips cart, policy and other sites", () => {
    const pages = pickPages(HOME, "https://glowbrand.in/");
    expect(pages).toEqual([
      { label: "Product page", url: "https://glowbrand.in/collections/all" },
      { label: "About page", url: "https://glowbrand.in/pages/about-us" },
      { label: "Other page", url: "https://glowbrand.in/pages/faq" },
    ]);
  });

  it("understands page addresses ending in .html", () => {
    const html = '<a href="/all-products.html?src=x">All Products</a><a href="/aboutus.html">About Us</a><a href="/customers.html">Customers</a>';
    expect(pickPages(html, "https://www.zoho.com/").map((p) => p.label)).toEqual(["Product page", "About page", "Other page"]);
  });
});

describe("prices", () => {
  it("finds rupee and dollar prices in text and in product data", () => {
    const prices = findPrices('{"price": "1299.00", "priceCurrency": "INR"}', "Face wash ₹299 · Serum Rs. 1,499 · $12/month");
    expect(prices).toEqual([
      { amount: 299, currency: "INR" },
      { amount: 1499, currency: "INR" },
      { amount: 12, currency: "USD" },
      { amount: 1299, currency: "INR" },
    ]);
    expect(priceSummary(prices)).toBe("₹299–₹1,499 (3 prices seen)");
    expect(priceSummary([])).toBeNull();
  });
});

const filler = " Free shipping across India. Easy returns within 7 days.".repeat(30); // a normal-length page, not a thin one
const pages: SitePage[] = [
  { label: "Homepage", url: "https://glowbrand.in/", text: "Clean skincare for oily skin. Face wash and serums made for college students." + filler },
  { label: "About page", url: "https://glowbrand.in/pages/about-us", text: "We started Glow for women in their twenties who want simple routines." },
];

function raw(overrides: Partial<Record<FieldKey, Partial<RawField>>> = {}) {
  const base = Object.fromEntries(
    PROFILE_FIELDS.map((f) => [f.key, { value: NOT_CLEAR, evidence_page: "", evidence_quote: "", confidence: "low", clear: false }]),
  ) as Record<FieldKey, RawField>;
  for (const [k, v] of Object.entries(overrides)) base[k as FieldKey] = { ...base[k as FieldKey], ...v };
  return base;
}

describe("evidence checks", () => {
  it("keeps an answer whose quote is really on the site, with its page", () => {
    const p = checkProfile(
      raw({ sells: { value: "Face wash and serums", evidence_page: "Homepage", evidence_quote: "Face wash and serums", confidence: "high", clear: true } }),
      pages, [], "website",
    );
    expect(p.fields.sells).toEqual({ value: "Face wash and serums", evidence: 'Homepage: "Face wash and serums"', confidence: "high", clear: true });
  });

  it("finds the quote even if the AI names the wrong page", () => {
    const p = checkProfile(
      raw({ gender: { value: "Women", evidence_page: "Homepage", evidence_quote: "for women in their twenties", confidence: "medium", clear: true } }),
      pages, [], "website",
    );
    expect(p.fields.gender.evidence).toBe('About page: "for women in their twenties"');
  });

  it("turns an answer with an invented quote into 'Not clear'", () => {
    const p = checkProfile(
      raw({ icp: { value: "Rich executives", evidence_page: "About page", evidence_quote: "for high-income executives", confidence: "high", clear: true } }),
      pages, [], "website",
    );
    expect(p.fields.icp).toMatchObject({ value: NOT_CLEAR, clear: false });
  });

  it("only sets price positioning when prices were actually seen", () => {
    const answer = { price: { value: "Premium", evidence_page: "Homepage", evidence_quote: "", confidence: "medium" as const, clear: true } };
    expect(checkProfile(raw(answer), pages, [], "website").fields.price.clear).toBe(false);
    const withPrices = checkProfile(raw(answer), pages, [{ amount: 2499, currency: "INR" }], "website").fields.price;
    expect(withPrices).toMatchObject({ value: "Premium", clear: true, evidence: "Prices seen on the site: ₹2,499 (1 price seen)" });
  });

  it("marks a one-page site as thin and lowers 'high' to 'medium'", () => {
    const p = checkProfile(
      raw({ sells: { value: "Face wash", evidence_page: "Homepage", evidence_quote: "Face wash and serums", confidence: "high", clear: true } }),
      pages.slice(0, 1), [], "website",
    );
    expect(p.thin).toBe(true);
    expect(p.fields.sells.confidence).toBe("medium");
  });
});

describe("pre-filling later steps", () => {
  const profile = checkProfile(
    raw({
      niche: { value: "Clean skincare for oily skin · Beauty", evidence_page: "Homepage", evidence_quote: "Clean skincare for oily skin", confidence: "high", clear: true },
      price: { value: "Mid", evidence_page: "", evidence_quote: "", confidence: "medium", clear: true },
    }),
    pages, [{ amount: 499, currency: "INR" }], "website",
  );

  it("maps the profile's niche to a Step 5 button", () => {
    expect(suggestNiche(profile)).toEqual({ niche: "Beauty", nicheOther: "" });
  });

  it("suggests a follower range from price positioning", () => {
    expect(suggestFollowerRange(profile)).toBe("micro");
  });
});
