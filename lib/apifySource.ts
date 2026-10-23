// The live data source: finds real public Instagram creators for a brief through Apify.
// Server only (called from app/api/creators). lib/creatorSource.ts decides when it's used.
import type { Brief } from "./brief";
import type { Creator } from "./creatorSource";
import { ApifyError, readCache, runActor, writeCache } from "./apify";
import { looksLikeCreator, toCreator, type RawComment, type RawProfile } from "./fromInstagram";
import { hashtagsFor, searchKey } from "./searchTerms";
import { tierFor } from "./score";

// ---- Hard limits for one brand search ----
export const LIMITS = {
  postsPerHashtag: 40, // up to 4 hashtags, so at most 160 posts
  maxPosts: 160,
  maxProfiles: 50, // candidate profiles (each comes with its latest 12 posts)
  maxCommentPulls: 30, // only when APIFY_COMMENTS=on: best 30 creators…
  commentPostsEach: 2, // …2 posts each…
  commentsPerPost: 10, // …10 comments per post (at most 600 comments)
  totalSeconds: 110, // the whole search, so it finishes in under 2 minutes
  findSeconds: 45, // the hashtag step's share
  // Cost caps per step (USD), a little above the expected Free-plan cost
  maxChargeUsd: { posts: 0.5, profiles: 0.2, comments: 1.7 },
};

const HASHTAG_ACTOR = "apify~instagram-hashtag-scraper";
const PROFILE_ACTOR = "apify~instagram-profile-scraper";
const COMMENT_ACTOR = "apify~instagram-comment-scraper";

export type Stage = "finding" | "checking" | "scoring";
export type SearchResult = { creators: Creator[]; collectedAt: string; cached: boolean; hashtags: string[] };

type RawPost = { ownerUsername?: string; likesCount?: number };
type RawCommentRow = RawComment & { postUrl?: string; inputUrl?: string };

export async function searchCreators(brief: Brief, onStage: (s: Stage) => void): Promise<SearchResult> {
  const hashtags = hashtagsFor(brief);
  const key = searchKey(brief);
  const cached = await readCache<{ creators: Creator[]; collectedAt: string }>(key);
  if (cached) return { ...cached.value, cached: true, hashtags };

  const start = Date.now();
  const deadline = start + LIMITS.totalSeconds * 1000;

  // 1. Find creators: recent public posts under the brand's hashtags
  onStage("finding");
  const posts = await runActor<RawPost>(
    HASHTAG_ACTOR,
    { hashtags, resultsLimit: LIMITS.postsPerHashtag, resultsType: "posts" },
    { maxItems: LIMITS.maxPosts, maxChargeUsd: LIMITS.maxChargeUsd.posts, deadline: start + LIMITS.findSeconds * 1000 },
  );
  // The accounts that post most under these hashtags (then by likes) come first
  const byOwner = new Map<string, { n: number; likes: number }>();
  for (const p of posts) {
    if (!p.ownerUsername) continue;
    const o = byOwner.get(p.ownerUsername) ?? { n: 0, likes: 0 };
    byOwner.set(p.ownerUsername, { n: o.n + 1, likes: o.likes + Math.max(0, p.likesCount ?? 0) });
  }
  const usernames = [...byOwner.entries()].sort((a, b) => b[1].n - a[1].n || b[1].likes - a[1].likes).map(([u]) => u).slice(0, LIMITS.maxProfiles);
  if (!usernames.length) throw new ApifyError("empty", `No public posts found for ${hashtags.map((h) => `#${h}`).join(", ")}`);

  // 2. Check profiles and their latest 12 posts
  onStage("checking");
  const profiles = await runActor<RawProfile>(
    PROFILE_ACTOR,
    { usernames },
    { maxItems: LIMITS.maxProfiles, maxChargeUsd: LIMITS.maxChargeUsd.profiles, deadline },
  );
  const real = profiles.filter(looksLikeCreator);
  if (!real.length) throw new ApifyError("empty", "No public creator accounts found (only shops, brands or private accounts)");

  // 3. Optional: read comments on 2 recent posts of the best 30 (off by default to save credits)
  const comments = new Map<string, RawComment[]>();
  if (process.env.APIFY_COMMENTS === "on" && deadline - Date.now() > 25_000) {
    const want = RANGE_ORDER.indexOf(brief.followerRange);
    const best = [...real]
      .sort((a, b) => Math.abs(RANGE_ORDER.indexOf(tierFor(a.followersCount ?? 0).name) - want) - Math.abs(RANGE_ORDER.indexOf(tierFor(b.followersCount ?? 0).name) - want))
      .slice(0, LIMITS.maxCommentPulls);
    const urls = best.flatMap((p) => (p.latestPosts ?? []).filter((x) => !x.isPinned && x.url).slice(0, LIMITS.commentPostsEach).map((x) => ({ url: x.url!, owner: p.username })));
    const owner = new Map(urls.map((u) => [u.url, u.owner]));
    try {
      const rows = await runActor<RawCommentRow>(
        COMMENT_ACTOR,
        { directUrls: urls.map((u) => u.url), resultsLimit: LIMITS.commentsPerPost },
        { maxItems: urls.length * LIMITS.commentsPerPost, maxChargeUsd: LIMITS.maxChargeUsd.comments, deadline },
      );
      for (const r of rows) {
        const who = owner.get(r.postUrl ?? r.inputUrl ?? "");
        if (who) comments.set(who, [...(comments.get(who) ?? []), r]);
      }
    } catch {
      // comment quality just shows "Not available"
    }
  }

  onStage("scoring");
  const collectedAt = new Date();
  const creators = real.map((p) => toCreator(p, collectedAt, comments.get(p.username)));
  const result = { creators, collectedAt: collectedAt.toISOString() };
  await writeCache(key, result);
  return { ...result, cached: false, hashtags };
}

const RANGE_ORDER = ["nano", "micro", "mid", "macro"];
