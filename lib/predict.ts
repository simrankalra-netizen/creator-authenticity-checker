// Measures how well the scores predicted sales: Spearman rank correlation.
// Rank creators by score, rank them by orders, and compare the two rankings.
// 1 = same order, 0 = no link, negative = backwards.
import { handleKey, type SalesRow } from "./parseCsv";
import type { CreatorResult } from "./score";

export const MIN_MATCHED = 5;

export type Match =
  | { ok: true; value: number; label: "strong" | "some" | "weak"; compared: number; skipped: number }
  | { ok: false; message: string; compared: number; skipped: number };

// Equal values share the average of their positions (standard for Spearman).
function ranks(values: number[]) {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const result = new Array<number>(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (end + 1 < order.length && order[end + 1].v === order[start].v) end++;
    const avg = (start + end) / 2 + 1;
    for (let k = start; k <= end; k++) result[order[k].i] = avg;
    start = end + 1;
  }
  return result;
}

export function spearman(a: number[], b: number[]) {
  const ra = ranks(a);
  const rb = ranks(b);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ma = mean(ra);
  const mb = mean(rb);
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < ra.length; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb);
    va += (ra[i] - ma) ** 2;
    vb += (rb[i] - mb) ** 2;
  }
  if (va === 0 || vb === 0) return 0; // everyone tied: no ranking to compare
  return cov / Math.sqrt(va * vb);
}

export function ordersByHandle(sales: SalesRow[]) {
  return new Map(sales.map((s) => [s.handle, s.orders]));
}

export function scoreSalesMatch(results: CreatorResult[], sales: SalesRow[]): Match {
  const orders = ordersByHandle(sales);
  const scores: number[] = [];
  const sold: number[] = [];
  for (const r of results) {
    const o = orders.get(handleKey(r.handle));
    if (r.status === "scored" && o !== undefined) {
      scores.push(r.score);
      sold.push(o);
    }
  }
  const compared = scores.length;
  const skipped = results.length - compared;
  if (compared < MIN_MATCHED) {
    return {
      ok: false,
      message: `Need at least ${MIN_MATCHED} creators with both a score and sales to measure the match; found ${compared}.`,
      compared,
      skipped,
    };
  }
  const value = Math.round(spearman(scores, sold) * 100) / 100;
  const label = value >= 0.6 ? "strong" : value >= 0.3 ? "some" : "weak";
  return { ok: true, value, label, compared, skipped };
}
