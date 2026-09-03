"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import BrewEditor from "./BrewEditor";
import { recallBrew, useRememberedNames } from "@/lib/methodMemory";
import LangToggle from "./LangToggle";
import { type MsgKey, makeT, useLang } from "@/lib/i18n";
import * as store from "@/lib/store";
import {
  type BrewMethod,
  type CoffeeLabel,
  type LabelGroup,
  type RoastLevel,
  FLAVOR_FAMILIES,
  MAX_BREWS,
  MAX_PROCESSES,
  METHOD_PRESETS,
  PROCESS_GROUPS,
  ROAST_LEVELS,
  ROAST_PALETTES,
  emptyBrew,
  flavorColor,
  labelTitle,
  restWindow,
} from "@/lib/types";
import { brewFromTemplate } from "@/lib/brewTemplates";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function LabelEditor({ id }: { id: string }) {
  const [label, setLabel] = useState<CoffeeLabel | null>(null);
  const [missing, setMissing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [noteDraft, setNoteDraft] = useState("");
  const [groups, setGroups] = useState<LabelGroup[]>([]);
  const [customProcess, setCustomProcess] = useState(false);
  const [processDraft, setProcessDraft] = useState("");
  /**
   * The brew methods are long enough to deserve their own screen. `?view=brews`
   * opens straight on them, which is what the brew guide links to.
   */
  const params = useSearchParams();
  const remembered = useRememberedNames();
  /** Built-in starters first, then the methods you have set up yourself. */
  const methodChips = useMemo(() => {
    const builtIn = new Set(METHOD_PRESETS.map((n) => n.toLowerCase()));
    return [
      ...METHOD_PRESETS,
      ...remembered.filter((n) => !builtIn.has(n.toLowerCase())),
    ];
  }, [remembered]);

  const [view, setView] = useState<"details" | "brews">(
    params.get("view") === "brews" ? "brews" : "details",
  );
  const tr = makeT(useLang());

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
        <h1 className="font-serif text-2xl font-semibold">{tr("labelNotFound")}</h1>
        <p className="mt-2 text-sm text-muted">
          {tr("labelNotFoundBody")}
        </p>
        <Link href="/" className="btn btn-primary mt-5">
          {tr("backToLibrary")}
        </Link>
      </div>
    );
  }

  if (!label) return <p className="px-5 py-10 text-sm text-muted">{tr("loading")}</p>;

  const setBrew = (i: number, next: BrewMethod) =>
    update({ brews: label.brews.map((b, j) => (j === i ? next : b)) });

  const addBrew = () => {
    if (label.brews.length >= MAX_BREWS) return;
    update({ brews: [...label.brews, emptyBrew()] });
  };

  const addTemplatedBrew = (name: string) => {
    if (label.brews.length >= MAX_BREWS) return;
    const next = recallBrew(name) ?? brewFromTemplate(name);
    update({ brews: [...label.brews, next] });
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

  const rest = restWindow(label);
  /** A stage is added once; the picker hides what is already on the label. */
  const addProcess = (name: string) => {
    const value = name.trim();
    if (!value || label.processes.length >= MAX_PROCESSES) return;
    if (label.processes.some((p) => p.toLowerCase() === value.toLowerCase())) return;
    update({ processes: [...label.processes, value] });
  };

  /**
   * Takes one note or a whole list at once — "jasmine, peach, black tea" is how
   * roasters write them on the bag, so pasting that in should just work.
   */
  const addNote = () => {
    const added = noteDraft
      .split(/[,;\n]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (added.length === 0) return;
    const next = [...label.tastingNotes];
    for (const note of added) {
      // case-insensitive, so "Peach" typed twice does not become two chips
      if (!next.some((n) => n.toLowerCase() === note.toLowerCase())) next.push(note);
    }
    if (next.length > label.tastingNotes.length) update({ tastingNotes: next });
    setNoteDraft("");
  };


  return (
    <div className="flex-1">
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-5 py-3">
          <Link href="/" className="btn btn-ghost">
            ← {tr("library")}
          </Link>
          <h1 className="mr-auto truncate font-serif text-lg font-semibold">
            {labelTitle(label)}
          </h1>
          <LangToggle />
          <SaveIndicator state={saveState} tr={tr} />
          <Link href={`/b/${label.id}`} className="btn" target="_blank">
            {tr("brewGuide")}
          </Link>
          <select
            className="select w-auto"
            value={label.groupId}
            onChange={(e) => update({ groupId: e.target.value })}
            aria-label={tr("fGroup")}
            title={groups.length ? tr("filterByThis") : tr("createGroupsHint")}
          >
            <option value="">{tr("noGroup")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            className={view === "brews" ? "btn btn-primary" : "btn"}
            aria-pressed={view === "brews"}
            onClick={() => setView(view === "brews" ? "details" : "brews")}
          >
            {tr("secBrews")} ({label.brews.length}/{MAX_BREWS})
          </button>
          <Link href={`/print/${label.id}`} className="btn btn-primary">
            {tr("printStickers")}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-6">
        {/* Sticker appearance and preview live on the print page. */}
        <div className="flex flex-col gap-5">
          {view === "details" && (
            <>
          <section className="panel p-4">
            <h2 className="section-title mb-3">{tr("secCoffee")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field">
                <span>{tr("fRoaster")}</span>
                <input
                  className="input"
                  placeholder="Roots Coffee Roasters"
                  value={label.roaster}
                  onChange={(e) => update({ roaster: e.target.value })}
                />
              </label>
              <label className="field">
                <span>{tr("fCoffeeName")}</span>
                <input
                  className="input"
                  placeholder="Ethiopia Guji Uraga"
                  value={label.coffeeName}
                  onChange={(e) => update({ coffeeName: e.target.value })}
                />
              </label>
              <label className="field">
                <span>{tr("fVariety")}</span>
                <input
                  className="input"
                  placeholder="Heirloom, Geisha, SL28…"
                  value={label.variety}
                  onChange={(e) => update({ variety: e.target.value })}
                />
              </label>
              <div className="field">
                <span>
                  {tr("fProcess")} ({label.processes.length}/{MAX_PROCESSES})
                </span>
                {label.processes.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {label.processes.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-brand-soft px-2.5 py-1 text-xs font-normal normal-case tracking-normal"
                      >
                        {name}
                        <button
                          className="text-muted hover:text-ink"
                          aria-label={`Remove ${name}`}
                          onClick={() =>
                            update({
                              processes: label.processes.filter((p) => p !== name),
                            })
                          }
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {label.processes.length < MAX_PROCESSES && (
                  <select
                    className="select"
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__custom") {
                        setCustomProcess(true);
                      } else if (v) {
                        addProcess(v);
                        setCustomProcess(false);
                      }
                    }}
                  >
                    <option value="">{tr("addProcess")}</option>
                    {PROCESS_GROUPS.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items
                          .filter(
                            (p) =>
                              !label.processes.some(
                                (has) => has.toLowerCase() === p.name.toLowerCase(),
                              ),
                          )
                          .map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name}
                              {p.restBias !== 0
                                ? ` (${p.restBias > 0 ? "+" : ""}${p.restBias}${tr("dRest")})`
                                : ""}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                    <option value="__custom">{tr("otherDots")}</option>
                  </select>
                )}
                {customProcess && label.processes.length < MAX_PROCESSES && (
                  <input
                    className="input mt-2"
                    placeholder={tr("typeProcess")}
                    value={processDraft}
                    onChange={(e) => setProcessDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      addProcess(processDraft);
                      setProcessDraft("");
                      setCustomProcess(false);
                    }}
                  />
                )}
              </div>
              <label className="field">
                <span>{tr("fOrigin")}</span>
                <input
                  className="input"
                  placeholder="Guji, Ethiopia"
                  value={label.origin}
                  onChange={(e) => update({ origin: e.target.value })}
                />
              </label>
              <label className="field">
                <span>{tr("fAltitude")}</span>
                <input
                  className="input"
                  placeholder="2,050 masl"
                  value={label.altitude}
                  onChange={(e) => update({ altitude: e.target.value })}
                />
              </label>
            </div>
          </section>

          <section className="panel p-4">
            <h2 className="section-title mb-3">{tr("secRoast")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-2 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                  {tr("fRoastLevel")}
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
                            fill={
                              n <= label.roastLevel ? ROAST_PALETTES[n].bean : "none"
                            }
                            stroke={ROAST_PALETTES[n].bean}
                            strokeWidth="1.6"
                          />
                          <path
                            d="M12 3.2c-3 4.2-3 13.4 0 17.6"
                            fill="none"
                            stroke={
                              n <= label.roastLevel
                                ? ROAST_PALETTES[n].paper
                                : ROAST_PALETTES[n].bean
                            }
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
                  <span>{tr("fRoastDate")}</span>
                  <input
                    type="date"
                    className="input"
                    value={label.roastDate}
                    onChange={(e) => update({ roastDate: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>{tr("fBestBeforeDays")}</span>
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
                  <span>{tr("fNetWeight")}</span>
                  <input
                    className="input"
                    placeholder="250"
                    value={label.netWeight}
                    onChange={(e) => update({ netWeight: e.target.value })}
                  />
                  <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-muted">
                    <b className="text-ink">g.</b> {tr("gAuto")}
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
              <label className="field">
                <span>{tr("fRoastIndicator")}</span>
                <select
                  className="select"
                  value={label.roastDisplay}
                  onChange={(e) =>
                    update({ roastDisplay: e.target.value as "beans" | "scale" })
                  }
                >
                  <option value="scale">{tr("segScale")}</option>
                  <option value="beans">{tr("coffeeBeans")}</option>
                </select>
              </label>

              <div className="field">
                <span>{tr("fRestWindow")}</span>
                <label className="flex h-[38px] items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={label.showRest}
                    onChange={(e) => update({ showRest: e.target.checked })}
                  />
                  <span className="font-normal normal-case tracking-normal text-ink">
                    {tr("showPeakBar")}
                  </span>
                </label>
              </div>

              {label.showRest && (
                <div className="sm:col-span-2 rounded-lg border border-line bg-paper/60 p-3">
                  <p className="text-xs text-muted">
                    <b className="text-ink">{rest.basis}</b> →{" "}
                    <b className="text-ink">
                      {tr("dayWord")} {rest.from}–{rest.to}
                    </b>{" "}
                    {tr("afterRoasting")}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <label className="field">
                      <span>{tr("fRestFrom")}</span>
                      <input
                        type="number"
                        min={0}
                        className="input"
                        placeholder={tr("autoWord")}
                        value={label.restFrom || ""}
                        onChange={(e) => update({ restFrom: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <label className="field">
                      <span>{tr("fRestTo")}</span>
                      <input
                        type="number"
                        min={0}
                        className="input"
                        placeholder={tr("autoWord")}
                        value={label.restTo || ""}
                        onChange={(e) => update({ restTo: Number(e.target.value) || 0 })}
                      />
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {tr("restHelp")}
                  </p>
                </div>
              )}

              <div className="field sm:col-span-2">
                <span>{tr("fDoseTracker")}</span>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={label.showDoseBoxes}
                      onChange={(e) => update({ showDoseBoxes: e.target.checked })}
                    />
                    <span className="font-normal normal-case tracking-normal text-ink">
                      {tr("printTickBoxes")}
                    </span>
                  </label>
                  {label.showDoseBoxes && (
                    <label className="flex items-center gap-2 text-sm">
                      <span className="font-normal normal-case tracking-normal text-muted">
                        {tr("howMany")}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        className="input w-20"
                        value={label.doseBoxes}
                        onChange={(e) =>
                          update({
                            doseBoxes: Math.min(12, Math.max(1, Number(e.target.value) || 1)),
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="panel p-4">
            <h2 className="section-title mb-3">
              {tr("secNotes")} ({label.tastingNotes.length})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {label.tastingNotes.map((note) => (
                <span
                  key={note}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-brand-soft px-3 py-1 text-sm"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: flavorColor(note) }}
                  />
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
              <span className="flex items-center gap-1.5">
                  <input
                    className="input w-56"
                    placeholder="Jasmine, Peach, Black tea"
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
                    {tr("addWord")}
                  </button>
              </span>
            </div>

            <p className="mt-3 mb-1.5 text-xs text-muted">{tr("quickPick")}</p>
            <div className="flex flex-wrap gap-1.5">
              {FLAVOR_FAMILIES.filter(
                    (f) => !label.tastingNotes.includes(f.name),
                  ).map((f) => (
                    <button
                      key={f.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs hover:border-brand"
                      onClick={() =>
                        update({ tastingNotes: [...label.tastingNotes, f.name] })
                      }
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: f.color }}
                      />
                      {f.name}
                    </button>
                  ))}
            </div>
          </section>
            </>
          )}

          {view === "brews" && (
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title">
                {tr("secBrews")} ({label.brews.length}/{MAX_BREWS})
              </h2>
              <button
                className="btn"
                onClick={addBrew}
                disabled={label.brews.length >= MAX_BREWS}
              >
                {tr("addMethod")}
              </button>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {methodChips.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="btn text-xs"
                  title={`${tr("addTemplate")} ${name}`}
                  disabled={label.brews.length >= MAX_BREWS}
                  onClick={() => addTemplatedBrew(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="mb-3 text-xs text-muted">{tr("templateHint")}</p>
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
                  {tr("noBrewsYet")} {MAX_BREWS}.
                </p>
              )}
            </div>
          </section>
          )}
        </div>

      </div>
    </div>
  );
}

function SaveIndicator({
  state,
  tr,
}: {
  state: SaveState;
  tr: (key: MsgKey) => string;
}) {
  const map: Record<SaveState, { text: string; color: string }> = {
    idle: { text: "", color: "" },
    saving: { text: tr("saving"), color: "var(--muted)" },
    saved: { text: tr("allSaved"), color: "#2E6B4B" },
    error: { text: tr("saveFailed"), color: "var(--danger)" },
  };
  const { text, color } = map[state];
  if (!text) return null;
  return (
    <span className="text-xs font-semibold" style={{ color }}>
      {text}
    </span>
  );
}
