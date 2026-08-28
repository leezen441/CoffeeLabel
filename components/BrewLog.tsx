"use client";

import { useCallback, useEffect, useState } from "react";
import * as store from "@/lib/store";
import { applyChanges, dialIn } from "@/lib/dialIn";
import { type Lang, makeT, t, useLang } from "@/lib/i18n";
import {
  type BrewEntry,
  type BrewMethod,
  type TasteFlag,
  TASTE_FLAGS,
  type Palette,
  dialLabel,
  emptyEntry,
  formatDoseYield,
  formatTime,
  formatWeight,
  grinderOf,
  ratioOf,
  stepTimeLabel,
} from "@/lib/types";

function when(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const stamp = d.toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
    day: "2-digit",
    month: "short",
  });
  if (days <= 0) return `${t(lang, "today")} · ${stamp}`;
  if (days === 1) return `${t(lang, "yesterday")} · ${stamp}`;
  return `${days}${t(lang, "dAgo")} · ${stamp}`;
}

/**
 * The brew log for one recipe: what was actually poured, how it tasted, and
 * what to change next time.
 */
export default function BrewLog({
  labelId,
  brew,
  theme,
  onStart,
  onApply,
}: {
  labelId: string;
  brew: BrewMethod;
  theme: Palette;
  /** run this exact recipe on the timer */
  onStart: (next: BrewMethod) => void;
  /** write this recipe back over the saved one */
  onApply: (next: BrewMethod) => Promise<void> | void;
}) {
  const [entries, setEntries] = useState<BrewEntry[] | null>(null);
  const [draft, setDraft] = useState<BrewEntry | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Which suggested changes are ticked. Keyed by a signature of the advice so a
   * new suggestion starts from its own defaults instead of inheriting old ticks.
   */
  const [picks, setPicks] = useState<{ sig: string; on: Set<string> } | null>(null);

  const lang = useLang();
  const tr = makeT(lang);
  const method = brew.name || "Method";

  const refresh = useCallback(
    () =>
      store.listEntries(labelId).then((all) => {
        setEntries(all.filter((e) => e.methodName === method));
      }),
    [labelId, method],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const last = entries?.[0];
  const advice = dialIn(brew, last, lang);
  const changes = advice?.changes ?? [];
  const sig = changes.map((c) => `${c.field}:${c.to}`).join("|");
  const selected =
    picks && picks.sig === sig
      ? picks.on
      : new Set(changes.filter((c) => !c.optional).map((c) => c.field));
  const taken = changes.filter((c) => selected.has(c.field));
  /** the recipe as it would be after the ticked changes */
  const proposed = applyChanges(brew, taken);
  const { dial } = grinderOf(brew);
  const dialWord =
    lang === "th"
      ? { clicks: "คลิก", number: "เบอร์", microns: "µm" }[dial]
      : { clicks: "clicks", number: "dial", microns: "µm" }[dial];

  function begin() {
    // Pre-fill from the recipe so a normal brew is two taps and done.
    setDraft({
      ...emptyEntry(labelId, method),
      grind: advice?.suggestedGrind ?? brew.grind,
      doseG: brew.doseG,
      yieldG: brew.yieldG,
      timeText: brew.totalTime,
    });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      await store.saveEntry(draft);
      setDraft(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(tr("deleteBrewQ"))) return;
    setBusy(true);
    try {
      await store.deleteEntry(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const togglePick = (field: string) => {
    const on = new Set(selected);
    if (on.has(field)) on.delete(field);
    else on.add(field);
    setPicks({ sig, on });
  };

  async function replaceRecipe() {
    if (taken.length === 0) return;
    if (!confirm(tr("replaceConfirm"))) return;
    setBusy(true);
    try {
      await onApply(proposed);
    } finally {
      setBusy(false);
    }
  }

  const toggleTaste = (id: TasteFlag) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            taste: d.taste.includes(id)
              ? d.taste.filter((t) => t !== id)
              : [...d.taste, id],
          }
        : d,
    );

  const field =
    "w-full rounded-lg px-2.5 py-2 text-sm font-mono";
  const fieldStyle = {
    background: "rgb(255 255 255 / 0.6)",
    border: `1px solid ${theme.rule}`,
    color: theme.ink,
  };

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2
          className="text-[0.65rem] font-bold uppercase tracking-[0.14em]"
          style={{ color: theme.accent }}
        >
          {tr("brewLog")} · {method}
        </h2>
        {!draft && (
          <button
            onClick={begin}
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: theme.accent, color: theme.paper }}
          >
            {tr("logABrew")}
          </button>
        )}
      </div>

      {advice && !draft && (
        <div
          className="mb-3 rounded-xl p-4"
          style={{ border: `1px solid ${theme.rule}`, background: "rgb(255 255 255 / 0.6)" }}
        >
          <p
            className="text-[0.65rem] font-bold uppercase tracking-[0.12em]"
            style={{ color: theme.muted }}
          >
            {tr("nextTime")}
          </p>
          <p className="mt-0.5 font-serif text-xl font-semibold">{advice.headline}</p>
          <p className="mt-1 text-sm leading-snug" style={{ color: theme.muted }}>
            {advice.because}
          </p>

          <ol className="mt-3 flex flex-col gap-2">
            {advice.actions.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold"
                  style={{
                    background: i === 0 ? theme.accent : "transparent",
                    border: i === 0 ? "none" : `1px solid ${theme.rule}`,
                    color: i === 0 ? theme.paper : theme.muted,
                  }}
                >
                  {i + 1}
                </span>
                <span>
                  {a.text}
                  {a.why && (
                    <span className="block text-xs" style={{ color: theme.muted }}>
                      {a.why}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>

          {advice.numbers.length > 0 && (
            <ul
              className="mt-3 border-t pt-2 text-xs"
              style={{ borderColor: theme.rule, color: theme.muted }}
            >
              {advice.numbers.map((n, i) => (
                <li key={i}>· {n}</li>
              ))}
            </ul>
          )}

          {/* The advice as a recipe you can actually brew, not just read. */}
          <div className="mt-4 border-t pt-3" style={{ borderColor: theme.rule }}>
            <p
              className="text-[0.65rem] font-bold uppercase tracking-[0.12em]"
              style={{ color: theme.muted }}
            >
              {tr("nextBrew")}
            </p>

            {changes.length === 0 ? (
              <p className="mt-1 text-sm" style={{ color: theme.muted }}>
                {tr("noChangeNeeded")}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {changes.map((c) => {
                  const on = selected.has(c.field);
                  return (
                    <li key={c.field}>
                      <label className="flex cursor-pointer items-baseline gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => togglePick(c.field)}
                          className="mt-0.5"
                        />
                        <span>
                          <b>{c.label}</b>{" "}
                          <span style={{ color: theme.muted }}>
                            {c.from || "—"} →{" "}
                          </span>
                          <b
                            className="font-mono"
                            style={{ color: on ? theme.accent : theme.muted }}
                          >
                            {c.to}
                          </b>
                          {c.optional && (
                            <span
                              className="ml-1.5 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold uppercase"
                              style={{ border: `1px solid ${theme.rule}`, color: theme.muted }}
                            >
                              {tr("optionalTag")}
                            </span>
                          )}
                          {c.why && (
                            <span className="block text-xs" style={{ color: theme.muted }}>
                              {c.why}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            <div
              className="mt-3 rounded-lg p-3"
              style={{ border: `1px solid ${theme.rule}`, background: "rgb(255 255 255 / 0.5)" }}
            >
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
                {(
                  [
                    [tr("grind"), dialLabel(proposed), proposed.grind !== brew.grind],
                    [
                      tr("water"),
                      proposed.waterTempC ? `${proposed.waterTempC}°C` : "",
                      proposed.waterTempC !== brew.waterTempC,
                    ],
                    [
                      tr("doseYield"),
                      formatDoseYield(proposed.doseG, proposed.yieldG),
                      proposed.doseG !== brew.doseG || proposed.yieldG !== brew.yieldG,
                    ],
                    [tr("ratio"), ratioOf(proposed), ratioOf(proposed) !== ratioOf(brew)],
                    [
                      tr("time"),
                      formatTime(proposed.totalTime),
                      proposed.totalTime !== brew.totalTime,
                    ],
                  ] as const
                )
                  .filter(([, value]) => value)
                  .map(([name, value, moved]) => (
                    <span key={name}>
                      <span className="text-[0.65rem] uppercase" style={{ color: theme.muted }}>
                        {name}{" "}
                      </span>
                      <b style={{ color: moved ? theme.accent : theme.ink }}>{value}</b>
                    </span>
                  ))}
              </div>

              {proposed.steps.some((s) => s.text.trim()) && (
                <ol className="mt-2 flex flex-col gap-1 text-sm">
                  {proposed.steps
                    .filter((s) => s.text.trim())
                    .map((s, i) => (
                      <li key={s.id} className="flex items-baseline gap-2">
                        <span className="font-mono text-xs" style={{ color: theme.muted }}>
                          {i + 1}.
                        </span>
                        <span className="flex-1">{s.text}</span>
                        {s.waterG && (
                          <span className="font-mono text-xs">{formatWeight(s.waterG)}</span>
                        )}
                        {stepTimeLabel(s) && (
                          <span className="font-mono text-xs" style={{ color: theme.muted }}>
                            {stepTimeLabel(s)}
                          </span>
                        )}
                      </li>
                    ))}
                </ol>
              )}

              {proposed.yieldG !== brew.yieldG && (
                <p className="mt-1.5 text-xs" style={{ color: theme.muted }}>
                  {tr("poursRescaled")}
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => onStart(proposed)}
                className="rounded-full px-5 py-2 text-sm font-bold"
                style={{ background: theme.accent, color: theme.paper }}
              >
                {tr("startBrewNow")}
              </button>
              <button
                onClick={replaceRecipe}
                disabled={busy || taken.length === 0}
                className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40"
                style={{ border: `1px solid ${theme.accent}`, color: theme.accent }}
              >
                {tr("replaceRecipe")}
              </button>
            </div>
          </div>
        </div>
      )}

      {draft && (
        <div
          className="mb-3 rounded-xl p-3"
          style={{ border: `1px solid ${theme.accent}`, background: "rgb(255 255 255 / 0.7)" }}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["grind", `${tr("grind")} (${dialWord})`, brew.grind],
                ["doseG", tr("dose"), brew.doseG],
                ["yieldG", tr("yieldLabel"), brew.yieldG],
                ["timeText", tr("time"), brew.totalTime],
              ] as const
            ).map(([key, label, ph]) => (
              <label key={key} className="block">
                <span
                  className="mb-1 block text-[0.6rem] font-bold uppercase tracking-[0.08em]"
                  style={{ color: theme.muted }}
                >
                  {label}
                </span>
                <input
                  className={field}
                  style={fieldStyle}
                  placeholder={ph || "—"}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>

          {/* Taste and flow are separate evidence, so they are asked separately */}
          {(
            [
              ["taste", tr("howTaste")],
              ["flow", tr("howRun")],
            ] as const
          ).map(([group, heading]) => (
            <div key={group}>
              <p
                className="mt-3 mb-1 text-[0.6rem] font-bold uppercase tracking-[0.08em]"
                style={{ color: theme.muted }}
              >
                {heading}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TASTE_FLAGS.filter((t) => t.group === group).map((t) => {
                  const on = draft.taste.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTaste(t.id)}
                      aria-pressed={on}
                      title={lang === "th" ? t.hintTh : t.hint}
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{
                        background: on ? theme.accent : "transparent",
                        border: `1px solid ${on ? theme.accent : theme.rule}`,
                        color: on ? theme.paper : theme.muted,
                      }}
                    >
                      {lang === "th" ? t.labelTh : t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {draft.taste.length > 0 && (
            <p className="mt-2 text-xs leading-snug" style={{ color: theme.muted }}>
              {TASTE_FLAGS.filter((t) => draft.taste.includes(t.id))
                .map((t) =>
                  lang === "th" ? `${t.labelTh}: ${t.hintTh}` : `${t.label}: ${t.hint}`,
                )
                .join(" · ")}
            </p>
          )}

          <div className="mt-3 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setDraft({ ...draft, rating: draft.rating === n ? 0 : n })}
                aria-label={`${n} star`}
                className="text-2xl leading-none"
                style={{ color: n <= draft.rating ? theme.accent : theme.rule }}
              >
                ★
              </button>
            ))}
          </div>

          <input
            className={`${field} mt-3`}
            style={{ ...fieldStyle, fontFamily: "inherit" }}
            placeholder={tr("noteOptional")}
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />

          <div className="mt-3 flex gap-2">
            <button
              onClick={save}
              disabled={busy}
              className="rounded-full px-5 py-2 text-sm font-bold"
              style={{ background: theme.accent, color: theme.paper }}
            >
              {tr("saveBrew")}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-full px-4 py-2 text-sm font-semibold"
              style={{ border: `1px solid ${theme.rule}`, color: theme.muted }}
            >
              {tr("cancel")}
            </button>
          </div>
        </div>
      )}

      {entries && entries.length === 0 && !draft && (
        <p className="text-sm" style={{ color: theme.muted }}>
          {tr("nothingLogged")}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {(entries ?? []).map((e) => (
          <li
            key={e.id}
            className="rounded-xl p-3"
            style={{ border: `1px solid ${theme.rule}` }}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs" style={{ color: theme.muted }}>
                {when(e.brewedAt, lang)}
              </span>
              {e.rating > 0 && (
                <span style={{ color: theme.accent }}>{"★".repeat(e.rating)}</span>
              )}
              <button
                onClick={() => remove(e.id)}
                className="ml-auto text-xs"
                style={{ color: theme.muted }}
                aria-label="Delete this brew"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 font-mono text-sm">
              {[
                e.grind && `${e.grind} ${dialWord}`,
                e.doseG && e.yieldG
                  ? `${e.doseG}→${e.yieldG} g`
                  : e.doseG && formatWeight(e.doseG),
                e.timeText,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
            {e.taste.length > 0 && (
              <p className="mt-1 text-xs" style={{ color: theme.muted }}>
                {e.taste
                  .map((t) => { const f = TASTE_FLAGS.find((x) => x.id === t); return f ? (lang === "th" ? f.labelTh : f.label) : t; })
                  .join(" · ")}
              </p>
            )}
            {e.note && <p className="mt-1 text-sm">{e.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
