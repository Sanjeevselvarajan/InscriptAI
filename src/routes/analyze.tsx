import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import {
  Upload, X, Loader2, ScanText, Languages, Copy, Download, RotateCcw, Eraser, AlertTriangle,
  Check, Circle, XCircle, Save, ZoomIn, ZoomOut, ImageDown, FileText, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { analyzeInscription, translateInscription } from "@/lib/inscription.functions";
import { countText, validateImageFile, type OcrResult, type TranslationResult } from "@/lib/inscription-types";
import { downloadBlob, downloadDataUrl, loadImage, OPERATION_LABELS, processImage, type Operation, type ProcessOptions } from "@/lib/image-processing";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/analyze")({
  validateSearch: z.object({ id: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Analyze Inscription — InscriptAI" },
      { name: "description", content: "Upload a Tamil inscription image, enhance it, extract Tamil text with AI and translate it to English." },
      { property: "og:title", content: "Analyze Inscription — InscriptAI" },
      { property: "og:description", content: "AI OCR and translation workspace for Tamil inscriptions." },
    ],
  }),
  component: Analyze,
});

type StepState = "idle" | "active" | "done" | "error";
const STEP_NAMES = ["Image validated", "Image enhancement", "AI OCR", "Tamil text extracted", "English translation", "Results ready"];

const DEFAULT_OPTS: ProcessOptions = { op: "grayscale", brightness: 0, contrast: 20, threshold: 128, maxSize: 2048 };

