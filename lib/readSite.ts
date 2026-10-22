// Reads a brand's website for the Brand Profile: the homepage, then the main
// product page, the About page and up to two other pages linked from it.
// Plain code only; every page goes through readPage's safety checks.
import { readPage } from "./readPage";
import { findPrices, type Price, type SitePage } from "./prices";

export type { Price, SitePage };
export type SiteRead =
  | { ok: true; pages: SitePage[]; prices: Price[]; homeUrl: string }
  | { ok: false; reason: string; message: string };

const PAGE_TEXT_CHARS = 5_000; // per page, so ~20k characters go to the AI in all
const EXTRA_TIMEOUT_MS = 6_000;

// Which kind of page a link points to, judged by its path and its words.
// A path may end in ".html" (e.g. zoho.com/aboutus.html).
const END = String.raw`(\.html?)?(\/|$|\?)`;
const KINDS = [
  { kind: "product", path: new RegExp(String.raw`\/(shop|store|products?|collections?|catalog|catalogue|pricing|plans|features|all-products)${END}`, "i"), words: /^(shop|shop all|products|our products|all products|collections|store|pricing|plans|features|buy)$/i },
  { kind: "about", path: new RegExp(String.raw`\/(about|about-us|aboutus|our-story|ourstory|story|company|who-we-are|pages\/about[\w-]*)${END}`, "i"), words: /^(about|about us|our story|who we are|company)$/i },
  { kind: "other", path: new RegExp(String.raw`\/(faq|faqs|why[\w-]*|how-it-works|solutions|customers|for-[\w-]+|pages\/[\w-]+)${END}`, "i"), words: /^(faq|faqs|how it works|why us|solutions|customers)$/i },
] as const;

const SKIP = /\/(cart|checkout|account|login|signin|sign-in|signup|sign-up|register|privacy|terms|policies|policy|legal|careers|jobs|blog\/.+|cdn-cgi)(\/|$|\?)|\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js)(\?|$)/i;

const sameSite = (a: URL, b: URL) => a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");

// Picks up to one product page, one About page and two other pages from the homepage's links
export function pickPages(homeHtml: string, homeUrl: string): { label: string; url: string }[] {
  const home = new URL(homeUrl);
  const best = new Map<string, { url: string; score: number }[]>();
  for (const m of homeHtml.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL;
    try {
      url = new URL(m[1].trim(), home);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || !sameSite(url, home) || SKIP.test(url.pathname)) continue;
    url.hash = "";
    if (url.pathname === home.pathname || url.pathname === "/") continue;
    const words = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    for (const { kind, path, words: w } of KINDS) {
      const score = (path.test(url.pathname) ? 2 : 0) + (w.test(words) ? 2 : 0) - url.pathname.split("/").length * 0.1;
      if (score <= 0) continue;
      const list = best.get(kind) ?? [];
      if (!list.some((x) => x.url === url.toString())) list.push({ url: url.toString(), score });
      best.set(kind, list);
      break;
    }
  }
  const top = (kind: string, n: number) => (best.get(kind) ?? []).sort((a, b) => b.score - a.score).slice(0, n);
  return [
    ...top("product", 1).map((x) => ({ label: "Product page", url: x.url })),
    ...top("about", 1).map((x) => ({ label: "About page", url: x.url })),
    ...top("other", 2).map((x) => ({ label: "Other page", url: x.url })),
  ];
}

export async function readSite(input: string): Promise<SiteRead> {
  const home = await readPage(input);
  if (!home.ok) return home;

  const extras = await Promise.all(
    pickPages(home.html, home.url).map(async (p) => ({ ...p, page: await readPage(p.url, EXTRA_TIMEOUT_MS) })),
  );
  const pages: SitePage[] = [{ label: "Homepage", url: home.url, text: home.text.slice(0, PAGE_TEXT_CHARS) }];
  const prices = findPrices(home.html, home.text);
  for (const { label, url, page } of extras) {
    if (!page.ok) continue; // a missing extra page is fine; the homepage is enough to start
    pages.push({ label, url, text: page.text.slice(0, PAGE_TEXT_CHARS) });
    prices.push(...findPrices(page.html, page.text));
  }
  return { ok: true, pages, prices, homeUrl: home.url };
}
