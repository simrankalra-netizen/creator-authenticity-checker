// Automatic checks for the Step 5 niche suggestion. Run with: npm test
import { describe, expect, it } from "vitest";
import { looksLikeLink, suggestNicheFromText } from "./nicheSuggest";

describe("niche suggestion from the description", () => {
  it("matches your examples", () => {
    expect(suggestNicheFromText("We sell a vitamin C serum and sunscreen")?.niche).toBe("Beauty");
    expect(suggestNicheFromText("Protein bars for people who go to the gym")?.niche).toBe("Fitness");
    expect(suggestNicheFromText("Handmade kurtas and streetwear for Gen Z")?.niche).toBe("Fashion");
  });

  it("lists the words it matched, and handles plurals", () => {
    expect(suggestNicheFromText("Serums and moisturisers for oily skin")).toEqual({ niche: "Beauty", matched: ["serum", "moisturiser"] });
  });

  it("picks the niche with the most matches", () => {
    expect(suggestNicheFromText("Skincare, serum and face wash, plus one gym bag")?.niche).toBe("Beauty");
  });

  it("doesn't match words hidden inside other words", () => {
    expect(suggestNicheFromText("We are a happy team building planetary mapping")).toBeNull(); // not "app", "plant"
  });

  it("suggests nothing when no keyword matches", () => {
    expect(suggestNicheFromText("We help small businesses with accounting.")).toBeNull();
  });
});

describe("website link check (never blocks)", () => {
  it("accepts common links and empty", () => {
    for (const ok of ["", "dewdrop.in", "https://www.dewdrop.in/shop", "instagram.com/dewdrop"]) expect(looksLikeLink(ok)).toBe(true);
  });
  it("flags things that aren't links", () => {
    expect(looksLikeLink("my brand")).toBe(false);
  });
});
