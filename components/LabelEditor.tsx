"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import BrewEditor from "./BrewEditor";
import * as store from "@/lib/store";
import {
  type BrewMethod,
  type CoffeeLabel,
  type LabelGroup,
  type RoastLevel,
  MAX_BREWS,
  MAX_NOTES,
  PROCESS_PRESETS,
  ROAST_LEVELS,
  emptyBrew,
  labelTitle,
} from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function LabelEditor({ id }: { id: string }) {
  const [label, setLabel] = useState<CoffeeLabel | null>(null);
  const [missing, setMissing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [noteDraft, setNoteDraft] = useState("");
  const [groups, setGroups] = useState<LabelGroup[]>([]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    void store.getLabel(id).then((l) => (l ? setLabel(l) : setMissing(true)));
    void store.listGroups().then(setGroups);
  }, [id]);

  const persist = useCallback(async (next: CoffeeLabel) => {
    setSaveState("saving");
    try {
      await store.saveLabel(next);
      dirty.current = false;
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, []);

  /** Debounced autosave on every edit. */
  const update = useCallback(
    (patch: Partial<CoffeeLabel>) => {
      setLabel((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        dirty.current = true;
        setSaveState("saving");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void persist(next), 700);
        return next;
      });
    },
    [persist],
  );

  // Flush pending edits when leaving the page.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  if (missing) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="font-serif text-2xl font-semibold">Label not found</h1>
        <p className="mt-2 text-sm text-muted">
          It may have been deleted, or saved in a different browser.
        </p>
        <Link href="/" className="btn btn-primary mt-5">
          Back to library
        </Link>
      </div>
    );
  }

  if (!label) return <p className="px-5 py-10 text-sm text-muted">Loading…</p>;

  const setBrew = (i: number, next: BrewMethod) =>
    update({ brews: label.brews.map((b, j) => (j === i ? next : b)) });

  const addBrew = () => {
    if (label.brews.length >= MAX_BREWS) return;
    update({ brews: [...label.brews, emptyBrew()] });
  };

  const removeBrew = (i: number) =>
    update({ brews: label.brews.filter((_, j) => j !== i) });

  const moveBrew = (i: number, dir: -1 | 1) => {
    const next = [...label.brews];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    update({ brews: next });
  };

  const addNote = () => {
    const value = noteDraft.trim();
    if (!value || label.tastingNotes.length >= MAX_NOTES) return;
    if (label.tastingNotes.includes(value)) {
      setNoteDraft("");
      return;
    }
    update({ tastingNotes: [...label.tastingNotes, value] });
    setNoteDraft("");
  };


  return (
    <div className="flex-1">
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-5 py-3">
          <Link href="/" className="btn btn-ghost">
            ← Library
          </Link>
          <h1 className="mr-auto truncate font-serif text-lg font-semibold">
            {labelTitle(label)}
          </h1>
          <SaveIndicator state={saveState} />
          <Link href={`/b/${label.id}`} className="btn" target="_blank">
            Brew guide
          </Link>
          <Link href={`/print/${label.id}`} className="btn btn-primary">
            Print stickers
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-6">
        {/* Sticker appearance and preview live on the print page. */}
        <div className="flex flex-col gap-5">
          <section className="panel p-4">
            <h2 className="section-title mb-3">The coffee</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field">
                <span>Roaster / shop name</span>
                <input
                  className="input"
                  placeholder="Roots Coffee Roasters"
                  value={label.roaster}
                  onChange={(e) => update({ roaster: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Coffee name</span>
                <input
                  className="input"
                  placeholder="Ethiopia Guji Uraga"
                  value={label.coffeeName}
                  onChange={(e) => update({ coffeeName: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Variety</span>
                <input
                  className="input"
                  placeholder="Heirloom, Geisha, SL28…"
                  value={label.variety}
                  onChange={(e) => update({ variety: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Process</span>
                <input
                  className="input"
                  list="process-presets"
                  placeholder="Washed"
                  value={label.process}
                  onChange={(e) => update({ process: e.target.value })}
                />
                <datalist id="process-presets">
                  {PROCESS_PRESETS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span>Origin</span>
                <input
                  className="input"
                  placeholder="Guji, Ethiopia"
                  value={label.origin}
                  onChange={(e) => update({ origin: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Altitude</span>
                <input
                  className="input"
                  placeholder="2,050 masl"
                  value={label.altitude}
                  onChange={(e) => update({ altitude: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Group</span>
                <select
                  className="select"
                  value={label.groupId}
                  onChange={(e) => update({ groupId: e.target.value })}
                >
                  <option value="">No group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-muted">
                  {groups.length
                    ? "Filter by this in the library"
                    : "Create groups from the library with + Group"}
                </span>
              </label>
            </div>
          </section>

          <section className="panel p-4">
            <h2 className="section-title mb-3">Roast</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-2 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  Roast level
                </span>
                <div className="flex items-center gap-1">
                  {([1, 2, 3, 4, 5] as RoastLevel[]).map((n) => (
                    <button
                      key={n}
                      type="button"
                      title={ROAST_LEVELS[n].name}
                      aria-label={`${ROAST_LEVELS[n].name} roast`}
                      aria-pressed={label.roastLevel === n}
                      onClick={() => update({ roastLevel: n })}
                      className="rounded-md p-1 transition hover:bg-brand-soft"
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24">
                        <g transform="rotate(-32 12 12)">
                          <ellipse
                            cx="12"
                            cy="12"
                            rx="6.6"
                            ry="9.8"
                            fill={n <= label.roastLevel ? "#6f4423" : "none"}
                            stroke="#6f4423"
                            strokeWidth="1.6"
                          />
                          <path
                            d="M12 3.2c-3 4.2-3 13.4 0 17.6"
                            fill="none"
                            stroke={n <= label.roastLevel ? "#f6f2ec" : "#6f4423"}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </g>
                      </svg>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  <b className="text-ink">{ROAST_LEVELS[label.roastLevel].name}</b> —{" "}
                  {ROAST_LEVELS[label.roastLevel].blurb}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>Roast date</span>
                  <input
                    type="date"
                    className="input"
                    value={label.roastDate}
                    onChange={(e) => update({ roastDate: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Best before (days)</span>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={label.bestBeforeDays}
                    onChange={(e) =>
                      update({ bestBeforeDays: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="field col-span-2">
                  <span>Net weight</span>
                  <input
                    className="input"
                    placeholder="250 g"
                    value={label.netWeight}
                    onChange={(e) => update({ netWeight: e.target.value })}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="panel p-4">
            <h2 className="section-title mb-3">
              Tasting notes ({label.tastingNotes.length}/{MAX_NOTES})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {label.tastingNotes.map((note) => (
                <span
                  key={note}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-brand-soft px-3 py-1 text-sm"
                >
                  {note}
                  <button
                    className="text-muted hover:text-ink"
                    aria-label={`Remove ${note}`}
                    onClick={() =>
                      update({
                        tastingNotes: label.tastingNotes.filter((n) => n !== note),
                      })
                    }
                  >
                    ✕
                  </button>
                </span>
              ))}
              {label.tastingNotes.length < MAX_NOTES && (
                <span className="flex items-center gap-1.5">
                  <input
                    className="input w-44"
                    placeholder="Jasmine"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addNote();
                      }
                    }}
                  />
                  <button className="btn" onClick={addNote} disabled={!noteDraft.trim()}>
                    Add
                  </button>
                </span>
              )}
            </div>
          </section>

          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title">
                Brew methods ({label.brews.length}/{MAX_BREWS})
              </h2>
              <button
                className="btn"
                onClick={addBrew}
                disabled={label.brews.length >= MAX_BREWS}
              >
                + Add method
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {label.brews.map((brew, i) => (
                <BrewEditor
                  key={brew.id}
                  brew={brew}
                  index={i}
                  total={label.brews.length}
                  onChange={(next) => setBrew(i, next)}
                  onRemove={() => removeBrew(i)}
                  onMove={(dir) => moveBrew(i, dir)}
                />
              ))}
              {label.brews.length === 0 && (
                <p className="text-sm text-muted">
                  No brew methods yet — add up to {MAX_BREWS}.
                </p>
              )}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; color: string }> = {
    idle: { text: "", color: "" },
    saving: { text: "Saving…", color: "var(--muted)" },
    saved: { text: "All changes saved", color: "#2E6B4B" },
    error: { text: "Save failed", color: "var(--danger)" },
  };
  const { text, color } = map[state];
  if (!text) return null;
  return (
    <span className="text-xs font-semibold" style={{ color }}>
      {text}
    </span>
  );
}
