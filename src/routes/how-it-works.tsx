import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — InscriptAI" },
      { name: "description", content: "How InscriptAI enhances images, reads Tamil inscriptions with AI and translates them." },
      { property: "og:title", content: "How It Works — InscriptAI" },
      { property: "og:description", content: "The InscriptAI pipeline: validation, enhancement, AI OCR, extraction and translation." },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [
  ["Image validation", "Your file is checked for type (PNG, JPG, WebP, BMP, TIFF) and size (≤ 16 MB) before anything happens. Your browser must be able to decode it — TIFF support varies by browser."],
  ["Image enhancement", "Using the browser Canvas API (not OpenCV), you can apply grayscale, contrast, brightness, threshold binarization and a 3×3 median noise filter. Images are resized to at most 2048px on the long edge, preserving aspect ratio."],
  ["AI OCR", "The enhanced image is sent from our server to a Google Gemini vision model through Lovable AI. The model is instructed to transcribe only visible characters, preserve line order, mark damaged areas, and identify the script only when evidence allows."],
  ["Tamil text extraction", "The structured response is validated before it is shown. You get the original transcription, normalized modern Tamil (when justified), per-line uncertainty flags and notes."],
  ["English translation", "The text currently in the editor — including your corrections — is translated by a Gemini text model into a literal and a readable rendering, with notes on ambiguity."],
  ["Save & export", "Signed-in users can save analyses to their private history. Images are not stored on our servers. Text, reports and images can be downloaded at any time."],
];

function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-5xl">How It Works</h1>
      <p className="mt-4 text-muted-foreground">A transparent pipeline. No fabricated confidence scores, no pre-written results.</p>
      <ol className="mt-10 space-y-8 border-l pl-8">
        {STEPS.map(([t, b], i) => (
          <li key={t} className="relative">
            <span className="absolute -left-[45px] grid h-7 w-7 place-items-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <h2 className="font-semibold">{t}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{b}</p>
          </li>
        ))}
      </ol>
      <Button asChild className="mt-12 bg-gradient-primary">
        <Link to="/analyze">Try it with your image</Link>
      </Button>
    </div>
  );
}
