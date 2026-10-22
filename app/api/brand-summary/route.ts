// Step 4: reads the brand's website and asks Claude for a 2-line summary of
// what it sells and who to. If the page can't be read, or the page doesn't
// say, it returns an error so the user types a description. Never guesses.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { readPage } from "@/lib/readPage";

const SummarySchema = z.object({
  enough_info: z.boolean(),
  sells: z.string(),
  sells_to: z.string(),
});

const SYSTEM = `You summarise a brand's website for a marketing tool.
From the page text only, say in plain words:
- sells: what the brand sells (one short sentence)
- sells_to: who it sells to (one short sentence)
Rules:
- Use only what the page text says. Do not guess or add facts.
- If the page doesn't make clear what the brand sells, set enough_info to false and leave both fields empty.
- If it says what they sell but not who to, write "Not stated on the website" for sells_to.`;

const fallback = (message: string, status = 422) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  const { link } = (await request.json()) as { link: string };
  const page = await readPage(link ?? "");
  if (!page.ok) return Response.json({ error: page.message, reason: page.reason }, { status: 422 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return fallback("We read your website but can't summarise it right now (AI isn't set up). Describe your brand below instead.", 503);
  }
  const client = new Anthropic({ timeout: 20_000, maxRetries: 0 });
  try {
    const response = await client.beta.messages.parse({
      model: "claude-sonnet-5-5",
      max_tokens: 2000,
      output_config: { effort: "low", format: betaZodOutputFormat(SummarySchema) },
      // If Claude declines, the API retries on a fallback model automatically.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: `Page title: ${page.title}\n\nPage text:\n${page.text}` }],
    });
    const out = response.parsed_output;
    if (response.stop_reason === "refusal" || !out) {
      return fallback("We couldn't summarise your website. Describe your brand below instead.", 502);
    }
    // Check the reply before using it: no summary beats an invented one
    if (!out.enough_info || !out.sells.trim()) {
      return fallback("Your website doesn't say clearly what the brand sells. Describe your brand below instead.");
    }
    return Response.json({ summary: `Sells: ${out.sells.trim()}\nSells to: ${out.sells_to.trim()}`, url: page.url });
  } catch {
    return fallback("We couldn't summarise your website right now. Describe your brand below instead.", 502);
  }
}
