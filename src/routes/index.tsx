import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Wand2, ScanText, Languages, FileText, AlertTriangle, Upload, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import hero from "@/assets/hero-inscription.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InscriptAI — Unlock the Stories Written in Stone" },
      { name: "description", content: "Digitize ancient Tamil inscriptions with AI-powered OCR, Tamil text extraction and English translation." },
      { property: "og:title", content: "InscriptAI — Unlock the Stories Written in Stone" },
      { property: "og:description", content: "AI-powered recognition and translation of ancient Tamil inscriptions." },
    ],
  }),
  component: Home,
});

const FEATURES = [
  { icon: Wand2, title: "Intelligent Image Enhancement", body: "Grayscale, contrast, brightness, binarization and noise reduction directly in your browser." },
  { icon: ScanText, title: "AI-Powered Inscription OCR", body: "A Gemini vision model reads the actual photograph and flags damaged or unclear characters." },
  { icon: FileText, title: "Tamil Text Extraction", body: "Editable Unicode Tamil with preserved line order, uncertainty markers and counts." },
  { icon: Languages, title: "English Translation", body: "Literal and readable renderings with notes on ambiguous passages." },
];

function Home() {
  return (
    <>
      <section className="relative overflow-hidden bg-hero">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div className="animate-fade-up">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="font-tamil text-primary">கல்வெட்டு</span> Digital epigraphy
            </p>
            <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">
              Unlock the Stories <em className="text-primary">Written in Stone</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Preserve ancient Tamil heritage with AI-powered inscription recognition, digital text extraction, and English translation.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-primary shadow-elegant">
                <Link to="/analyze">
                  Analyze an Inscription <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/how-it-works">Explore How It Works</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <img
              src={hero}
              alt="Carved Tamil inscription on a granite temple wall with a digital scanning overlay"
              width={1536}
              height={1024}
              className="aspect-[4/3] w-full rounded-2xl object-cover shadow-elegant"
            />
            <div className="absolute -bottom-5 left-5 rounded-xl border bg-card/95 px-4 py-3 shadow-soft backdrop-blur">
              <p className="text-xs text-muted-foreground">Illustrative image</p>
              <p className="font-tamil text-sm">Real results come from your own uploads</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-soft transition-transform hover:-translate-y-0.5">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6">
        <h2 className="font-display text-4xl">Three steps from stone to text</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            { icon: Upload, t: "Upload an inscription", b: "Photograph or scan — PNG, JPG, WebP, BMP or TIFF up to 16 MB." },
            { icon: Search, t: "Analyze and extract text", b: "Enhance the image, then let the vision model transcribe what is visible." },
            { icon: CheckCircle2, t: "Review and translate", b: "Correct the Tamil, translate to English, save and export." },
          ].map((s, i) => (
            <div key={s.t} className="flex gap-4">
              <span className="font-display text-5xl text-stone">{i + 1}</span>
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <s.icon className="h-4 w-4 text-primary" /> {s.t}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.b}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 flex gap-3 rounded-xl border border-warning-foreground/20 bg-warning p-5 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Ancient inscriptions can contain damaged, ambiguous, or historically specific characters (Tamil-Brahmi, Vatteluttu, Grantha).
            AI interpretations are aids for research and must be verified by qualified epigraphers.
          </p>
        </div>
      </section>
    </>
  );
}
