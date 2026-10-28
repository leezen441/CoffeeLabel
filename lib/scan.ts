"use client";

import type { ScanResult } from "./scanRules";
import { type CoffeeLabel, type RoastLevel, emptyLabel, normalizeLabel } from "./types";

/**
 * Anthropic resizes anything larger than this anyway, and a photo costs tokens
 * by its area — shrinking first is the difference between a scan that costs
 * tenths of a satang and one that costs several.
 */
const MAX_EDGE = 1568;

export type ScanError =
  | "no-key"
  | "bad-key"
  | "bad-image"
  | "too-large"
  | "rate-limited"
  | "refused"
  | "unreadable"
  | "offline"
  | "failed";

/** Draw the photo smaller and re-encode it as JPEG. Returns a data URL. */
export async function shrinkImage(file: File, edge = MAX_EDGE): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export async function scanLabelImage(
  image: string,
  hints: string[],
): Promise<{ ok: true; result: ScanResult } | { ok: false; error: ScanError }> {
  let res: Response;
  try {
    res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, hints }),
    });
  } catch {
    return { ok: false, error: "offline" };
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error =
      body && typeof body === "object" && "error" in body
        ? (body as { error: string }).error
        : "failed";
    return { ok: false, error: error as ScanError };
  }
  const label = (body as { label?: ScanResult })?.label;
  return label ? { ok: true, result: label } : { ok: false, error: "unreadable" };
}

function clampRoast(n: number): RoastLevel {
  const r = Math.round(n);
  return (r >= 1 && r <= 5 ? r : 3) as RoastLevel;
}

/** A scan, as a label this app can save. Blank fields keep their defaults. */
export function labelFromScan(scan: ScanResult): CoffeeLabel {
  const base = emptyLabel();
  const days = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
  return normalizeLabel({
    ...base,
    roaster: scan.roaster.trim(),
    coffeeName: scan.coffeeName.trim(),
    variety: scan.variety.trim(),
    origin: scan.origin.trim(),
    processes: scan.processes.map((p) => p.trim()).filter(Boolean).slice(0, 6),
    altitude: scan.altitude.trim(),
    roastLevel: scan.roastLevel ? clampRoast(scan.roastLevel) : base.roastLevel,
    // An unreadable date is better left for you to type than guessed at.
    roastDate: /^\d{4}-\d{2}-\d{2}$/.test(scan.roastDate) ? scan.roastDate : "",
    netWeight: scan.netWeight.replace(/[^\d.]/g, ""),
    tastingNotes: scan.tastingNotes.map((n) => n.trim()).filter(Boolean),
    restFrom: days(scan.restFrom),
    restTo: days(scan.restTo),
    // No brew method comes off a bag label.
    brews: [],
  });
}

/**
 * A small copy of the photo, to show beside the fields while they are checked.
 * It lives in the dialog's state and goes when the dialog does — nothing about
 * a photo is ever written to a label, to storage, or to the database.
 */
export function thumbnail(file: File): Promise<string> {
  return shrinkImage(file, 640);
}

/** Turn a data URL by quarter turns, for a photo taken side-on. */
export async function rotateImage(dataUrl: string, turn: 90 | 180 | 270): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });
  const swap = turn === 90 || turn === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? img.height : img.width;
  canvas.height = swap ? img.width : img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turn * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas.toDataURL("image/jpeg", 0.82);
}
