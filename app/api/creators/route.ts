// Finds creators for a brief. DATA_SOURCE in .env.local picks the source:
// "demo" (default) = the made-up demo creators; "apify" = real public Instagram data via Apify.
// The reply is a stream of JSON lines, so the screen can show real progress:
//   {"type":"stage","stage":"finding"} … {"type":"done",...} or {"type":"error",...}
import type { Brief } from "@/lib/brief";
import { ApifyError, hasApifyToken } from "@/lib/apify";
import { searchCreators } from "@/lib/apifySource";

export const maxDuration = 150; // the search itself stops at 110 seconds

export async function POST(request: Request) {
  const { brief } = (await request.json()) as { brief: Brief };
  const encoder = new TextEncoder();
  const line = (o: unknown) => encoder.encode(JSON.stringify(o) + "\n");

  if (process.env.DATA_SOURCE !== "apify") {
    return new Response(line({ type: "done", source: "demo" }), { headers: { "Content-Type": "application/x-ndjson" } });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!hasApifyToken()) throw new ApifyError("no_token", "No APIFY_TOKEN set in .env.local");
        const result = await searchCreators(brief, (stage) => controller.enqueue(line({ type: "stage", stage })));
        controller.enqueue(line({ type: "done", source: "live", ...result }));
      } catch (e) {
        const reason = e instanceof ApifyError ? e.reason : "failed";
        const message = e instanceof ApifyError ? e.message : "Something went wrong while collecting creators";
        controller.enqueue(line({ type: "error", reason, message }));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
