"use client";

import { useSyncExternalStore } from "react";

/**
 * Which group chips are selected in the library, remembered across visits.
 *
 * It is a store rather than component state for the same reason the language
 * is: reading localStorage during render would not match the server's HTML,
 * and useSyncExternalStore is what reconciles that properly.
 */

const KEY = "bean-label/groups";
const EMPTY: readonly string[] = [];

const listeners = new Set<() => void>();
/** Cached so the snapshot keeps its identity — a new array every read loops. */
let cache: readonly string[] | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): readonly string[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    cache = Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : EMPTY;
  } catch {
    // A corrupt value should not take the library down with it.
    cache = EMPTY;
  }
  return cache;
}

/** Nothing is selected on the server, which is also the first-visit default. */
function getServerSnapshot(): readonly string[] {
  return EMPTY;
}

export function useSavedGroups(): readonly string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function saveGroups(ids: Iterable<string>): void {
  cache = [...ids];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Private mode or a full quota — the filter still works for this session.
  }
  listeners.forEach((cb) => cb());
}
