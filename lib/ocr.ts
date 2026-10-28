"use client";

import { type ScannedLine, parseLabelText } from "./labelParse";
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

/** Rotate and stretch the photo into something an OCR engine can read. */
function prepare(bitmap: ImageBitmap, turn: 0 | 90 | 180 | 270, longEdge: number): HTMLCanvasElement {
  const swap = turn === 90 || turn === 270;
  const scale = longEdge / Math.max(bitmap.width, bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turn * Math.PI) / 180);
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);

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
    onProgress?.(0.45);

    let best: { turn: 0 | 90 | 180 | 270; read: Read } | null = null;
    const turns: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
    for (let i = 0; i < turns.length; i += 1) {
      const read = await readOnce(w, prepare(bitmap, turns[i], 620));
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
    const full = await readOnce(w, prepare(bitmap, best.turn, 1600));
    bitmap.close();
    onProgress?.(1);

    // The full-size read wins on merit; more lines only ever meant more noise.
    const lines = full.lines.length > 0 ? full.lines : best.read.lines;
    const text = lines.map((l) => l.text).join("\n");
    if (text.replace(/\s/g, "").length < 12) return { ok: false, error: "unreadable" };
    return {
      ok: true,
      result: parseLabelText(lines),
      confidence: Math.max(full.confidence, best.read.confidence),
      text,
      turn: best.turn,
    };
  } catch {
    return { ok: false, error: "failed" };
  }
}
