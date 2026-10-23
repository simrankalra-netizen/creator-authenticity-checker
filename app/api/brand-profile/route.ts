// Step 4: builds the Brand Profile from the brand's website (or, if it can't
// be read, from the user's own description). Gemini fills in the fields;
// lib/brandProfile.ts checks every answer against the text before it's shown.
import { z } from "zod";
import { askGeminiJson, GeminiError, hasGeminiKey } from "@/lib/gemini";
import { readSite, type SitePage, type Price } from "@/lib/readSite";
import { checkProfile, promptFor, PROFILE_FIELDS, SYSTEM, type FieldKey, type RawField } from "@/lib/brandProfile";

export const maxDuration = 60; // reading pages + one Gemini call; the screen gives up at 45 s

const Field = z.object({
  value: z.string(),
  evidence_page: z.string(),
  evidence_quote: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  clear: z.boolean(),
});
const ProfileSchema = z.object(
  Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, Field])) as Record<FieldKey, typeof Field>,
);

const error = (message: string, status: number, reason?: string) => Response.json({ error: message, reason }, { status });

export async function POST(request: Request) {
  const { link, description } = (await request.json()) as { link?: string; description?: string };

  let pages: SitePage[];
  let prices: Price[] = [];
  let source: "website" | "description";
  if (description !== undefined) {
    const text = description.trim();
    if (text.length < 20) return error("Write a sentence or two about your brand (at least 20 characters).", 400);
    pages = [{ label: "Your description", url: "", text: text.slice(0, 3_000) }];
    source = "description";
  } else {
    const site = await readSite(link ?? "");
    if (!site.ok) return error(site.message, 422, site.reason);
    ({ pages, prices } = site);
    source = "website";
  }

  if (!hasGeminiKey()) {
    return error("We can't build the brand profile right now (AI isn't set up). Please try again later.", 503, "no_key");
  }
  try {
    const reply = await askGeminiJson({
      system: SYSTEM,
      prompt: promptFor(pages, prices),
      schema: ProfileSchema,
      timeoutMs: 30_000,
    });
    const profile = checkProfile(reply as Record<FieldKey, RawField>, pages, prices, source);
    if (Object.values(profile.fields).every((f) => !f.clear)) {
      return error(
        source === "website"
          ? "Your website doesn't say enough about the brand to build a profile. Describe your brand below instead."
          : "Your description doesn't say enough to build a profile. Add what you sell and who buys it.",
        422,
        "nothing_clear",
      );
    }
    return Response.json({ profile });
  } catch (e) {
    if (e instanceof GeminiError && e.reason === "timeout") {
      return error("Building the profile took too long. Try again, or describe your brand instead.", 504);
    }
    return error("We couldn't build a brand profile right now. Try again, or describe your brand instead.", 502);
  }
}
