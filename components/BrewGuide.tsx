"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BrewLog from "./BrewLog";
import BrewTimer from "./BrewTimer";
import * as store from "@/lib/store";
import {
  type BrewMethod,
  type CoffeeLabel,
  ROAST_LEVELS,
  THEMES,
  addDays,
  bestBefore,
  daysSince,
  dialLabel,
  grinderOf,
  formatDate,
  formatDateRange,
  restWindow,
  formatDoseYield,
  formatTime,
  formatWeight,
  labelTitle,
  ratioOf,
  scaleBrew,
  stepTimeLabel,
} from "@/lib/types";

export default function BrewGuide({
  id,
  initial,
}: {
  id: string;
  initial: CoffeeLabel | null;
}) {
  const [label, setLabel] = useState<CoffeeLabel | null>(initial);
  const [state, setState] = useState<"ready" | "loading" | "missing">(
    initial ? "ready" : "loading",
  );
  const [active, setActive] = useState(0);
  const [timing, setTiming] = useState<BrewMethod | null>(null);
  const [factor, setFactor] = useState(1);

  useEffect(() => {
    if (initial) return;
    void store.getLabel(id).then((l) => {
      if (l) {
        setLabel(l);
        setState("ready");
      } else {
        setState("missing");
      }
    });
  }, [id, initial]);

  if (state === "loading") {
    return <p className="px-5 py-10 text-sm text-muted">Loading…</p>;
  }

  if (state === "missing" || !label) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="font-serif text-2xl font-semibold">Brew guide not found</h1>
        <p className="mt-2 text-sm text-muted">
          This label is not in the database — it may only exist in the browser it was
          created in.
        </p>
        <Link href="/" className="btn btn-primary mt-5">
          Go to library
        </Link>
      </div>
    );
  }

  const theme = THEMES[label.theme] ?? THEMES.espresso;
  const brews = label.brews.filter((b) => b.name || b.steps.some((s) => s.text));
  const rawBrew = brews[Math.min(active, brews.length - 1)];
  // Scaling is presentational — the stored recipe is never touched.
  const brew = rawBrew ? scaleBrew(rawBrew, factor) : rawBrew;
  const age = daysSince(label.roastDate);
  const bb = bestBefore(label.roastDate, label.bestBeforeDays);
  const rest = restWindow(label);
  const restDates = label.showRest
    ? formatDateRange(
        addDays(label.roastDate, rest.from),
        addDays(label.roastDate, rest.to),
      )
    : "";
  const originBits = [label.variety, label.process, label.origin].filter(Boolean);
  const altitude = (label.altitude ?? "").trim();

  return (
    <div className="flex-1" style={{ background: theme.paper, color: theme.ink }}>
      <div className="mx-auto max-w-xl px-5 py-8">
        <p
          className="text-xs font-bold uppercase tracking-[0.18em]"
          style={{ color: theme.accent }}
        >
          {label.roaster || "Brew guide"}
        </p>
        <h1 className="mt-1 font-serif text-4xl leading-tight font-semibold">
          {labelTitle(label)}
        </h1>
        {originBits.length > 0 && (
          <p className="mt-2 text-sm" style={{ color: theme.muted }}>
            {originBits.join(" · ")}
          </p>
        )}
        {altitude && (
          <p className="text-sm" style={{ color: theme.muted }}>
            {altitude}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            <span className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <svg key={n} width="16" height="16" viewBox="0 0 24 24">
                  <g transform="rotate(-32 12 12)">
                    <ellipse
                      cx="12"
                      cy="12"
                      rx="6.6"
                      ry="9.8"
                      fill={n <= label.roastLevel ? theme.accent : "none"}
                      stroke={theme.accent}
                      strokeWidth="1.8"
                    />
                  </g>
                </svg>
              ))}
            </span>
            <b>{ROAST_LEVELS[label.roastLevel].name}</b>
          </span>
          {label.roastDate && (
            <span style={{ color: theme.muted }}>
              Roasted <b style={{ color: theme.ink }}>{formatDate(label.roastDate)}</b>
              {age !== null && age >= 0 && ` · ${age} days ago`}
            </span>
          )}
          {label.netWeight && (
            <span style={{ color: theme.muted }}>
              Net <b style={{ color: theme.ink }}>{formatWeight(label.netWeight)}</b>
            </span>
          )}
        </div>

        {label.tastingNotes.length > 0 && (
          <p className="mt-3 font-serif text-lg italic">
            {label.tastingNotes.join("  ·  ")}
          </p>
        )}

        {bb && (
          <p className="mt-1 text-xs" style={{ color: theme.muted }}>
            Best before {formatDate(bb)}
            {restDates && <> · Peak {restDates}</>}
          </p>
        )}

        {brews.length > 0 && brew && (
          <>
            <div className="mt-8 flex flex-wrap gap-2">
              {brews.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => setActive(i)}
                  className="rounded-full px-4 py-2 text-sm font-semibold transition"
                  style={{
                    background: i === active ? theme.accent : "transparent",
                    color: i === active ? theme.paper : theme.muted,
                    border: `1px solid ${i === active ? theme.accent : theme.rule}`,
                  }}
                >
                  {b.name || `Method ${i + 1}`}
                </button>
              ))}
            </div>

            <div
              className="mt-4 rounded-2xl p-5"
              style={{ border: `1px solid ${theme.rule}`, background: "rgb(255 255 255 / 0.6)" }}
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className="text-[0.65rem] font-bold uppercase tracking-[0.12em]"
                  style={{ color: theme.muted }}
                >
                  Batch
                </span>
                {[0.5, 1, 1.5, 2, 3].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFactor(f)}
                    aria-pressed={factor === f}
                    className="rounded-full px-3 py-1 text-xs font-bold transition"
                    style={{
                      background: factor === f ? theme.accent : "transparent",
                      border: `1px solid ${factor === f ? theme.accent : theme.rule}`,
                      color: factor === f ? theme.paper : theme.muted,
                    }}
                  >
                    {f}×
                  </button>
                ))}
                {factor !== 1 && (
                  <span className="text-xs" style={{ color: theme.muted }}>
                    dose, yield and every pour scaled — the saved recipe is unchanged
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat theme={theme} label="Water" value={brew.waterTempC ? `${brew.waterTempC}°C` : "—"} />
                <Stat
                  theme={theme}
                  label="Dose → Yield"
                  value={formatDoseYield(brew.doseG, brew.yieldG) || "—"}
                />
                <Stat theme={theme} label="Ratio" value={ratioOf(brew) || "—"} />
                <Stat theme={theme} label="Time" value={formatTime(brew.totalTime) || "—"} />
              </div>
              {(() => {
                const g = grinderOf(brew);
                const dial = dialLabel(brew);
                if (!g.name && !dial) return null;
                return (
                  <p className="mt-4 text-sm" style={{ color: theme.muted }}>
                    Grind{" "}
                    {g.name && <b style={{ color: theme.ink }}>{g.name}</b>}
                    {g.name && dial && " · "}
                    {dial && <b style={{ color: theme.ink }}>{dial}</b>}
                  </p>
                );
              })()}

              {brew.steps.some((s) => s.text.trim()) && (
                <button
                  onClick={() => setTiming(brew)}
                  className="mt-5 w-full rounded-xl px-4 py-3 text-base font-bold"
                  style={{ background: theme.accent, color: theme.paper }}
                >
                  ▶ Start brew timer
                </button>
              )}

              {brew.steps.some((s) => s.text.trim()) && (
                <ol className="mt-5 flex flex-col gap-3">
                  {brew.steps
                    .filter((s) => s.text.trim())
                    .map((step, i) => (
                      <li key={step.id} className="flex gap-3">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{ background: theme.accent, color: theme.paper }}
                        >
                          {i + 1}
                        </span>
                        <span className="flex-1 pt-0.5 text-[0.95rem] leading-snug">
                          {step.text}
                        </span>
                        {step.waterG && (
                          <span
                            className="pt-1 font-mono text-xs whitespace-nowrap"
                            style={{ color: theme.ink }}
                          >
                            {formatWeight(step.waterG)}
                          </span>
                        )}
                        {stepTimeLabel(step) && (
                          <span
                            className="pt-1 font-mono text-xs whitespace-nowrap"
                            style={{ color: theme.muted }}
                          >
                            {stepTimeLabel(step)}
                          </span>
                        )}
                      </li>
                    ))}
                </ol>
              )}
            </div>
          </>
        )}

        {rawBrew && <BrewLog labelId={label.id} brew={rawBrew} theme={theme} />}

        <div className="mt-10 flex gap-2 text-sm">
          <Link href={`/editor/${label.id}`} className="btn">
            Edit
          </Link>
          <Link href={`/print/${label.id}`} className="btn">
            Print
          </Link>
          <Link href="/" className="btn btn-ghost">
            Library
          </Link>
        </div>
      </div>

      {timing && (
        <BrewTimer brew={timing} theme={theme} onClose={() => setTiming(null)} />
      )}
    </div>
  );
}

function Stat({
  theme,
  label,
  value,
}: {
  theme: (typeof THEMES)[keyof typeof THEMES];
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        className="text-[0.625rem] font-bold uppercase tracking-[0.1em]"
        style={{ color: theme.muted }}
      >
        {label}
      </div>
      <div className="mt-0.5 font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}
