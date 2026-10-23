// Extra authenticity checks that only apply to live Instagram data. Plain code only.
// They add reasons (and small penalties) on top of lib/score.ts, which stays unchanged.
// Wording never calls anyone fake: a viral post or a big following list has honest causes too.
import type { Creator } from "./creatorSource";
import type { AuthReason } from "./creatorScores";

export const LIVE_SETTINGS = {
  minPostsChecked: 6, // fewer recent posts with visible likes = "not enough data"
  spikeRatio: 5, // one post with 5× the typical likes is unusual
  bigSpikeRatio: 10,
  spikePenalty: 8,
  bigSpikePenalty: 12,
  followRatio: 1, // following more accounts than follow you…
  bigFollowRatio: 2,
  minFollowingToCheck: 1000, // …only counts once they follow 1,000+ accounts
  followPenalty: 10,
  bigFollowPenalty: 15,
};

const fmt = (n: number) => n.toLocaleString("en-IN");
const round1 = (n: number) => Math.round(n * 10) / 10;

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function liveSignals(c: Creator): { thin: string | null; reasons: AuthReason[] } {
  const live = c.live!;
  const S = LIVE_SETTINGS;
  if (live.postsChecked < S.minPostsChecked) {
    const hidden = live.hiddenLikePosts ? ` (${live.hiddenLikePosts} have likes hidden)` : "";
    return { thin: `Only ${live.postsChecked} recent posts with visible likes${hidden}, needs ${S.minPostsChecked}`, reasons: [] };
  }

  const reasons: AuthReason[] = [];

  // One post with far more likes than the rest
  const likes = live.likesPerPost;
  const top = Math.max(...likes);
  const rest = likes.filter((_, i) => i !== likes.indexOf(top));
  const typical = median(rest);
  const ratio = typical > 0 ? top / typical : 0;
  if (ratio >= S.spikeRatio) {
    reasons.push({
      text: `One recent post got ${round1(ratio)}× the likes of a typical post. That can be a viral post or boosted likes, so signals look unusual: check that post.`,
      evidence: `top post ${fmt(top)} likes · typical ${fmt(Math.round(typical))} (${likes.length} posts) · unusual at ${S.spikeRatio}×`,
      direction: "warning",
      penalty: ratio >= S.bigSpikeRatio ? S.bigSpikePenalty : S.spikePenalty,
    });
  }

  // Following far more accounts than follow them back
  const followRatio = c.followers ? live.following / c.followers : 0;
  if (live.following >= S.minFollowingToCheck && followRatio > S.followRatio) {
    reasons.push({
      text: `Follows ${fmt(live.following)} accounts but has ${fmt(c.followers)} followers, a pattern often seen with follow-for-follow growth, so signals look unusual.`,
      evidence: `following ÷ followers = ${round1(followRatio)} · unusual above ${S.followRatio}`,
      direction: "warning",
      penalty: followRatio > S.bigFollowRatio ? S.bigFollowPenalty : S.followPenalty,
    });
  }

  return { thin: null, reasons };
}
