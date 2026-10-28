"use client";

import { type ScannedLine, filledFields, mergeScans, parseLabelText } from "./labelParse";
import type { ScanResult } from "./scanRules";

/**
 * Reading a bag label in the browser, with no API key and no server.
 *
 * Tesseract wants dark text on a light background, upright and large. A photo
 * of a bag is usually none of those, so the work here is mostly preparation:
 * try the four right-angle rotations, pick the one it reads most confidently,
 * and hand the text to the parser.
 */

type Worker = Awaited<ReturnType<typeof import("tesseract.js").createWorker>>;

let worker: Worker | null = null;
let starting: Promise<Worker> | null = null;

async function getWorker(onProgress?: (p: number) => void): Promise<Worker> {
  if (worker) return worker;
  if (!starting) {
    starting = (async () => {
      const { createWorker } = await import("tesseract.js");
      // ~4 MB of engine and language data on the first scan, cached after.
      const w = await createWorker("eng", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "loading tesseract core" || m.status === "loading language traineddata") {
            onProgress?.(m.progress * 0.4);
          }
        },
      });
      worker = w;
      return w;
    })();
  }
  return starting;
}

/** A region of the photo, in fractions of its width and height. */
type Box = { x0: number; x1: number; y0: number; y1: number };

/**
 * Where the label is.
 *
 * A bag label is a bright rectangle on something darker, so the rows and
 * columns it covers are the ones with the most bright pixels. Finding it
 * matters more than any other preparation here: a label filling a third of
 * the frame is a third of the resolution for its text, and the rest of the
 * frame is bag weave and worktop that OCR reads as lines of nonsense.
 */
function findLabelBox(bitmap: ImageBitmap): Box | null {
  const side = 500;
  const scale = side / Math.max(bitmap.width, bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);

  const px = ctx.getImageData(0, 0, w, h).data;
  const grey = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < px.length; i += 4, p += 1) {
    grey[p] = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
  }
  // The brightest quarter of the photo is the label, near enough.
  const sorted = Uint8Array.from(grey).sort();
  const bright = sorted[Math.floor(sorted.length * 0.72)];

  const rows = new Int32Array(h);
  const cols = new Int32Array(w);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (grey[y * w + x] > bright) {
        rows[y] += 1;
        cols[x] += 1;
      }
    }
  }
  const longestRun = (counts: Int32Array) => {
    let max = 0;
    for (const c of counts) if (c > max) max = c;
    const limit = max * 0.45;
    let bestStart = 0;
    let bestEnd = -1;
    let start = -1;
    for (let i = 0; i < counts.length; i += 1) {
      if (counts[i] > limit) {
        if (start < 0) start = i;
      } else {
        if (start >= 0 && i - 1 - start > bestEnd - bestStart) {
          bestStart = start;
          bestEnd = i - 1;
        }
        start = -1;
      }
    }
    if (start >= 0 && counts.length - 1 - start > bestEnd - bestStart) {
      bestStart = start;
      bestEnd = counts.length - 1;
    }
    return [bestStart, bestEnd] as const;
  };

  const [y0, y1] = longestRun(rows);
  const [x0, x1] = longestRun(cols);
  const area = ((x1 - x0) * (y1 - y0)) / (w * h);
  // Too small to be the label, or so big that cropping gains nothing.
  if (!(area > 0.06) || area > 0.85) return null;

  // A generous border: the run stops at the first dim column, which on this
  // label is inside the "C" of its own title.
  const m = 0.14;
  return {
    x0: Math.max(0, x0 / w - m),
    x1: Math.min(1, x1 / w + m),
    y0: Math.max(0, y0 / h - m),
    y1: Math.min(1, y1 / h + m),
  };
}

