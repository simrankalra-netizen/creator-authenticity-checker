// Automatic checks for the 3 MVP tests. Run with: npm test
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCreators, parseSales } from "./parseCsv";
import { scoreCreator, type ScoredCreator } from "./score";
import { scoreSalesMatch, spearman } from "./predict";
import { checkAiReasons, checkAiReply } from "./checkAi";

const read = (path: string) => readFileSync(path, "latin1");
const FAKES = [
  "luxe_lifestyle_daily", "fitfam_fashion_hub", "glowup_guru_official",
  "trendy_tanya_style", "the_viral_vibes", "makeup_by_kiara_x",
];
const THIN = ["new_creator_neha", "photowalk_pratik", "quiet_crafts_corner", "street_food_sam"];

function sampleResults() {
  const parsed = parseCreators(read("samples/creators.csv"), "creators.csv");
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  return parsed.rows.map(scoreCreator);
}

describe("Test 1: 30 creators get a score, confidence and 2 reasons", () => {
  it("scores every creator with enough data", () => {
    const results = sampleResults();
    expect(results).toHaveLength(30);
    for (const r of results.filter((r) => r.status === "scored")) {
      const s = r as ScoredCreator;
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      expect(["High", "Medium", "Low"]).toContain(s.confidence);
      expect(s.reasons).toHaveLength(2);
      expect(s.reasons.every((x) => x.text.length > 0 && x.evidence.length > 0)).toBe(true);
    }
  });

  it("gives every planted fake a lower score than every normal creator", () => {
    const scored = sampleResults().filter((r): r is ScoredCreator => r.status === "scored");
    const fakes = scored.filter((r) => FAKES.includes(r.handle));
    const normal = scored.filter((r) => !FAKES.includes(r.handle));
    expect(fakes).toHaveLength(6);
    expect(normal).toHaveLength(20);
    expect(Math.max(...fakes.map((r) => r.score))).toBeLessThan(Math.min(...normal.map((r) => r.score)));
  });

  it("grades genuine creators instead of giving them all 100", () => {
    const normal = sampleResults().filter(
      (r): r is ScoredCreator => r.status === "scored" && !FAKES.includes(r.handle),
    );
    const scores = normal.map((r) => r.score);
    expect(new Set(scores).size).toBeGreaterThanOrEqual(8);
    expect(scores.filter((s) => s === 100).length).toBeLessThanOrEqual(2);
  });

  it("accepts everyday column names", () => {
    const parsed = parseCreators(
      "Username,Followers,Likes,Comments,Follower Growth (%)\n@riya,24000,980,45,3.1",
      "natural.csv",
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(scoreCreator(parsed.rows[0]).status).toBe("scored");
      expect(parsed.notes.join(" ")).toContain("No days-of-data column");
    }
  });

  it("notes columns it ignored", () => {
    const parsed = parseCreators("handle,followers,likes,comments,growth,city\n@riya,24000,980,45,3.1,Pune", "x.csv");
    expect(parsed.ok && parsed.notes).toContain("Ignored column: city.");
  });
});

describe("Test 2: scores next to sales, plus one number", () => {
  it("is 1 for identical rankings and -1 for reversed ones", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
  });

  it("matches the sample sales and counts skipped creators", () => {
    const sales = parseSales(read("samples/sales.csv"), "sales.csv");
    if (!sales.ok) throw new Error(sales.errors.join("\n"));
    const match = scoreSalesMatch(sampleResults(), sales.rows);
    expect(match.ok).toBe(true);
    if (match.ok) {
      expect(match.compared).toBe(25); // 30 - 4 not enough data - 1 with no sales row
      expect(match.skipped).toBe(5);
      expect(match.label).toBe("strong");
    }
  });

  it("accepts promo code / link sales column names", () => {
    for (const header of ["promo_code_sales", "Link Sales", "sales"]) {
      const parsed = parseSales(`handle,${header}\n@riya,12`, "s.csv");
      expect(parsed.ok).toBe(true);
    }
  });

  it("refuses to give a number with fewer than 5 matches", () => {
    const match = scoreSalesMatch(sampleResults(), [{ handle: "masala_mornings", orders: 3 }]);
    expect(match.ok).toBe(false);
  });
});

describe("Test 3: bad files give clear errors and no scores", () => {
  const cases: [string, string][] = [
    ["samples/bad/empty.csv", "no creator rows"],
    ["samples/bad/missing-column.csv", "Missing column for comments"],
    ["samples/bad/bad-number.csv", "Row 3, followers: 'abc' is not a number"],
    ["samples/bad/not-a-csv.xlsx", "Couldn't read this file"],
  ];
  for (const [file, message] of cases) {
    it(`rejects ${file}`, () => {
      const parsed = parseCreators(read(file), file);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.errors.join(" ")).toContain(message);
    });
  }

  it("names the negative number too", () => {
    const parsed = parseCreators(read("samples/bad/bad-number.csv"), "bad-number.csv");
    if (!parsed.ok) expect(parsed.errors).toContain("Row 4, likes: '-50' can't be negative.");
  });

  it("shows 'not enough data' for a creator with only 2 days of data", () => {
    const parsed = parseCreators(
      "handle,followers,likes,comments,growth,days_of_data\n@fresh_face_fiza,18000,210,1,0.3,2\n@riya,24000,980,45,3.1,30",
      "two-days.csv",
    );
    if (!parsed.ok) throw new Error(parsed.errors.join());
    const [fiza, riya] = parsed.rows.map(scoreCreator);
    expect(fiza).toMatchObject({ status: "not_enough_data", why: "Only 2 days of data (needs 7 or more)" });
    expect(riya.status).toBe("scored");
  });

  it("shows 'not enough data' for the 4 thin creators instead of a score", () => {
    const thin = sampleResults().filter((r) => r.status === "not_enough_data").map((r) => r.handle);
    expect(thin.sort()).toEqual([...THIN].sort());
  });
});

describe("AI wording checks", () => {
  const creator = sampleResults().find((r) => r.handle === "luxe_lifestyle_daily") as ScoredCreator;
  const [a, b] = creator.reasons;

  it("accepts rounded numbers from the data", () => {
    const v = checkAiReasons(creator, {
      handle: creator.handle,
      reasons: [
        { text: `${a.text.replace(/\d+\.\d+/, (n) => String(Math.round(Number(n) * 10) / 10))}`, direction: a.direction },
        { text: b.text, direction: b.direction },
      ],
    });
    expect(v.ok).toBe(true);
  });

  it("rejects an invented number", () => {
    const v = checkAiReasons(creator, {
      handle: creator.handle,
      reasons: [
        { text: "About 73% of these followers are bots.", direction: a.direction },
        { text: b.text, direction: b.direction },
      ],
    });
    expect(v).toEqual({ ok: false, note: "AI wording rejected: used a number not in your data" });
  });

  it("rejects wording whose tone contradicts the check", () => {
    const v = checkAiReasons(creator, {
      handle: creator.handle,
      reasons: [
        { text: "Engagement looks great.", direction: "good" },
        { text: b.text, direction: b.direction },
      ],
    });
    expect(v.ok).toBe(false);
  });

  it("flags creators missing from the AI reply", () => {
    const { verdicts } = checkAiReply([creator], []);
    expect(verdicts.get(creator.handle)?.ok).toBe(false);
  });
});