function fmtBytes(n: number) {
  return n > 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`;
}

async function copy(text: string, label: string) {
  if (!text.trim()) return void toast.error(`No ${label} to copy`);
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Clipboard access was blocked by your browser");
  }
}

function Analyze() {
  const { id } = Route.useSearch();
  const { user } = useAuth();
  const analyze = useServerFn(analyzeInscription);
  const translate = useServerFn(translateInscription);
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState("");
  const [origUrl, setOrigUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [opts, setOpts] = useState<ProcessOptions>(DEFAULT_OPTS);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [processedDims, setProcessedDims] = useState<[number, number] | null>(null);

  const [steps, setSteps] = useState<StepState[]>(STEP_NAMES.map(() => "idle"));
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [tamil, setTamil] = useState("");
  const [translation, setTranslation] = useState<TranslationResult | null>(null);
  const [translatedFrom, setTranslatedFrom] = useState<string | null>(null);
  const [trError, setTrError] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [tab, setTab] = useState("ocr");

  const setStep = (i: number, s: StepState) => setSteps((p) => p.map((v, j) => (j === i ? s : v)));

  // Reopen a saved analysis
  useEffect(() => {
    if (!id || !user) return;
    supabase.from("inscription_analyses").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error || !data) return void toast.error("Could not open that analysis.");
      const meta = (data.analysis_metadata ?? {}) as Record<string, unknown>;
      setFilename(data.original_filename);
      setOcr({
        originalText: data.original_text ?? "",
        normalizedTamil: data.normalized_tamil,
        scriptType: data.script_type ?? "unknown",
        lines: (meta["lines"] as OcrResult["lines"]) ?? [],
        uncertainties: (meta["uncertainties"] as string[]) ?? [],
        imageQuality: (meta["imageQuality"] as string) ?? "",
        readable: true,
        ocrProvider: (meta["ocrProvider"] as string) ?? "Gemini",
        model: (meta["model"] as string) ?? "",
      });
      setTamil(data.edited_tamil ?? data.normalized_tamil ?? data.original_text ?? "");
      if (data.english_translation)
        setTranslation({
          literal: data.english_translation,
          readable: data.readable_translation ?? "",
          notes: data.translation_notes ?? "",
          uncertainPassages: (meta["uncertainPassages"] as string[]) ?? [],
          translatable: true,
          model: (meta["translationModel"] as string) ?? "",
        });
      setAnalyzedAt(data.created_at);
      setSavedId(data.id);
      setSteps(STEP_NAMES.map(() => "done"));
    });
  }, [id, user]);

  const handleFile = useCallback(async (f: File) => {
    const err = validateImageFile(f);
    if (err) {
      setFileError(err);
      return;
    }
    const url = URL.createObjectURL(f);
    try {
      const im = await loadImage(url);
      setFileError(null);
      setFile(f);
      setFilename(f.name);
      setOrigUrl(url);
      setImg(im);
      setOcr(null);
      setTranslation(null);
      setTamil("");
      setSavedId(null);
      setOcrError(null);
      setSteps(STEP_NAMES.map((_, i) => (i === 0 ? "done" : "idle")));
    } catch (e) {
      URL.revokeObjectURL(url);
      setFileError(e instanceof Error ? e.message : "Could not read image");
    }
  }, []);

  useEffect(() => {
    if (!img) { setProcessedUrl(null); return; }
    const t = setTimeout(() => {
      const c = processImage(img, opts);
      setProcessedUrl(c.toDataURL("image/jpeg", 0.9));
      setProcessedDims([c.width, c.height]);
    }, 120);
    return () => clearTimeout(t);
  }, [img, opts]);

  function removeImage() {
    if (origUrl) URL.revokeObjectURL(origUrl);
    setFile(null); setOrigUrl(null); setImg(null); setProcessedUrl(null); setFileError(null);
    setSteps(STEP_NAMES.map(() => "idle"));
  }

  async function runAnalysis() {
    if (!processedUrl || !file) return;
    setAnalyzing(true);
    setOcrError(null);
    setTranslation(null);
    setSavedId(null);
    setSteps(["done", "done", "active", "idle", "idle", "idle"]);
    try {
      const r = await analyze({ data: { image: processedUrl } });
      if (!r.ok) {
        setOcrError(r.error);
        setStep(2, "error");
        return;
      }
      setOcr(r.data);
      const text = r.data.normalizedTamil?.trim() || r.data.originalText;
      setTamil(text);
      setAnalyzedAt(new Date().toISOString());
      setTab("ocr");
      setSteps(["done", "done", "done", text.trim() ? "done" : "error", "idle", text.trim() ? "done" : "idle"]);
    } catch {
      setOcrError("Network error — the analysis request did not complete. Please retry.");
      setStep(2, "error");
    } finally {
      setAnalyzing(false);
    }
  }

  async function runTranslation() {
    if (!tamil.trim()) return void toast.error("There is no Tamil text to translate");
    setTranslating(true);
    setTrError(null);
    setStep(4, "active");
    try {
      const r = await translate({
        data: { text: tamil, scriptType: ocr?.scriptType, context: ocr?.uncertainties.join("; ").slice(0, 1900) },
      });
      if (!r.ok) {
        setTrError(r.error);
        setStep(4, "error");
        return;
      }
      setTranslation(r.data);
      setTranslatedFrom(tamil);
      setSteps((p) => p.map((v, i) => (i >= 4 ? "done" : v)));
      setTab("en");
    } catch {
      setTrError("Network error — translation did not complete. Your Tamil text is preserved.");
      setStep(4, "error");
    } finally {
      setTranslating(false);
    }
  }

  function buildReport() {
    const lines = [
      "InscriptAI — Analysis Report",
      "============================",
      `File: ${filename}`,
      `Analyzed: ${analyzedAt ? new Date(analyzedAt).toLocaleString() : "—"}`,
      `OCR provider: ${ocr?.ocrProvider ?? "—"}${ocr?.model ? ` (${ocr.model})` : ""}`,
      `Script: ${ocr?.scriptType ?? "—"}`,
      `Image quality: ${ocr?.imageQuality || "—"}`,
      "",
      "--- Original OCR transcription ---",
      ocr?.originalText || "(empty)",
      "",
      "--- Normalized Tamil ---",
      ocr?.normalizedTamil || "(not provided)",
      "",
      "--- Edited Tamil (current) ---",
      tamil || "(empty)",
      "",
      "--- Uncertainties ---",
      ...(ocr?.uncertainties.length ? ocr.uncertainties.map((u) => `• ${u}`) : ["(none reported)"]),
      "",
      "--- English translation (literal) ---",
      translation?.literal || "(not translated)",
      "",
      "--- English rendering (readable) ---",
      translation?.readable || "(not translated)",
      "",
      "--- Translator notes ---",
      translation?.notes || "—",
      ...(translation?.uncertainPassages.length ? ["", "Uncertain passages:", ...translation.uncertainPassages.map((u) => `• ${u}`)] : []),
      ...(translation?.model ? ["", `Translation model: ${translation.model}`] : []),
      "",
      "Note: AI interpretations require verification by qualified epigraphers.",
    ];
    return lines.join("\n");
  }

  async function save() {
    if (!user) return void toast.error("Sign in to save analyses to your history");
    if (!ocr) return;
    setSaving(true);
    const row = {
      original_filename: filename || "inscription",
      original_text: ocr.originalText,
      normalized_tamil: ocr.normalizedTamil,
      edited_tamil: tamil,
      english_translation: translation?.literal ?? null,
      readable_translation: translation?.readable ?? null,
      translation_notes: translation?.notes ?? null,
      script_type: ocr.scriptType,
      analysis_metadata: {
        lines: ocr.lines, uncertainties: ocr.uncertainties, imageQuality: ocr.imageQuality,
        ocrProvider: ocr.ocrProvider, model: ocr.model, uncertainPassages: translation?.uncertainPassages ?? [],
        translationModel: translation?.model ?? null, processing: OPERATION_LABELS[opts.op],
      } as unknown as Json,
    };
    const q = savedId
      ? supabase.from("inscription_analyses").update(row).eq("id", savedId).select("id").single()
      : supabase.from("inscription_analyses").insert(row).select("id").single();
    const { data, error } = await q;
    setSaving(false);
    if (error) return void toast.error(error.message.includes("JWT") ? "Your session expired. Please sign in again." : "Could not save: " + error.message);
    setSavedId(data.id);
    toast.success("Saved to your history");
  }

  const hasUncertain = !!ocr && (ocr.uncertainties.length > 0 || ocr.lines.some((l) => l.uncertain) || /\[\.\.\.\]|\?/.test(tamil));
  const original = ocr ? ocr.normalizedTamil?.trim() || ocr.originalText : "";
  const counts = countText(tamil);
  const base = (filename || "inscription").replace(/\.[^.]+$/, "");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl sm:text-5xl">Analyze Inscription</h1>
      <p className="mt-2 text-muted-foreground">Upload, enhance, read and translate.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Upload + preprocessing */}
        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          {!img ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className={`flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${drag ? "border-primary bg-accent" : "hover:border-primary/50 hover:bg-secondary"}`}
            >
              <Upload className="h-10 w-10 text-primary" />
              <p className="mt-4 font-medium">Drop an inscription image here, or click to browse</p>
              <p className="mt-1 text-sm text-muted-foreground">PNG, JPG, WebP, BMP, TIFF · up to 16 MB</p>
              {filename && ocr && <p className="mt-3 text-xs text-muted-foreground">Viewing saved analysis of “{filename}” — images are not stored.</p>}
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{file?.name}</p>
                  <p className="text-muted-foreground">
                    {file && fmtBytes(file.size)} · {img.naturalWidth}×{img.naturalHeight}px
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>Replace</Button>
                  <Button variant="ghost" size="sm" onClick={removeImage}><X className="mr-1 h-4 w-4" />Remove</Button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <figure>
                  <figcaption className="mb-1 text-xs text-muted-foreground">Before</figcaption>
                  <img src={origUrl!} alt="Original upload" className="max-h-80 w-full rounded-lg border bg-muted object-contain" />
                </figure>
                <figure>
                  <figcaption className="mb-1 text-xs text-muted-foreground">After · {OPERATION_LABELS[opts.op]}</figcaption>
                  {processedUrl ? (
                    <img src={processedUrl} alt="Processed" className="max-h-80 w-full rounded-lg border bg-muted object-contain" />
                  ) : (
                    <div className="grid h-40 place-items-center rounded-lg border bg-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  )}
                </figure>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {(Object.keys(OPERATION_LABELS) as Operation[]).map((op) => (
                  <Button key={op} size="sm" variant={opts.op === op ? "default" : "outline"} onClick={() => setOpts({ ...opts, op })}>
                    {OPERATION_LABELS[op]}
                  </Button>
                ))}
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-3">
                <SliderField label="Brightness" value={opts.brightness} min={-100} max={100} onChange={(v) => setOpts({ ...opts, brightness: v })} />
                <SliderField label="Contrast" value={opts.contrast} min={-100} max={100} onChange={(v) => setOpts({ ...opts, contrast: v })} />
                <SliderField label="Threshold" value={opts.threshold} min={0} max={255} disabled={opts.op !== "binarize"} onChange={(v) => setOpts({ ...opts, threshold: v })} />
              </div>
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setOpts(DEFAULT_OPTS)}>
                <RotateCcw className="mr-1 h-4 w-4" /> Reset adjustments
              </Button>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          {fileError && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-destructive"><XCircle className="h-4 w-4" />{fileError}</p>}
          <Button
            size="lg"
            className="mt-5 w-full bg-gradient-primary shadow-elegant"
            disabled={!processedUrl || analyzing}
            onClick={runAnalysis}
          >
            {analyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reading inscription…</> : <><ScanText className="mr-2 h-4 w-4" />Analyze Inscription</>}
          </Button>
          {ocrError && (
            <div role="alert" className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
              <span>{ocrError}</span>
              <Button size="sm" variant="outline" onClick={runAnalysis}><RefreshCw className="mr-1 h-3 w-3" />Retry</Button>
            </div>
          )}
        </section>

        {/* Timeline */}
        <aside className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="font-semibold">Processing</h2>
          <ol className="mt-4 space-y-3">
            {STEP_NAMES.map((n, i) => (
              <li key={n} className="flex items-center gap-3 text-sm">
                {steps[i] === "done" ? <Check className="h-4 w-4 text-success" />
                  : steps[i] === "active" ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  : steps[i] === "error" ? <XCircle className="h-4 w-4 text-destructive" />
                  : <Circle className="h-4 w-4 text-muted-foreground/40" />}
                <span className={steps[i] === "idle" ? "text-muted-foreground" : ""}>{n}</span>
              </li>
            ))}
          </ol>
          {ocr && (
            <dl className="mt-6 space-y-2 border-t pt-4 text-sm">
              <div><dt className="text-muted-foreground">Script</dt><dd>{ocr.scriptType || "unknown"}</dd></div>
              {ocr.imageQuality && <div><dt className="text-muted-foreground">Image quality</dt><dd>{ocr.imageQuality}</dd></div>}
              <div><dt className="text-muted-foreground">Provider</dt><dd>{ocr.ocrProvider}</dd></div>
            </dl>
          )}
        </aside>
      </div>

      {ocr && (
        <section className="mt-8 animate-fade-up rounded-2xl border bg-card p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-3xl">Results</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadBlob(buildReport(), `${base}-report.txt`)}>
                <FileText className="mr-1 h-4 w-4" />Download report
              </Button>
              <Button size="sm" onClick={save} disabled={saving} title={user ? "" : "Sign in to save"}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                {savedId ? "Update saved" : user ? "Save to history" : "Sign in to save"}
              </Button>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="mt-4">
            <TabsList className="flex-wrap">
              <TabsTrigger value="orig">Original Image</TabsTrigger>
              <TabsTrigger value="proc">Processed Image</TabsTrigger>
              <TabsTrigger value="ocr">Tamil OCR</TabsTrigger>
              <TabsTrigger value="en">English Translation</TabsTrigger>
            </TabsList>

            <TabsContent value="orig" className="mt-4">
              {origUrl && img ? (
                <>
                  <div className="mb-2 flex items-center gap-2 text-sm">
                    <Button size="icon" variant="outline" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
                    <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <Button size="icon" variant="outline" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
                    <span className="ml-auto text-muted-foreground">{file?.name} · {file && fmtBytes(file.size)} · {img.naturalWidth}×{img.naturalHeight}</span>
                    {file && <Button size="sm" variant="ghost" onClick={() => downloadBlob(file, file.name)}><ImageDown className="mr-1 h-4 w-4" />Export</Button>}
                  </div>
                  <div className="max-h-[600px] overflow-auto rounded-lg border bg-muted">
                    <img src={origUrl} alt="Original" style={{ width: `${zoom * 100}%`, maxWidth: "none" }} />
                  </div>
                </>
              ) : <Empty text="The image is not available for saved analyses (images are not stored)." />}
            </TabsContent>

            <TabsContent value="proc" className="mt-4">
              {processedUrl && origUrl ? (
                <>
                  <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                    <span>{OPERATION_LABELS[opts.op]} · brightness {opts.brightness} · contrast {opts.contrast}{opts.op === "binarize" ? ` · threshold ${opts.threshold}` : ""}{processedDims ? ` · ${processedDims[0]}×${processedDims[1]}` : ""}</span>
                    <Button size="sm" variant="ghost" onClick={() => downloadDataUrl(processedUrl, `${base}-processed.jpg`)}><ImageDown className="mr-1 h-4 w-4" />Export</Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <img src={origUrl} alt="Before" className="w-full rounded-lg border object-contain" />
                    <img src={processedUrl} alt="After" className="w-full rounded-lg border object-contain" />
                  </div>
                </>
              ) : <Empty text="The processed image is not available for saved analyses." />}
            </TabsContent>

            <TabsContent value="ocr" className="mt-4 space-y-4">
              {!ocr.originalText.trim() && (
                <div className="rounded-lg border bg-warning p-4 text-sm text-warning-foreground">
                  No readable inscription text was found. {ocr.imageQuality} Try a sharper, well-lit photo or a different enhancement.
                </div>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <Label>Original recognized text</Label>
                  <div className="mt-1.5 min-h-40 whitespace-pre-wrap rounded-lg border bg-muted p-3 font-tamil text-lg leading-relaxed">
                    {ocr.lines.length ? ocr.lines.map((l, i) => (
                      <div key={i} className={l.uncertain ? "rounded bg-warning px-1 text-warning-foreground" : ""}>{l.text}</div>
                    )) : ocr.originalText || <span className="text-muted-foreground">—</span>}
                  </div>
                  {ocr.lines.some((l) => l.uncertain) && <p className="mt-1 text-xs text-muted-foreground">Highlighted lines were flagged uncertain by the model.</p>}
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="tamil">Extracted Tamil Text (editable)</Label>
                    <span className="text-xs text-muted-foreground">{counts.chars} chars · {counts.words} words</span>
                  </div>
                  <Textarea id="tamil" value={tamil} onChange={(e) => setTamil(e.target.value)} rows={8} className="mt-1.5 font-tamil text-lg leading-relaxed" />
                  {hasUncertain && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-warning-foreground"><AlertTriangle className="h-3.5 w-3.5" />Contains uncertain or unreadable sections — verify before use.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => copy(tamil, "Tamil text")}><Copy className="mr-1 h-4 w-4" />Copy</Button>
                    <Button size="sm" variant="outline" disabled={!tamil} onClick={() => downloadBlob(tamil, `${base}-tamil.txt`)}><Download className="mr-1 h-4 w-4" />.txt</Button>
                    <Button size="sm" variant="ghost" onClick={() => setTamil(original)}><RotateCcw className="mr-1 h-4 w-4" />Reset</Button>
                    <Button size="sm" variant="ghost" onClick={() => setTamil("")}><Eraser className="mr-1 h-4 w-4" />Clear</Button>
                  </div>
                </div>
              </div>
              {ocr.uncertainties.length > 0 && (
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-semibold">Uncertainty annotations</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {ocr.uncertainties.map((u, i) => <li key={i} className="font-tamil">{u}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={runTranslation} disabled={translating || !tamil.trim()} className="bg-gradient-primary">
                  {translating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Languages className="mr-2 h-4 w-4" />}
                  {translation ? "Re-translate Edited Text" : "Translate to English"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="en" className="mt-4 space-y-4">
              {trError && (
                <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
                  <span>{trError}</span>
                  <Button size="sm" variant="outline" onClick={runTranslation}><RefreshCw className="mr-1 h-3 w-3" />Retry</Button>
                </div>
              )}
              {translating && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Translating…</div>}
              {translation ? (
                <>
                  {translatedFrom !== null && translatedFrom !== tamil && (
                    <p className="text-xs text-warning-foreground">The Tamil text has changed since this translation. Re-translate to update.</p>
                  )}
                  <TextBlock title="Literal translation" text={translation.literal} />
                  <TextBlock title="Readable rendering" text={translation.readable} />
                  {translation.notes && <TextBlock title="Translator notes" text={translation.notes} muted />}
                  {translation.uncertainPassages.length > 0 && (
                    <div className="rounded-lg border p-4"><h3 className="text-sm font-semibold">Uncertain passages</h3>
                      <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{translation.uncertainPassages.map((u, i) => <li key={i}>{u}</li>)}</ul>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => copy(`${translation.literal}\n\n${translation.readable}`, "Translation")}><Copy className="mr-1 h-4 w-4" />Copy</Button>
                    <Button size="sm" variant="outline" onClick={() => downloadBlob(`Literal:\n${translation.literal}\n\nReadable:\n${translation.readable}\n\nNotes:\n${translation.notes}`, `${base}-english.txt`)}><Download className="mr-1 h-4 w-4" />.txt</Button>
                    <Button size="sm" onClick={runTranslation} disabled={translating || !tamil.trim()}><RefreshCw className="mr-1 h-4 w-4" />Re-translate Edited Text</Button>
                  </div>
                </>
              ) : !translating && (
                <div className="text-sm text-muted-foreground">
                  Not translated yet.{" "}
                  <Button size="sm" variant="link" onClick={runTranslation} disabled={!tamil.trim()}>Translate to English</Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </section>
      )}
    </div>
  );
}

function SliderField(p: { label: string; value: number; min: number; max: number; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <div className={p.disabled ? "opacity-50" : ""}>
      <div className="mb-2 flex justify-between text-sm"><span>{p.label}</span><span className="text-muted-foreground">{p.value}</span></div>
      <Slider aria-label={p.label} value={[p.value]} min={p.min} max={p.max} step={1} disabled={!!p.disabled} onValueChange={([v]) => p.onChange(v ?? 0)} />
    </div>
  );
}

function TextBlock({ title, text, muted }: { title: string; text: string; muted?: boolean }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className={`mt-1 whitespace-pre-wrap rounded-lg border p-3 leading-relaxed ${muted ? "text-sm text-muted-foreground" : ""}`}>{text || "—"}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border bg-muted p-6 text-center text-sm text-muted-foreground">{text}</p>;
}
