import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ocrResultSchema, translationSchema, type OcrResult, type TranslationResult } from "./inscription-types";

const OCR_PROMPT = `You are an expert assistant for Tamil epigraphy and historical inscription digitization. Carefully inspect the provided image. Transcribe only characters that are genuinely visible. Preserve line breaks and inscription order. Do not invent missing characters, words, names, dates, or historical facts. Distinguish modern Tamil script from historical scripts such as Tamil-Brahmi or Vatteluttu when there is sufficient visual evidence. If the script cannot be identified confidently, say so. Mark damaged or unreadable portions explicitly. Separate observed text from uncertain interpretations. Return the original visible inscription text, normalized modern Tamil text when justified, uncertainty annotations, and a brief description of image quality. Do not fabricate confidence percentages or claim that a model prediction is verified historical fact.

Mark unreadable spans inside the text as [...] and uncertain characters with a trailing "?". If no inscription text is readable, return empty originalText, empty lines, readable=false, and explain why in imageQuality. Respond only with JSON matching the schema.`;

const TRANSLATE_PROMPT = `Translate the supplied Tamil inscription text into clear, faithful English. Preserve names, places, dates, numbers, relationships, and the original meaning wherever identifiable. Do not invent historical context. Distinguish literal translation from interpretive explanation. Preserve uncertainty in the source text. If a word or passage is ambiguous, identify it instead of guessing. If the text is empty or unreadable, explain that a reliable translation is not possible. Return a literal English translation, a readable English rendering when appropriate, and notes about ambiguity. Respond only with JSON matching the schema.`;

const ocrJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["originalText", "normalizedTamil", "scriptType", "lines", "uncertainties", "imageQuality", "readable"],
  properties: {
    originalText: { type: "string" },
    normalizedTamil: { type: ["string", "null"] },
    scriptType: { type: "string" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "uncertain"],
        properties: { text: { type: "string" }, uncertain: { type: "boolean" } },
      },
    },
    uncertainties: { type: "array", items: { type: "string" } },
    imageQuality: { type: "string" },
    readable: { type: "boolean" },
  },
};

const translationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["literal", "readable", "notes", "uncertainPassages", "translatable"],
  properties: {
    literal: { type: "string" },
    readable: { type: "string" },
    notes: { type: "string" },
    uncertainPassages: { type: "array", items: { type: "string" } },
    translatable: { type: "boolean" },
  },
};

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string; retryable: boolean };

const MAX_DATA_URL = 12 * 1024 * 1024;

export const analyzeInscription = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        image: z
          .string()
          .max(MAX_DATA_URL, "Image payload too large")
          .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Invalid image format"),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Ok<OcrResult> | Err> => {
    const { streamChat, parseJson, AiError, OCR_MODEL } = await import("./ai-gateway.server");
    try {
      const text = await streamChat({
        model: OCR_MODEL,
        system: OCR_PROMPT,
        schemaName: "inscription_ocr",
        schema: ocrJsonSchema,
        user: [
          { type: "text", text: "Transcribe the inscription in this image." },
          { type: "image_url", image_url: { url: data.image } },
        ],
      });
      const parsed = ocrResultSchema.safeParse(parseJson(text));
      if (!parsed.success) return { ok: false, error: "The AI returned an unexpected format. Please retry.", retryable: true };
      return { ok: true, data: { ...parsed.data, ocrProvider: "Gemini (Lovable AI)", model: OCR_MODEL } };
    } catch (e) {
      const status = e instanceof AiError ? e.status : 500;
      const msg = e instanceof AiError ? e.message : "Analysis failed unexpectedly. Please retry.";
      console.error("analyze-inscription", status, msg);
      return { ok: false, error: msg, retryable: status === 429 || status >= 500 };
    }
  });

export const translateInscription = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().max(20000),
        scriptType: z.string().max(200).optional(),
        context: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Ok<TranslationResult> | Err> => {
    if (!data.text.trim()) return { ok: false, error: "There is no Tamil text to translate.", retryable: false };
    const { streamChat, parseJson, AiError, TRANSLATION_MODEL } = await import("./ai-gateway.server");
    try {
      const text = await streamChat({
        model: TRANSLATION_MODEL,
        system: TRANSLATE_PROMPT,
        schemaName: "inscription_translation",
        schema: translationJsonSchema,
        user: `Script: ${data.scriptType ?? "unknown"}\n${data.context ? `Context notes: ${data.context}\n` : ""}\nTamil text:\n${data.text}`,
      });
      const parsed = translationSchema.safeParse(parseJson(text));
      if (!parsed.success) return { ok: false, error: "The AI returned an unexpected format. Please retry.", retryable: true };
      return { ok: true, data: { ...parsed.data, model: TRANSLATION_MODEL } };
    } catch (e) {
      const status = e instanceof AiError ? e.status : 500;
      const msg = e instanceof AiError ? e.message : "Translation failed unexpectedly. Please retry.";
      console.error("translate-inscription", status, msg);
      return { ok: false, error: msg, retryable: status === 429 || status >= 500 };
    }
  });
