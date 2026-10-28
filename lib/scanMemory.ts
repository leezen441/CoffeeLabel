"use client";

import type { CoffeeLabel } from "./types";
import type { ScanResult } from "./scanRules";

/**
 * What you changed after a scan, kept so the next scan is told about it.
 *
 * This is not training. Each correction becomes one sentence in the prompt —
 * "on a Mot Mot Coffee label, the roaster is Mot Mot Coffee, not Gayo" — which
 * is enough for the same mistake not to be made twice on the same roaster.
 */

const KEY = "bean-label/scan-corrections";
const MAX = 40;

export type Correction = {
  /** the roaster as scanned, so hints can be narrowed to that label's maker */
  roaster: string;
  field: string;
  read: string;
  should: string;
  at: string;
};

function read(): Correction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as Correction[]) : [];
  } catch {
    return [];
  }
}

function write(list: Correction[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Private mode or a full quota — scanning still works, it just forgets.
  }
}

/** The fields worth correcting. Notes and dates vary per bag, so they are out. */
const WATCHED: { key: keyof ScanResult; label: string }[] = [
  { key: "roaster", label: "roaster" },
  { key: "coffeeName", label: "coffee name" },
  { key: "variety", label: "variety" },
  { key: "origin", label: "origin" },
  { key: "altitude", label: "altitude" },
];

/** Compare what was scanned with what was saved, and remember the differences. */
export function rememberCorrections(scan: ScanResult, saved: CoffeeLabel): void {
  const found: Correction[] = [];
  for (const { key, label } of WATCHED) {
    const was = String(scan[key] ?? "").trim();
    const now = String((saved as unknown as Record<string, unknown>)[key] ?? "").trim();
    if (!now || was === now) continue;
    found.push({
      roaster: (saved.roaster || scan.roaster || "").trim(),
      field: label,
      read: was,
      should: now,
      at: new Date().toISOString(),
    });
  }
  const processes = scan.processes.join(", ");
  const savedProcesses = saved.processes.join(", ");
  if (savedProcesses && processes !== savedProcesses) {
    found.push({
      roaster: (saved.roaster || scan.roaster || "").trim(),
      field: "process",
      read: processes,
      should: savedProcesses,
      at: new Date().toISOString(),
    });
  }
  if (found.length === 0) return;
  // Newest first, one per roaster+field so a field settles rather than piling up.
  const kept = read().filter(
    (c) => !found.some((f) => f.roaster === c.roaster && f.field === c.field),
  );
  write([...found, ...kept]);
}

/** The corrections to send with a scan, as sentences. */
export function correctionHints(): string[] {
  return read().map((c) =>
    c.roaster
      ? `On a ${c.roaster} label, ${c.field} read as "${c.read || "(empty)"}" but should be "${c.should}".`
      : `${c.field} read as "${c.read || "(empty)"}" but should be "${c.should}".`,
  );
}

export function clearCorrections(): void {
  write([]);
}

export function correctionCount(): number {
  return read().length;
}

/* ----------------------- the scan behind a label ----------------------- */

const PENDING = "bean-label/scan-pending";
/** A day is long enough to come back and fix a label you just scanned. */
const PENDING_MS = 24 * 60 * 60 * 1000;

type Pending = Record<string, { scan: ScanResult; at: number }>;

function readPending(): Pending {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PENDING);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return {};
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(parsed as Pending).filter(([, v]) => now - v.at < PENDING_MS),
    );
  } catch {
    return {};
  }
}

function writePending(p: Pending): void {
  try {
    window.localStorage.setItem(PENDING, JSON.stringify(p));
  } catch {
    // Nothing to do; the corrections log just misses this one.
  }
}

/** Keep what a scan read, so later edits to that label can be compared to it. */
export function stashScan(labelId: string, scan: ScanResult): void {
  writePending({ ...readPending(), [labelId]: { scan, at: Date.now() } });
}

/**
 * Compare a saved label with the scan it came from, if any, and remember the
 * differences. Runs on every save while the scan is still stashed, so a fix
 * made ten minutes later still counts.
 */
export function learnFromSave(label: CoffeeLabel): void {
  const pending = readPending()[label.id];
  if (!pending) return;
  rememberCorrections(pending.scan, label);
}

export function forgetScan(labelId: string): void {
  const p = readPending();
  if (!(labelId in p)) return;
  delete p[labelId];
  writePending(p);
}
