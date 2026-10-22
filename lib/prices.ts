// Prices seen on a brand's website, plus the shared page type.
// Safe for both the browser and the server (no network code here).

export type SitePage = { label: string; url: string; text: string };
export type Price = { amount: number; currency: string };

const CURRENCY: Record<string, string> = { "₹": "INR", rs: "INR", "rs.": "INR", inr: "INR", $: "USD", usd: "USD", "€": "EUR", eur: "EUR", "£": "GBP", gbp: "GBP" };

// Prices written on the page ("₹1,299", "Rs. 499", "$10/month") and in product data ("price": "1299")
export function findPrices(html: string, text: string): Price[] {
  const prices: Price[] = [];
  for (const m of text.matchAll(/(₹|rs\.?|inr|\$|usd|€|eur|£|gbp)\s?(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\b/gi)) {
    const amount = Number(m[2].replace(/,/g, ""));
    if (amount > 0 && amount < 10_000_000) prices.push({ amount, currency: CURRENCY[m[1].toLowerCase()] });
  }
  for (const m of html.matchAll(/"price"\s*:\s*"?(\d+(?:\.\d+)?)"?[^}]{0,200}?"priceCurrency"\s*:\s*"([A-Z]{3})"/g)) {
    const amount = Number(m[1]);
    if (amount > 0 && amount < 10_000_000) prices.push({ amount, currency: m[2] });
  }
  return prices;
}

// "₹299–₹1,499 (12 prices seen)" in the site's most common currency, or null when none were seen
export function priceSummary(prices: Price[]): string | null {
  if (prices.length === 0) return null;
  const counts = new Map<string, number>();
  for (const p of prices) counts.set(p.currency, (counts.get(p.currency) ?? 0) + 1);
  const currency = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const amounts = prices.filter((p) => p.currency === currency).map((p) => p.amount).sort((a, b) => a - b);
  const symbol = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }[currency] ?? `${currency} `;
  const fmt = (n: number) => symbol + n.toLocaleString(currency === "INR" ? "en-IN" : "en-US");
  const range = amounts[0] === amounts.at(-1) ? fmt(amounts[0]) : `${fmt(amounts[0])}–${fmt(amounts.at(-1)!)}`;
  return `${range} (${amounts.length} price${amounts.length === 1 ? "" : "s"} seen)`;
}
