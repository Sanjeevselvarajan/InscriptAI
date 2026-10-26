import { z } from "zod";

export const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp",
  "image/tiff",
];
export const ALLOWED_EXT = ["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"];
export const MAX_BYTES = 16 * 1024 * 1024;

export function validateImageFile(file: { name: string; type: string; size: number }): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.includes(ext) && !ALLOWED_TYPES.includes(file.type))
    return "Unsupported file type. Use PNG, JPG, WebP, BMP or TIFF.";
  if (file.size > MAX_BYTES) return "File is larger than 16 MB.";
  if (file.size === 0) return "The file is empty.";
  return null;
}

export const ocrResultSchema = z.object({
  originalText: z.string().default(""),
  normalizedTamil: z.string().nullable().default(null),
  scriptType: z.string().default("unknown"),
  lines: z.array(z.object({ text: z.string(), uncertain: z.boolean() })).default([]),
  uncertainties: z.array(z.string()).default([]),
  imageQuality: z.string().default(""),
  readable: z.boolean().default(true),
});
export type OcrResult = z.infer<typeof ocrResultSchema> & { ocrProvider: string; model: string };

export const translationSchema = z.object({
  literal: z.string().default(""),
  readable: z.string().default(""),
  notes: z.string().default(""),
  uncertainPassages: z.array(z.string()).default([]),
  translatable: z.boolean().default(true),
});
export type TranslationResult = z.infer<typeof translationSchema> & { model: string };

export function countText(t: string) {
  const trimmed = t.trim();
  return {
    chars: [...t.replace(/\s/g, "")].length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
  };
}
