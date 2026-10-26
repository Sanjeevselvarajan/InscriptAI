// Browser Canvas image preprocessing (not OpenCV).
export type Operation = "original" | "grayscale" | "contrast" | "binarize" | "denoise";
export type ProcessOptions = { op: Operation; brightness: number; contrast: number; threshold: number; maxSize: number };

export const OPERATION_LABELS: Record<Operation, string> = {
  original: "Original",
  grayscale: "Grayscale",
  contrast: "Contrast enhance",
  binarize: "Binarize (threshold)",
  denoise: "Noise reduction (median 3×3)",
};

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("This image format could not be decoded by your browser."));
    img.src = src;
  });
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function processImage(img: HTMLImageElement, o: ProcessOptions): HTMLCanvasElement {
  const scale = Math.min(1, o.maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const b = o.brightness; // -100..100
  const k = o.op === "contrast" ? Math.max(o.contrast, 30) : o.contrast; // -100..100
  const f = (259 * (k + 255)) / (255 * (259 - k));

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], bl = d[i + 2];
    if (o.op !== "original") {
      const y = 0.299 * r + 0.587 * g + 0.114 * bl;
      r = g = bl = y;
    }
    r = clamp(f * (r + b - 128) + 128);
    g = clamp(f * (g + b - 128) + 128);
    bl = clamp(f * (bl + b - 128) + 128);
    if (o.op === "binarize") {
      const v = r >= o.threshold ? 255 : 0;
      r = g = bl = v;
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = bl;
  }

  if (o.op === "denoise") {
    const src = new Uint8ClampedArray(d);
    const win: number[] = new Array(9);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) win[n++] = src[((y + dy) * w + (x + dx)) * 4];
        win.sort((a, z) => a - z);
        const p = (y * w + x) * 4;
        d[p] = d[p + 1] = d[p + 2] = win[4];
      }
    }
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

export function downloadBlob(content: Blob | string, filename: string, type = "text/plain;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob(["\uFEFF" + content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
