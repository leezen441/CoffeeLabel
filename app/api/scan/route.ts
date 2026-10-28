import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SYSTEM_PROMPT, ScanSchema, exampleTurns } from "@/lib/scanRules";

export const dynamic = "force-dynamic";
/** A photo takes a few seconds to read; the Vercel default is shorter. */
export const maxDuration = 60;

/**
 * Haiku reads these labels well enough and costs a fraction of a baht a photo.
 * Set SCAN_MODEL to claude-opus-5-5 if handwriting or dim tins start coming
 * back wrong — nothing else has to change.
 */
const MODEL = process.env.SCAN_MODEL || "claude-haiku-5-5";

const MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type Media = (typeof MEDIA)[number];

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "no-key" }, { status: 503 });
  }

  let image: unknown;
  let hints: unknown;
  try {
    ({ image, hints } = await request.json());
  } catch {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }
  if (typeof image !== "string") {
    return Response.json({ error: "bad-request" }, { status: 400 });
  }

  // A data URL from the browser: "data:image/jpeg;base64,...."
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match || !MEDIA.includes(match[1] as Media)) {
    return Response.json({ error: "bad-image" }, { status: 400 });
  }
  const [, mediaType, data] = match;

  // ~4 MB of base64 is ~3 MB of photo, well past what the label needs.
  if (data.length > 4_000_000) {
    return Response.json({ error: "too-large" }, { status: 413 });
  }

  const corrections =
    Array.isArray(hints) && hints.length > 0
      ? `\n\nThis person has corrected earlier scans. Apply the same reading here when it fits:\n${hints
          .filter((h): h is string => typeof h === "string")
          .slice(0, 20)
          .map((h) => `- ${h}`)
          .join("\n")}`
      : "";

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      // A short extraction; the depth goes into the rules, not the reasoning.
      output_config: { effort: "low", format: zodOutputFormat(ScanSchema) },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // The rules and examples are the same on every scan.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        ...exampleTurns(),
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as Media, data } },
            {
              type: "text",
              text: `Read this bag label into the fields.${corrections}`,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refused" }, { status: 422 });
    }
    if (!response.parsed_output) {
      return Response.json({ error: "unreadable" }, { status: 422 });
    }
    return Response.json({ label: response.parsed_output });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "bad-key" }, { status: 503 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "rate-limited" }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: "api", message: err.message }, { status: 502 });
    }
    return Response.json({ error: "unknown", message: String(err) }, { status: 500 });
  }
}
