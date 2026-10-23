// Automatic checks for live Instagram data: search terms, mapping and the extra checks. Run with: npm test
import { describe, expect, it } from "vitest";
import { EMPTY_BRIEF, type Brief } from "./brief";
import { hashtagsFor } from "./searchTerms";
import { commentQuality, looksLikeCreator, toCreator, type RawPost, type RawProfile } from "./fromInstagram";
import { authenticity, brandFit } from "./creatorScores";
import { topCreators } from "./ranking";

const NOW = new Date("2026-10-23T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const posts = (likes: number[], comments = 40): RawPost[] =>
  likes.map((l, i) => ({ likesCount: l, commentsCount: comments, timestamp: daysAgo(3 + i * 4), caption: "My skincare routine #skincare #serum", url: `https://www.instagram.com/p/x${i}/` }));
const profile = (over: Partial<RawProfile> = {}): RawProfile => ({
  username: "glow.with.riya",
  fullName: "Riya",
  biography: "Skincare for oily skin · Mumbai",
  followersCount: 40_000,
  followsCount: 600,
  postsCount: 320,
  latestPosts: posts([1200, 1100, 1300, 1000, 1250, 1150, 1050, 1220, 1180, 1120, 1210, 1160]),
  ...over,
});
const brief = (p: Partial<Brief>): Brief => ({ ...EMPTY_BRIEF, niche: "Beauty", influencerNiche: "Skincare", followerRange: "micro", ...p });

describe("hashtags from the brief", () => {
  it("uses niche and city", () => {
    expect(hashtagsFor(brief({ locationMode: "specific", location: "Mumbai" }))).toEqual(["mumbaiskincare", "skincaremumbai", "mumbaibeautyblogger", "skincareindia"]);
  });
  it("uses India-wide tags for anywhere or India", () => {
    expect(hashtagsFor(brief({ niche: "Fashion", influencerNiche: "Fashion", locationMode: "specific", location: "India" }))[0]).toBe("fashionindia");
    expect(hashtagsFor(brief({ niche: "Fitness", influencerNiche: "Fitness" }))).toHaveLength(4);
  });
});

describe("raw Instagram data to a creator", () => {
  it("maps real numbers and leaves the unknowns empty", () => {
    const c = toCreator(profile(), NOW);
    expect(c).toMatchObject({ handle: "glow.with.riya", niche: "Beauty", city: "Mumbai", followers: 40_000, avgComments: 40, source: "live" });
    expect(c.avgLikes).toBe(1162);
    expect(c.audienceAge).toBeNull();
    expect(c.audienceTopCities).toBeNull();
    expect(c.ratePerPost).toBeNull();
    expect(c.followerHistory).toEqual([]);
    expect(c.live!.postsChecked).toBe(12);
  });

  it("skips hidden likes, pinned posts and posts under a day old", () => {
    const p = profile({
      latestPosts: [
        { likesCount: -1, commentsCount: 5, timestamp: daysAgo(2) },
        { likesCount: 90_000, commentsCount: 900, timestamp: daysAgo(400), isPinned: true },
        { likesCount: 30, commentsCount: 1, timestamp: daysAgo(0.2) },
        ...posts([1000, 1000, 1000, 1000, 1000, 1000]),
      ],
    });
    const c = toCreator(p, NOW);
    expect(c.live!.postsChecked).toBe(6);
    expect(c.live!.hiddenLikePosts).toBe(1);
    expect(c.avgLikes).toBe(1000);
  });

  it("leaves out private accounts, tiny accounts and shops", () => {
    expect(looksLikeCreator(profile())).toBe(true);
    expect(looksLikeCreator(profile({ private: true }))).toBe(false);
    expect(looksLikeCreator(profile({ followersCount: 400 }))).toBe(false);
    expect(looksLikeCreator(profile({ isBusinessAccount: true, businessCategoryName: "Shopping & retail" }))).toBe(false);
    expect(looksLikeCreator(profile({ isBusinessAccount: true, businessCategoryName: "Digital creator" }))).toBe(true);
  });

  it("spots generic, emoji-only and repeated comments", () => {
    const q = commentQuality(
      [{ text: "nice pic" }, { text: "🔥🔥" }, { text: "Which serum is this? My skin is so dry" }, { text: "nice pic" }, { text: "thanks!", ownerUsername: "glow.with.riya" }],
      "glow.with.riya",
    );
    expect(q).toEqual({ checked: 4, generic: 2, repeated: 1 });
  });
});

describe("authenticity on live data", () => {
  it("scores without follower history instead of saying not enough data", () => {
    const a = authenticity(toCreator(profile(), NOW));
    expect(a.status).toBe("scored");
  });

  it("says not enough data with fewer than 6 usable posts", () => {
    const a = authenticity(toCreator(profile({ latestPosts: posts([1000, 1000, 1000]) }), NOW));
    expect(a).toMatchObject({ status: "not_enough_data" });
    if (a.status === "not_enough_data") expect(a.why).toContain("Only 3 recent posts");
  });

  it("flags one post with far more likes, without calling anyone fake", () => {
    const a = authenticity(toCreator(profile({ latestPosts: posts([15_000, 1000, 1100, 900, 1000, 1050, 950, 1000]) }), NOW));
    expect(a.status).toBe("scored");
    if (a.status !== "scored") return;
    const spike = a.reasons.find((r) => r.text.includes("typical post"));
    expect(spike?.direction).toBe("warning");
    for (const r of a.reasons) expect(r.text).not.toMatch(/fake|bought|bots?\b/i);
  });

  it("flags following far more accounts than follow back", () => {
    const a = authenticity(toCreator(profile({ followersCount: 4000, followsCount: 7500, latestPosts: posts([200, 210, 190, 205, 195, 200], 8) }), NOW));
    expect(a.status === "scored" && a.reasons.some((r) => r.text.includes("follow-for-follow"))).toBe(true);
  });
});

describe("brand fit uses only what was collected", () => {
  it("marks audience age, budget and audience location as not available", () => {
    const c = toCreator(profile(), NOW);
    const fit = brandFit(c, brief({ targetAge: "18-24", budget: "5000", locationMode: "specific", location: "Mumbai" }));
    const part = (l: string) => fit.parts.find((p) => p.label === l)!;
    expect(part("Audience age").counted).toBe(false);
    expect(part("Budget").counted).toBe(false);
    expect(part("Location").note).toBe("Creator is based in Mumbai (audience location not available)");
  });

  it("doesn't mark live creators outside the location or over budget", () => {
    const list = topCreators([toCreator(profile(), NOW)], brief({ budget: "5000", locationMode: "specific", location: "Mumbai" }), "sales");
    expect(list.top[0].outside).toEqual([]);
  });
});
