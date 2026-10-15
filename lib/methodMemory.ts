"use client";

import { useSyncExternalStore } from "react";
import { type BrewMethod, brewHasDetail, emptyBrew, uid } from "./types";

/**
 * The last recipe you actually used for each method name, kept per device.
 *
 * Adding "V60" to a new bag should not hand you the generic starter when you
 * have already dialled your own V60 in — the numbers you settled on are the
 * ones you want back, including the grinder and every pour.
 */

const KEY = "bean-label/method-memory";


/** Everything about a method except which label it belongs to. */
type Remembered = Omit<BrewMethod, "id"> & { savedAt?: number };

const listeners = new Set<() => void>();
/** Cached so the names snapshot keeps its identity between renders. */
let namesCache: readonly string[] | null = null;
let mapCache: Record<string, Remembered> | null = null;
const NO_NAMES: readonly string[] = [];
const NO_MAP: Record<string, Remembered> = {};

const keyOf = (name: string) => name.trim().toLowerCase();

function readAll(): Record<string, Remembered> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, Remembered>)
      : {};
  } catch {
    return {};
  }
}

/** Records every named method that carries a recipe; blanks are left alone. */
export function rememberBrews(brews: BrewMethod[]): boolean {
  if (typeof window === "undefined") return false;
  const all = readAll();
  let changed = false;
  for (const brew of brews) {
    const key = keyOf(brew.name);
    // A method someone has emptied out should not erase what it used to hold.
    if (!key || !brewHasDetail(brew)) continue;
    all[key] = {
      name: brew.name,
      waterTempC: brew.waterTempC,
      doseG: brew.doseG,
      yieldG: brew.yieldG,
      grinderBrand: brew.grinderBrand,
      grinderModel: brew.grinderModel,
      grind: brew.grind,
      totalTime: brew.totalTime,
      steps: brew.steps,
      savedAt: Date.now(),
    };
    changed = true;
  }
  if (!changed) return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
    // Read it back — a write can be refused without throwing.
    if (!window.localStorage.getItem(KEY)) return false;
  } catch {
    // Full or private — the recipe is still saved on the label itself.
    return false;
  }
  namesCache = null;
  mapCache = null;
  listeners.forEach((cb) => cb());
  return true;
}

/** True when the saved copy of this method matches what is on screen. */
export function matchesRemembered(
  saved: Record<string, Remembered>,
  brew: BrewMethod,
): boolean {
  const found = saved[keyOf(brew.name)];
  if (!found) return false;
  const sameSteps =
    (found.steps?.length ?? 0) === brew.steps.length &&
    (found.steps ?? []).every((step, i) => {
      const b = brew.steps[i];
      return (
        step.text === b.text &&
        step.startAt === b.startAt &&
        step.endAt === b.endAt &&
        step.waterG === b.waterG
      );
    });
  return (
    sameSteps &&
    found.waterTempC === brew.waterTempC &&
    found.doseG === brew.doseG &&
    found.yieldG === brew.yieldG &&
    found.grinderBrand === brew.grinderBrand &&
    found.grinderModel === brew.grinderModel &&
    found.grind === brew.grind &&
    found.totalTime === brew.totalTime
  );
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getNames(): readonly string[] {
  if (namesCache) return namesCache;
  namesCache = Object.values(readAll())
    .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
    .map((r) => r.name)
    .filter(Boolean);
  return namesCache;
}

/** Nothing on the server, which is also what a first-time visitor has. */
function getServerNames(): readonly string[] {
  return NO_NAMES;
}

function getMap(): Record<string, Remembered> {
  if (!mapCache) mapCache = readAll();
  return mapCache;
}

function getServerMap(): Record<string, Remembered> {
  return NO_MAP;
}

/** The saved recipes themselves, for comparing against what is on screen. */
export function useRememberedMap(): Record<string, Remembered> {
  return useSyncExternalStore(subscribe, getMap, getServerMap);
}

/** Every method you have set up before, most recently used first. */
export function useRememberedNames(): readonly string[] {
  return useSyncExternalStore(subscribe, getNames, getServerNames);
}

/** Drops one method's saved recipe. Labels already using it keep theirs. */
export function forgetMethod(name: string): void {
  if (typeof window === "undefined") return;
  const key = keyOf(name);
  const all = readAll();
  if (!(key in all)) return;
  delete all[key];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    return;
  }
  namesCache = null;
  mapCache = null;
  listeners.forEach((cb) => cb());
}

/** A fresh copy of the remembered recipe, or null when there is none. */
export function recallBrew(name: string): BrewMethod | null {
  if (typeof window === "undefined") return null;
  const key = keyOf(name);
  if (!key) return null;
  const found = readAll()[key];
  if (!found) return null;
  return {
    ...emptyBrew(name),
    ...found,
    name,
    // New ids, or adding the same method twice would collide.
    id: uid(),
    steps: (found.steps ?? []).map((s) => ({ ...s, id: uid() })),
  };
}
