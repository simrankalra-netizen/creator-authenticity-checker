// Automatic checks for "Your top 10 creators". Run with: npm test
import { describe, expect, it } from "vitest";
import demo from "../data/demo-creators.json";
import { EMPTY_BRIEF, type Brief } from "./brief";
import { topCreators, scoreAll, LOW_AUTHENTICITY } from "./ranking";
import { authenticity, biggest30DayGrowth, brandFit, NICHE_MISMATCH_CAP } from "./creatorScores";
import type { Creator } from "./creatorSource";

const creators = demo as (Creator & { demoKind: string })[];
const SUSPICIOUS = ["fewcomments", "jump", "repetitive"];
const THIN = ["tiny", "new", "blank"];
const kindOf = (id: string) => creators.find((c) => c.id === id)!.demoKind;

const BRANDS: Record<string, Partial<Brief>> = {
  "skincare, sales, Mumbai": { niche: "Beauty", influencerNiche: "Skincare", targetAge: "25-34", locationMode: "specific", location: "Mumbai", goal: "sales", followerRange: "micro", budget: "25000", platform: "Instagram" },
  "fashion, reach, anywhere in India": { niche: "Fashion", influencerNiche: "Fashion", targetAge: "18-24", locationMode: "specific", location: "India", goal: "awareness", followerRange: "mid", budget: "", platform: "Instagram" },
  "fitness, small budget": { niche: "Fitness", influencerNiche: "Fitness", targetAge: "25-34", locationMode: "anywhere", location: "", goal: "audience", followerRange: "nano", budget: "5000", platform: "Instagram" },
};
const brief = (name: string) => ({ ...EMPTY_BRIEF, ...BRANDS[name] }) as Brief;

describe("the demo data", () => {
  it("has 100 creators with the planned mix", () => {
    expect(creators).toHaveLength(100);
    expect(creators.filter((c) => c.demoKind === "honest")).toHaveLength(65);
    expect(creators.filter((c) => SUSPICIOUS.includes(c.demoKind))).toHaveLength(20);
    expect(creators.filter((c) => THIN.includes(c.demoKind))).toHaveLength(15);
    expect(creators.every((c) => c.handle.endsWith(".demo"))).toBe(true);
  });
});

describe("authenticity", () => {
  it("shows 'Not enough data' for every thin-data creator, never a score", () => {
    for (const c of creators.filter((x) => THIN.includes(x.demoKind))) {
      expect(authenticity(c).status, c.handle).toBe("not_enough_data");
    }
  });

  it("scores every suspicious creator below every honest one", () => {
    const score = (c: Creator) => { const a = authenticity(c); return a.status === "scored" ? a.score : NaN; };
    const sus = creators.filter((c) => SUSPICIOUS.includes(c.demoKind)).map(score);
    const honest = creators.filter((c) => c.demoKind === "honest").map(score);
    expect(Math.max(...sus)).toBeLessThan(Math.min(...honest));
  });

  it("spots a sudden follower jump in the weekly history", () => {
    expect(biggest30DayGrowth([1000, 1010, 1020, 1030, 1800, 1810])).toBeGreaterThan(70);
    expect(biggest30DayGrowth([1000])).toBeNull();
  });
});

describe("Brand Fit", () => {
  it("caps creators outside the brand's niche", () => {
    const tech = creators.find((c) => c.niche === "Tech")!;
    expect(brandFit(tech, brief("skincare, sales, Mumbai")).score).toBeLessThanOrEqual(NICHE_MISMATCH_CAP);
  });
});

describe.each(Object.keys(BRANDS))("brand: %s", (name) => {
  const b = brief(name);

  it("1. shows exactly 10 creators, ranked by the brand's goal", () => {
    for (const goal of ["sales", "reach", "fit"] as const) {
      const { top } = topCreators(creators, b, goal);
      expect(top).toHaveLength(10);
      expect(new Set(top.map((s) => s.creator.id)).size).toBe(10);
      const unwarned = top.filter((s) => !s.warning).map((s) => s.combined);
      expect(unwarned).toEqual([...unwarned].sort((x, y) => y - x)); // highest combined score first
    }
  });

  it("2. never shows low-authenticity creators without a warning, and flags the suspicious ones it shows", () => {
    for (const goal of ["sales", "reach", "fit"] as const) {
      for (const s of topCreators(creators, b, goal).top) {
        if (s.auth.status === "scored" && s.auth.score < LOW_AUTHENTICITY) expect(s.warning).not.toBeNull();
        if (SUSPICIOUS.includes(kindOf(s.creator.id))) expect(s.flags.length + (s.warning ? 1 : 0)).toBeGreaterThan(0);
        if (THIN.includes(kindOf(s.creator.id))) expect(s.auth.status).toBe("not_enough_data");
      }
    }
  });

  it("3. changing the goal changes the ranking", () => {
    const order = (goal: "sales" | "reach" | "fit") => topCreators(creators, b, goal).top.map((s) => s.creator.id).join();
    expect(new Set([order("sales"), order("reach"), order("fit")]).size).toBeGreaterThan(1);
  });
});

describe("filters", () => {
  it("keeps creators within budget unless it says why", () => {
    const b = brief("fitness, small budget");
    for (const s of topCreators(creators, b, "fit").top) {
      if ((s.creator.ratePerPost ?? 0) > 5000 * 1.25) expect(s.warning).toContain("over budget");
    }
  });

  it("scores all 100 creators in well under a second", () => {
    const t0 = performance.now();
    scoreAll(creators, brief("skincare, sales, Mumbai"), "sales");
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