/** Rotate and stretch the photo into something an OCR engine can read. */
function prepare(
  bitmap: ImageBitmap,
  turn: 0 | 90 | 180 | 270,
  longEdge: number,
  box: Box | null,
): HTMLCanvasElement {
  const sx = box ? box.x0 * bitmap.width : 0;
  const sy = box ? box.y0 * bitmap.height : 0;
  const sw = box ? (box.x1 - box.x0) * bitmap.width : bitmap.width;
  const sh = box ? (box.y1 - box.y0) * bitmap.height : bitmap.height;

  const swap = turn === 90 || turn === 270;
  const scale = longEdge / Math.max(sw, sh);
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turn * Math.PI) / 180);
  ctx.drawImage(bitmap, sx, sy, sw, sh, -w / 2, -h / 2, w, h);

  // Grey, then stretch the contrast: print on a coloured bag or a dark tin is
  // far from the black-on-white Tesseract was trained on.
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    px[i] = px[i + 1] = px[i + 2] = g;
    if (g < lo) lo = g;
    if (g > hi) hi = g;
  }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    const v = ((px[i] - lo) * 255) / span;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

type Read = { confidence: number; lines: ScannedLine[] };

async function readOnce(worker: Worker, canvas: HTMLCanvasElement): Promise<Read> {
  const { data } = await worker.recognize(canvas, {}, { blocks: true });
  const lines: ScannedLine[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        const text = (line.text ?? "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        const box = line.bbox;
        lines.push({ text, height: box ? box.y1 - box.y0 : undefined });
      }
    }
  }
  return { confidence: data.confidence ?? 0, lines };
}

export type OcrOutcome =
  | {
      ok: true;
      result: ScanResult;
      confidence: number;
      text: string;
      /** the rotation that read best, so the photo can be shown upright */
      turn: 0 | 90 | 180 | 270;
    }
  | { ok: false; error: "unreadable" | "failed" };

/**
 * Read a label from a photo, entirely on this device.
 *
 * The orientation is decided on a small copy — four cheap reads — and only the
 * winner is read again at full size, which costs one slow pass instead of four.
 */
export async function readLabelLocally(
  file: File | Blob,
  onProgress?: (p: number) => void,
): Promise<OcrOutcome> {
  try {
    const w = await getWorker(onProgress);
    const bitmap = await createImageBitmap(file);
    const box = findLabelBox(bitmap);
    onProgress?.(0.45);

    let best: { turn: 0 | 90 | 180 | 270; read: Read } | null = null;
    const turns: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
    for (let i = 0; i < turns.length; i += 1) {
      const read = await readOnce(w, prepare(bitmap, turns[i], 620, box));
      // Characters matter as much as confidence: a blank read scores well.
      const score = read.confidence * Math.min(1, read.lines.join(" ").length / 120);
      const bestScore = best
        ? best.read.confidence * Math.min(1, best.read.lines.join(" ").length / 120)
        : -1;
      if (score > bestScore) best = { turn: turns[i], read };
      onProgress?.(0.45 + ((i + 1) / turns.length) * 0.3);
    }
    if (!best) return { ok: false, error: "unreadable" };

    // 1600px is the sweet spot: a bigger canvas is several seconds slower and
    // reads no better, because the limit is the photo, not the pixels.
    const full = await readOnce(w, prepare(bitmap, best.turn, 1600, box));
    onProgress?.(0.8);

    // The full-size read wins on merit; more lines only ever meant more noise.
    const lines = full.lines.length > 0 ? full.lines : best.read.lines;
    const text = lines.map((l) => l.text).join("\n");
    if (text.replace(/\s/g, "").length < 12) return { ok: false, error: "unreadable" };

    let result = parseLabelText(lines);
    // A crop can cut a line off at its edge. When it has come back thin, the
    // whole frame is read once more and the two are taken together — slower,
    // but only on the labels that were going badly anyway.
    if (box && filledFields(result) < 6) {
      onProgress?.(0.85);
      const wide = await readOnce(w, prepare(bitmap, best.turn, 1600, null));
      if (wide.lines.length > 0) result = mergeScans(result, parseLabelText(wide.lines));
    }
    bitmap.close();
    onProgress?.(1);

    return {
      ok: true,
      result,
      confidence: Math.max(full.confidence, best.read.confidence),
      text,
      turn: best.turn,
    };
  } catch {
    return { ok: false, error: "failed" };
  }
}
