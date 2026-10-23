// The one place Gemini is called from (server only). The key comes from
// GEMINI_API_KEY in .env.local, so it never reaches the browser.
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";

// Change the model here. Check the current names at ai.google.dev/gemini-api/docs/models
export const GEMINI_MODEL = "gemini-3.8-flash";

export type GeminiFailure = "no_key" | "bad_key" | "timeout" | "bad_reply" | "api_error";

export class GeminiError extends Error {
  constructor(public reason: GeminiFailure, message: string) {
    super(message);
  }
}

export const hasGeminiKey = () => Boolean(process.env.GEMINI_API_KEY);

// Asks Gemini for JSON in the given shape, and checks the reply against that shape.
export async function askGeminiJson<T extends z.ZodType>(
  options: { system: string; prompt: string; schema: T; timeoutMs: number },
): Promise<z.infer<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError("no_key", "No GEMINI_API_KEY set in .env.local");

  const ai = new GoogleGenAI({ apiKey });
  const signal = AbortSignal.timeout(options.timeoutMs);
  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: options.prompt,
      config: {
        systemInstruction: options.system,
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(options.schema),
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }, // rewording needs no reasoning; keeps replies fast
        abortSignal: signal,
      },
    });
    text = response.text;
  } catch (error) {
    if (signal.aborted) throw new GeminiError("timeout", `Gemini took longer than ${options.timeoutMs / 1000} seconds`);
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403 || /api key/i.test(error.message)) {
        throw new GeminiError("bad_key", "The GEMINI_API_KEY in .env.local was rejected");
      }
      throw new GeminiError("api_error", `Gemini API error ${error.status}`);
    }
    throw new GeminiError("api_error", "Couldn't reach Gemini");
  }

  try {
    return options.schema.parse(JSON.parse(text ?? ""));
  } catch {
    throw new GeminiError("bad_reply", "Gemini didn't return usable JSON");
  }
}
