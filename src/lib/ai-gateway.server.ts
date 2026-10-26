// Server-only helper for the Lovable AI Gateway (Gemini via Chat Completions, streamed).
export const OCR_MODEL = "google/gemini-3.8-flash";
export const TRANSLATION_MODEL = "google/gemini-3.8-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Content =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

export async function streamChat(opts: {
  model: string;
  system: string;
  user: Content;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError("The AI service is not configured. An administrator must add the AI key in Lovable Cloud.", 500);

  let res: Response;
  try {
    res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: opts.model,
        stream: true,
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
        },
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
    });
  } catch {
    throw new AiError("Could not reach the AI service. Check your connection and try again.", 503);
  }

  if (!res.ok) {
    let msg = "";
    try {
      const j = (await res.json()) as { error?: { message?: string }; message?: string };
      msg = j.error?.message ?? j.message ?? "";
    } catch {
      /* ignore */
    }
    const map: Record<number, string> = {
      400: "The AI service rejected the request (the image may be unsupported or too large).",
      401: "The AI service key is invalid. An administrator must reconfigure it.",
      402: "AI credits are exhausted for this workspace. Add credits to continue.",
      403: "AI access is currently blocked for this workspace.",
      429: "Too many requests right now. Please wait a moment and try again.",
    };
    throw new AiError(msg || map[res.status] || "The AI service is temporarily unavailable. Please retry shortly.", res.status);
  }
  if (!res.body) throw new AiError("Empty response from the AI service.", 502);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          error?: { message?: string };
        };
        if (j.error) throw new AiError(j.error.message ?? "AI stream error", 502);
        out += j.choices?.[0]?.delta?.content ?? "";
      } catch (e) {
        if (e instanceof AiError) throw e;
      }
    }
  }
  return out;
}

export function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
    throw new AiError("The AI returned an invalid response. Please retry.", 502);
  }
}
