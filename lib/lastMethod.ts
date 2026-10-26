"use client";

import { useSyncExternalStore } from "react";

/**
 * The brew method last picked on each label's guide, so opening it again lands
 * on the one you actually brew rather than always the first.
 *
 * A store rather than component state for the same reason the group filter is:
 * reading localStorage during render would not match the server's HTML, and
 * useSyncExternalStore is what reconciles that properly.
 */

const KEY = "bean-label/last-method";
const EMPTY: Readonly<Record<string, string>> = {};

const listeners = new Set<() => void>();
/** Cached so the snapshot keeps its identity — a new object every read loops. */
let cache: Readonly<Record<string, string>> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function read(): Readonly<Record<string, string>> {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    cache =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, string>)
        : EMPTY;
  } catch {
    // A corrupt value should not take the guide down with it.
    cache = EMPTY;
  }
  return cache;
}

/** Nothing is remembered on the server, which is also the first-visit default. */
function getServerSnapshot(): Readonly<Record<string, string>> {
  return EMPTY;
}

export function useLastMethods(): Readonly<Record<string, string>> {
  return useSyncExternalStore(subscribe, read, getServerSnapshot);
}

/** The method id last picked for this label, or null. Safe during render. */
export function lastMethod(labelId: string): string | null {
  if (typeof window === "undefined") return null;
  return read()[labelId] ?? null;
}

export function rememberMethod(labelId: string, brewId: string): void {
  cache = { ...read(), [labelId]: brewId };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Private mode or a full quota — it still holds for this session.
  }
  listeners.forEach((cb) => cb());
}
