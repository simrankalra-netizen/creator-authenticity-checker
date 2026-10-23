// Gemini rewords the reasons on the CSV checker. It runs on the server, so the
// API key (from .env.local) never reaches the browser. Gemini only rewords reasons
// that the code already chose; it never sees or changes how scores are made.
import { z } from "zod";
import { askGeminiJson, GeminiError, hasGeminiKey } from "@/lib/gemini";

const ReplySchema = z.object({
  creators: z.array(
    z.object({
      handle: z.string(),
      reasons: z.array(z.object({ text: z.string(), direction: z.enum(["good", "warning"]) })),
    }),
  ),
});

type InputCreator = {
  handle: string;
  tier: string;
  score: number;
  reasons: { code: string; direction: string; evidence: string; text: string }[];
};

const SYSTEM = `You help a brand marketer at a small consumer brand in India decide whether an influencer's audience is genuine.
For each creator you get 2 reasons that a scoring program already chose, each with its numbers and a draft sentence.
Rewrite each reason as one short, plain sentence (under 30 words) the marketer would understand.
Rules:
- Keep the same 2 reasons in the same order. Do not add, drop or merge reasons.
- Use only numbers that appear in that creator's data. You may round them. Do not calculate new numbers.
- Do not mention or change the score.
- For each sentence, return "direction": "good" if it's a good sign, "warning" if it's a warning sign.
- Return every creator exactly once, with the handle exactly as given.`;

export async function POST(request: Request) {
  if (!hasGeminiKey()) {
    return Response.json({ error: "No API key set in .env.local" }, { status: 503 });
  }
  const { creators } = (await request.json()) as { creators: InputCreator[] };
  if (!Array.isArray(creators) || creators.length === 0) {
    return Response.json({ creators: [] });
  }

  try {
    const reply = await askGeminiJson({
      system: SYSTEM,
      prompt: JSON.stringify(creators, null, 1),
      schema: ReplySchema,
      timeoutMs: 15_000,
    });
    return Response.json(reply);
  } catch (error) {
    const message = error instanceof GeminiError ? error.message : "Couldn't reach Gemini";
    const status = error instanceof GeminiError && error.reason === "timeout" ? 504 : 502;
    return Response.json({ error: message }, { status });
  }
}
