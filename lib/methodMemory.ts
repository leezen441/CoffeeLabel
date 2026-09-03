"use client";

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
type Remembered = Omit<BrewMethod, "id">;

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
export function rememberBrews(brews: BrewMethod[]): void {
  if (typeof window === "undefined") return;
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
    };
    changed = true;
  }
  if (!changed) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Full or private — the recipe is still saved on the label itself.
  }
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
