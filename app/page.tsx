"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StickerScaler from "@/components/StickerScaler";
import { sampleLabel } from "@/lib/sample";
import * as store from "@/lib/store";
import type { StorageMode } from "@/lib/store";
import {
  type CoffeeLabel,
  ROAST_LEVELS,
  daysSince,
  emptyLabel,
  formatDate,
  labelTitle,
  normalizeLabel,
  uid,
} from "@/lib/types";

export default function LibraryPage() {
  const router = useRouter();
  const [labels, setLabels] = useState<CoffeeLabel[] | null>(null);
  const [mode, setMode] = useState<StorageMode | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(
    () =>
      Promise.all([store.listLabels(), store.storageMode()]).then(([list, m]) => {
        setLabels(list);
        setMode(m);
      }),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!labels) return [];
    const q = query.trim().toLowerCase();
    if (!q) return labels;
    return labels.filter((l) =>
      [l.coffeeName, l.roaster, l.variety, l.origin, l.process, ...l.tastingNotes]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [labels, query]);

  async function createNew() {
    setBusy(true);
    try {
      const label = emptyLabel();
      await store.saveLabel(label);
      router.push(`/editor/${label.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function addSample() {
    setBusy(true);
    try {
      await store.saveLabel(sampleLabel());
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(label: CoffeeLabel) {
    setBusy(true);
    try {
      await store.saveLabel({
        ...label,
        id: uid(),
        coffeeName: `${labelTitle(label)} (copy)`,
        createdAt: new Date().toISOString(),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(label: CoffeeLabel) {
    if (!confirm(`Delete "${labelTitle(label)}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await store.deleteLabel(label.id);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function exportAll() {
    if (!labels?.length) return;
    const blob = new Blob([JSON.stringify(labels, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bean-labels-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(file: File) {
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text());
      const arr: CoffeeLabel[] = Array.isArray(parsed) ? parsed : [parsed];
      const count = await store.importLabels(arr.map((l) => normalizeLabel(l)));
      await refresh();
      alert(`Imported ${count} label${count === 1 ? "" : "s"}.`);
    } catch {
      alert("That file could not be read as a Bean Label export.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex-1">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-4">
          <div className="mr-auto flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="font-serif text-xl leading-tight font-semibold">Bean Label</h1>
              <p className="text-xs text-muted">Coffee sticker studio</p>
            </div>
          </div>
          <StorageBadge mode={mode} />
          <button className="btn" onClick={exportAll} disabled={!labels?.length}>
            Export
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
            }}
          />
          <button className="btn btn-primary" onClick={createNew} disabled={busy}>
            + New label
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-5 flex items-center gap-3">
          <input
            className="input max-w-xs"
            placeholder="Search coffee, roaster, origin…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {labels && (
            <span className="text-xs text-muted">
              {filtered.length} of {labels.length} label{labels.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {labels === null && <p className="text-sm text-muted">Loading…</p>}

        {labels && labels.length === 0 && (
          <div className="panel flex flex-col items-center gap-4 px-6 py-16 text-center">
            <Logo big />
            <div>
              <h2 className="font-serif text-2xl font-semibold">No labels yet</h2>
              <p className="mt-1 max-w-md text-sm text-muted">
                Create a sticker with your roaster details, roast level and up to five brew
                recipes — then print it and stick it on the bag.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={createNew} disabled={busy}>
                Create your first label
              </button>
              <button className="btn" onClick={addSample} disabled={busy}>
                Load a sample
              </button>
            </div>
          </div>
        )}

        {labels && labels.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((label) => {
              const age = daysSince(label.roastDate);
              return (
                <article key={label.id} className="panel overflow-hidden">
                  <Link href={`/editor/${label.id}`} className="block bg-paper p-4">
                    <StickerScaler label={label} preview />
                  </Link>
                  <div className="border-t border-line px-4 py-3">
                    <h3 className="truncate font-serif text-base font-semibold">
                      {labelTitle(label)}
                    </h3>
                    <p className="truncate text-xs text-muted">
                      {label.roaster || "No roaster"} ·{" "}
                      {ROAST_LEVELS[label.roastLevel].name} roast
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {label.roastDate ? formatDate(label.roastDate) : "No roast date"}
                      {age !== null && age >= 0 && ` · ${age}d ago`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <Link href={`/editor/${label.id}`} className="btn btn-ghost">
                        Edit
                      </Link>
                      <Link href={`/print/${label.id}`} className="btn btn-ghost">
                        Print
                      </Link>
                      <button
                        className="btn btn-ghost"
                        onClick={() => duplicate(label)}
                        disabled={busy}
                      >
                        Duplicate
                      </button>
                      <button
                        className="btn btn-ghost btn-danger ml-auto"
                        onClick={() => remove(label)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function StorageBadge({ mode }: { mode: StorageMode | null }) {
  if (!mode) return null;
  const cloud = mode === "cloud";
  return (
    <span
      title={
        cloud
          ? "Labels are saved to your Postgres database"
          : "No DATABASE_URL set — labels are saved in this browser only"
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-semibold"
      style={{ color: cloud ? "#2E6B4B" : "#8A5A2B" }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: cloud ? "#2E6B4B" : "#C89B4A" }}
      />
      {cloud ? "Database" : "This browser"}
    </span>
  );
}

function Logo({ big = false }: { big?: boolean }) {
  const s = big ? 44 : 32;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <g transform="rotate(-32 12 12)">
        <ellipse cx="12" cy="12" rx="6.6" ry="9.8" fill="#6f4423" />
        <path
          d="M12 3.2c-3 4.2-3 13.4 0 17.6"
          fill="none"
          stroke="#f6f2ec"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
