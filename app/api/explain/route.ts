// The only place Claude is called. It runs on the server, so the API key
// (from .env.local) never reaches the browser. Claude only rewords reasons
// that the code already chose; it never sees or changes how scores are made.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

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
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "No API key set in .env.local" }, { status: 503 });
  }
  const { creators } = (await request.json()) as { creators: InputCreator[] };
  if (!Array.isArray(creators) || creators.length === 0) {
    return Response.json({ creators: [] });
  }

  const client = new Anthropic({ timeout: 15_000, maxRetries: 0 });
  try {
    const response = await client.beta.messages.parse({
      model: "claude-sonnet-5-5",
      max_tokens: 16000,
      output_config: { effort: "low", format: betaZodOutputFormat(ReplySchema) },
      // If Claude declines, the API retries on a fallback model automatically.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(creators, null, 1) }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return Response.json({ error: "Claude didn't return usable wording" }, { status: 502 });
    }
    return Response.json(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "The API key in .env.local was rejected" }, { status: 502 });
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return Response.json({ error: "Claude took longer than 15 seconds" }, { status: 504 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `Claude API error ${error.status ?? ""}`.trim() }, { status: 502 });
    }
    return Response.json({ error: "Couldn't reach Claude" }, { status: 502 });
  }
}
