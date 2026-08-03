import type { CoffeeLabel, LabelGroup } from "./types";
import { normalizeLabel } from "./types";

export type StorageMode = "cloud" | "local";

const LS_KEY = "coffee-labels/v1";
const LS_GROUPS = "coffee-groups/v1";

let modePromise: Promise<StorageMode> | null = null;

/** Cloud when a Postgres URL is configured on the server, otherwise localStorage. */
export function storageMode(): Promise<StorageMode> {
  if (!modePromise) {
    modePromise = fetch("/api/status")
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((j) => (j.configured ? "cloud" : "local") as StorageMode)
      .catch(() => "local" as StorageMode);
  }
  return modePromise;
}

function readLocal(): CoffeeLabel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((l) => normalizeLabel(l));
  } catch {
    return [];
  }
}

function writeLocal(labels: CoffeeLabel[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(labels));
}

function sortByUpdated(labels: CoffeeLabel[]): CoffeeLabel[] {
  return [...labels].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function listLabels(): Promise<CoffeeLabel[]> {
  if ((await storageMode()) === "cloud") {
    const res = await fetch("/api/labels", { cache: "no-store" });
    if (res.ok) {
      const { labels } = await res.json();
      return (labels as CoffeeLabel[]).map((l) => normalizeLabel(l));
    }
  }
  return sortByUpdated(readLocal());
}

export async function getLabel(id: string): Promise<CoffeeLabel | null> {
  if ((await storageMode()) === "cloud") {
    const res = await fetch(`/api/labels/${id}`, { cache: "no-store" });
    if (res.ok) {
      const { label } = await res.json();
      return normalizeLabel(label);
    }
    if (res.status === 404) return null;
  }
  return readLocal().find((l) => l.id === id) ?? null;
}

export async function saveLabel(label: CoffeeLabel): Promise<CoffeeLabel> {
  const next = { ...label, updatedAt: new Date().toISOString() };
  if ((await storageMode()) === "cloud") {
    const res = await fetch(`/api/labels/${next.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (res.ok) {
      const { label: saved } = await res.json();
      return normalizeLabel(saved);
    }
    throw new Error(`Save failed (${res.status})`);
  }
  const all = readLocal().filter((l) => l.id !== next.id);
  writeLocal(sortByUpdated([next, ...all]));
  return next;
}

export async function deleteLabel(id: string): Promise<void> {
  if ((await storageMode()) === "cloud") {
    const res = await fetch(`/api/labels/${id}`, { method: "DELETE" });
    if (res.ok) return;
    throw new Error(`Delete failed (${res.status})`);
  }
  writeLocal(readLocal().filter((l) => l.id !== id));
}

/* ------------------------------- groups ------------------------------- */

function readLocalGroups(): LabelGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_GROUPS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalGroups(groups: LabelGroup[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_GROUPS, JSON.stringify(groups));
}

export async function listGroups(): Promise<LabelGroup[]> {
  if ((await storageMode()) === "cloud") {
    const res = await fetch("/api/groups", { cache: "no-store" });
    if (res.ok) return (await res.json()).groups as LabelGroup[];
  }
  return readLocalGroups();
}

export async function saveGroup(group: LabelGroup): Promise<LabelGroup> {
  if ((await storageMode()) === "cloud") {
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(group),
    });
    if (res.ok) return (await res.json()).group as LabelGroup;
    throw new Error(`Save group failed (${res.status})`);
  }
  const all = readLocalGroups().filter((g) => g.id !== group.id);
  writeLocalGroups([...all, group]);
  return group;
}

/** Deletes the group and clears it from every label that used it. */
export async function deleteGroup(id: string): Promise<void> {
  if ((await storageMode()) === "cloud") {
    const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
    if (res.ok) return;
    throw new Error(`Delete group failed (${res.status})`);
  }
  writeLocalGroups(readLocalGroups().filter((g) => g.id !== id));
  const labels = readLocal();
  const touched = labels.map((l) => (l.groupId === id ? { ...l, groupId: "" } : l));
  writeLocal(touched);
}

export async function importLabels(labels: CoffeeLabel[]): Promise<number> {
  let count = 0;
  for (const raw of labels) {
    if (!raw?.id) continue;
    await saveLabel(normalizeLabel(raw));
    count += 1;
  }
  return count;
}
