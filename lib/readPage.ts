// Reads a brand's website safely and returns its visible text. Server only.
// Refuses Instagram (it blocks automated reading), local/private addresses,
// non-web pages, slow pages and huge pages. Never guesses: no text = an error.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type PageText = { ok: true; url: string; title: string; text: string } | { ok: false; reason: string; message: string };

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_500_000;
export const MIN_TEXT_CHARS = 150;
const MAX_TEXT_CHARS = 6_000;

const fail = (reason: string, message: string): PageText => ({ ok: false, reason, message });

export function isInstagram(host: string) {
  return /(^|\.)(instagram\.com|instagr\.am)$/i.test(host);
}

// Loopback, private, link-local and other non-public ranges
export function isPrivateAddress(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

// "mybrand.in" -> "https://mybrand.in/"
export function normaliseUrl(input: string): URL | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

// Title + meta description + visible text, tags and scripts removed.
export function extractText(html: string) {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const metas = [...html.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*>/gi)]
    .map((m) => decode(m[0].match(/content=["']([^"']*)["']/i)?.[1] ?? "").trim())
    .filter(Boolean);
  const body = decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
  const text = [...new Set(metas), body].join("\n").slice(0, MAX_TEXT_CHARS);
  return { title, text };
}

async function checkHost(host: string) {
  if (/^localhost$/i.test(host) || host.endsWith(".local") || host.endsWith(".internal")) return false;
  try {
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a.address));
  } catch {
    return null; // the name doesn't exist
  }
}

export async function readPage(input: string): Promise<PageText> {
  let url = normaliseUrl(input);
  if (!url) return fail("invalid", "That doesn't look like a website address. Try something like mybrand.in.");
  if (isInstagram(url.hostname)) {
    return fail("instagram", "Instagram pages can't be read automatically. Add your website instead, or describe your brand below.");
  }

  // Follow up to 3 redirects by hand, checking every hop is a public address
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    const allowed = await checkHost(url.hostname);
    if (allowed === null) return fail("not_found", "We couldn't find that website. Check the address, or describe your brand below.");
    if (!allowed) return fail("blocked", "That address can't be read. Use your brand's public website, or describe your brand below.");
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CollabgramBot/1.0; brand summary)", Accept: "text/html" },
      });
    } catch {
      return fail("unreachable", "We couldn't reach that website (it may be down, slow or blocking us). Describe your brand below instead.");
    }
    const redirectTo: string | null = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!redirectTo) break;
    if (hop === 3) return fail("unreachable", "That website redirects too many times. Describe your brand below instead.");
    url = new URL(redirectTo, url);
    if (isInstagram(url.hostname)) {
      return fail("instagram", "That link leads to Instagram, which can't be read automatically. Describe your brand below.");
    }
  }

  if (!res!.ok) {
    return fail("http_error", `That website answered with an error (${res!.status}), so it couldn't be read. Describe your brand below instead.`);
  }
  if (!(res!.headers.get("content-type") ?? "").includes("text/html")) {
    return fail("not_html", "That link isn't a web page we can read. Describe your brand below instead.");
  }

  // Read at most MAX_BYTES
  const reader = res!.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  const { title, text } = extractText(new TextDecoder().decode(Buffer.concat(chunks)));
  if (text.length < MIN_TEXT_CHARS) {
    return fail("too_little_text", "That website has too little readable text (it may need JavaScript or a login). Describe your brand below instead.");
  }
  return { ok: true, url: url.toString(), title, text };
}
