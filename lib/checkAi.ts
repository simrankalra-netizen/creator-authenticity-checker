// Checks Claude's rewording before it's shown. Anything that fails keeps the
// template sentence, plus a note saying why the AI wording was rejected.
import type { Direction, ScoredCreator } from "./score";

export type AiReason = { text: string; direction: Direction };
export type AiCreator = { handle: string; reasons: AiReason[] };

export type Verdict = { ok: true; texts: [string, string] } | { ok: false; note: string };

const MULTIPLIERS: Record<string, number> = { k: 1e3, thousand: 1e3, lakh: 1e5, lakhs: 1e5, m: 1e6, million: 1e6, crore: 1e7 };

// Pulls every number out of a sentence: "12.5k followers" -> 12500, "1,200" -> 1200
export function numbersIn(text: string): number[] {
  const found: number[] = [];
  // (?<![\w@]) skips digits inside handles like @riya_92
  const re = /(?<![\w@])(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|lakhs?|m|million|crore)?\b/gi;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1].replace(/,/g, ""));
    const mult = m[2] ? MULTIPLIERS[m[2].toLowerCase()] : 1;
    if (Number.isFinite(n)) found.push(n * mult);
  }
  return found;
}

// Rounding is fine ("0.4%" for 0.42, "12k" for 12,345); new numbers are not.
function isKnown(n: number, facts: number[]) {
  return facts.some((f) => Math.abs(n - f) <= Math.max(0.051, Math.abs(f) * 0.05));
}

export function checkAiReasons(creator: ScoredCreator, ai: AiCreator | undefined): Verdict {
  if (!ai) return { ok: false, note: "AI wording rejected: this creator was missing from the AI reply" };
  if (ai.reasons.length !== 2) return { ok: false, note: "AI wording rejected: didn't return exactly 2 reasons" };
  for (let i = 0; i < 2; i++) {
    const { text, direction } = ai.reasons[i];
    if (!text.trim()) return { ok: false, note: "AI wording rejected: returned an empty sentence" };
    if (direction !== creator.reasons[i].direction) {
      return { ok: false, note: "AI wording rejected: didn't match the check result" };
    }
    if (numbersIn(text).some((n) => !isKnown(n, creator.facts))) {
      return { ok: false, note: "AI wording rejected: used a number not in your data" };
    }
  }
  return { ok: true, texts: [ai.reasons[0].text, ai.reasons[1].text] };
}

// The reply as a whole: duplicates or unknown handles mean the AI mixed creators up.
export function checkAiReply(creators: ScoredCreator[], reply: AiCreator[]) {
  const sent = new Set(creators.map((c) => c.handle.toLowerCase()));
  const counts = new Map<string, number>();
  for (const a of reply) counts.set(a.handle.toLowerCase(), (counts.get(a.handle.toLowerCase()) ?? 0) + 1);

  const verdicts = new Map<string, Verdict>();
  for (const c of creators) {
    const key = c.handle.toLowerCase();
    if ((counts.get(key) ?? 0) > 1) {
      verdicts.set(c.handle, { ok: false, note: "AI wording rejected: this creator appeared twice in the AI reply" });
      continue;
    }
    verdicts.set(c.handle, checkAiReasons(c, reply.find((a) => a.handle.toLowerCase() === key)));
  }
  const extras = reply.filter((a) => !sent.has(a.handle.toLowerCase())).length;
  return { verdicts, extras };
}
