import type { BrewEntry, CoffeeLabel, LabelGroup } from "./types";
import { normalizeLabel } from "./types";
import { forgetScan } from "./scanMemory";

export type StorageMode = "cloud" | "local";

const LS_KEY = "coffee-labels/v1";
const LS_GROUPS = "coffee-groups/v1";

let modePromise: Promise<StorageMode> | null = null;

/** Cloud when a Postgres URL is configured on the server, otherwise localStorage. */
export function storageMode(): Promise<StorageMode> {
  if (!modePromise) {
    // The root layout writes the answer onto <html> as it renders. Asking the
    // server instead cost a full round trip before every first load of data.
    const written =
      typeof document === "undefined" ? undefined : document.documentElement.dataset.storage;
    modePromise =
      written === "cloud" || written === "local"
        ? Promise.resolve(written)
        : fetch("/api/status")
            .then((r) => (r.ok ? r.json() : { configured: false }))
            .then((j) => (j.configured ? "cloud" : "local") as StorageMode)
            .catch(() => "local" as StorageMode);
  }
  return modePromise;
}

/**
 * Labels this tab has already seen, by id. The library loads every label, so a
 * page opened from it can draw at once from here and refresh from the server
 * behind it, instead of showing nothing until a round trip comes back.
 */
const seen = new Map<string, CoffeeLabel>();

function remember(label: CoffeeLabel): CoffeeLabel {
  if (typeof window !== "undefined") seen.set(label.id, label);
  return label;
}

/** The label as this tab last saw it, or null. Never touches the network. */
export function cachedLabel(id: string): CoffeeLabel | null {
  return seen.get(id) ?? null;
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
  // Ties must return 0, or the sort is not stable and labels saved within the
  // same millisecond — a run of writes, say — come back in a random order.
  return [...labels].sort((a, b) => {
    if (a.updatedAt === b.updatedAt) return 0;
    return a.updatedAt < b.updatedAt ? 1 : -1;
  });
}

export async function listLabels(): Promise<CoffeeLabel[]> {
  if ((await storageMode()) === "cloud") {
    const res = await fetch("/api/labels", { cache: "no-store" });
    if (res.ok) {
      const { labels } = await res.json();
      return (labels as CoffeeLabel[]).map((l) => remember(normalizeLabel(l)));
    }
  }
  return sortByUpdated(readLocal()).map(remember);
}

export async function getLabel(id: string): Promise<CoffeeLabel | null> {
  if ((await storageMode()) === "cloud") {
    const res = await fetch(`/api/labels/${id}`, { cache: "no-store" });
    if (res.ok) {
      const { label } = await res.json();
      return remember(normalizeLabel(label));
    }
    if (res.status === 404) {
      seen.delete(id);
      return null;
    }
  }
  const local = readLocal().find((l) => l.id === id);
  return local ? remember(local) : null;
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
      return remember(normalizeLabel(saved));
    }
    throw new Error(`Save failed (${res.status})`);
  }
  const all = readLocal().filter((l) => l.id !== next.id);
  writeLocal(sortByUpdated([next, ...all]));
  return remember(next);
}

export async function deleteLabel(id: string): Promise<void> {
  seen.delete(id);
  forgetScan(id);
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
  // Replaced where it already sits, so renaming one does not send its chip
  // to the end of the row.
  const all = readLocalGroups();
  const at = all.findIndex((g) => g.id === group.id);
  if (at >= 0) all[at] = group;
  else all.push(group);
  writeLocalGroups(all);
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

/* ------------------------------- brew log ------------------------------- */

const LS_ENTRIES = "coffee-entries/v1";

function readLocalEntries(): BrewEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LS_ENTRIES) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalEntries(entries: BrewEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_ENTRIES, JSON.stringify(entries));
}

const byNewest = (a: BrewEntry, b: BrewEntry) => (a.brewedAt < b.brewedAt ? 1 : -1);

export async function listEntries(labelId?: string): Promise<BrewEntry[]> {
  if ((await storageMode()) === "cloud") {
    const qs = labelId ? `?labelId=${encodeURIComponent(labelId)}` : "";
    const res = await fetch(`/api/entries${qs}`, { cache: "no-store" });
    if (res.ok) return (await res.json()).entries as BrewEntry[];
  }
  const all = readLocalEntries().sort(byNewest);
  return labelId ? all.filter((e) => e.labelId === labelId) : all;
}

export async function saveEntry(entry: BrewEntry): Promise<BrewEntry> {
  if ((await storageMode()) === "cloud") {
    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (res.ok) return (await res.json()).entry as BrewEntry;
    throw new Error(`Save brew failed (${res.status})`);
  }
  const rest = readLocalEntries().filter((e) => e.id !== entry.id);
  writeLocalEntries([entry, ...rest].sort(byNewest));
  return entry;
}

export async function deleteEntry(id: string): Promise<void> {
  if ((await storageMode()) === "cloud") {
    const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (res.ok) return;
    throw new Error(`Delete brew failed (${res.status})`);
  }
  writeLocalEntries(readLocalEntries().filter((e) => e.id !== id));
}

/* ------------------------------- backup ------------------------------- */

export type Backup = {
  app: "bean-label";
  version: 1;
  exportedAt: string;
  groups: LabelGroup[];
  labels: CoffeeLabel[];
  entries?: BrewEntry[];
};

export async function exportBackup(): Promise<Backup> {
  const [labels, groups, entries] = await Promise.all([
    listLabels(),
    listGroups(),
    listEntries(),
  ]);
  return {
    app: "bean-label",
    version: 1,
    exportedAt: new Date().toISOString(),
    groups,
    labels,
    entries,
  };
}

/**
 * Restores a backup by upsert — nothing is deleted, and anything with the same
 * id is overwritten. Groups go first so the labels' groupId still resolves.
 * Also accepts a bare array of labels, the shape older exports used.
 */
export async function importBackup(
  raw: unknown,
): Promise<{ labels: number; groups: number; entries: number }> {
  const data = raw as Partial<Backup> | CoffeeLabel[];
  const groups = Array.isArray(data) ? [] : (data.groups ?? []);
  const labels = Array.isArray(data) ? data : (data.labels ?? []);
  const entries = Array.isArray(data) ? [] : (data.entries ?? []);
  if (!Array.isArray(labels)) throw new Error("No labels found in that file");

  let g = 0;
  for (const group of groups) {
    if (!group?.id || !group?.name) continue;
    await saveGroup(group);
    g += 1;
  }
  let l = 0;
  for (const label of labels) {
    if (!label?.id) continue;
    await saveLabel(normalizeLabel(label));
    l += 1;
  }
  let e = 0;
  for (const entry of entries) {
    if (!entry?.id || !entry?.labelId) continue;
    await saveEntry(entry);
    e += 1;
  }
  return { labels: l, groups: g, entries: e };
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
