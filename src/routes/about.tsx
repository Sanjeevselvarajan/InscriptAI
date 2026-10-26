import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — InscriptAI" },
      { name: "description", content: "InscriptAI helps researchers and enthusiasts digitize ancient Tamil inscriptions." },
      { property: "og:title", content: "About — InscriptAI" },
      { property: "og:description", content: "A research aid for digitizing and translating Tamil stone inscriptions." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-5xl">About InscriptAI</h1>
      <p className="mt-6 font-tamil text-2xl text-primary">யாதும் ஊரே யாவரும் கேளிர்</p>
      <div className="mt-6 space-y-4 text-muted-foreground">
        <p>
          InscriptAI is a research aid for historians, archaeologists, students and Tamil language enthusiasts who want to digitize
          inscriptions from photographs and scans.
        </p>
        <p>
          Tamil epigraphy spans more than two thousand years — from Tamil-Brahmi cave inscriptions through Vatteluttu and Grantha to
          modern Tamil script. General-purpose AI models are far more reliable on modern script than on early forms, and weathering,
          lighting and carving depth all affect what can be read.
        </p>
        <p>
          For that reason, every result is presented as an interpretation, with uncertain and unreadable portions marked. Please verify
          readings against published corpora and expert review before citing them.
        </p>
        <h2 className="pt-4 font-semibold text-foreground">Privacy</h2>
        <p>
          Images are processed for analysis but not stored. Saved history contains only text and metadata, and is visible only to your account.
        </p>
      </div>
    </div>
  );
}
