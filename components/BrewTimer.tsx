"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { makeT, useLang } from "@/lib/i18n";
import {
  type BrewMethod,
  THEMES,
  brewTimeline,
  formatWeight,
} from "@/lib/types";

/** Seconds of warning before a step begins. */
const PRE_ALERT = 3;

function mmss(total: number): string {
  const s = Math.max(0, Math.floor(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function BrewTimer({
  brew,
  theme,
  onClose,
}: {
  brew: BrewMethod;
  theme: (typeof THEMES)[keyof typeof THEMES];
  onClose: () => void;
}) {
  const tr = makeT(useLang());
  const { steps, total } = brewTimeline(brew);
  /** only steps with a real start time can be cued */
  const cues = steps
    .map((s, i) => ({ ...s, index: i }))
    .filter((s) => s.start !== null && s.start > 0);

  /**
   * "0:30–1:00", the same window the label prints — knowing when a step ends
   * matters as much as knowing when it starts. A step that never wrote its own
   * end borrows the next step's start, and the last one closes on the total.
   */
  function windowOf(index: number): string {
    const s = steps[index];
    if (!s) return "";
    const start =
      s.start ??
      steps
        .slice(0, index)
        .reverse()
        .find((p) => p.end !== null)?.end ??
      null;
    const end =
      s.end ??
      steps.slice(index + 1).find((n) => n.start !== null)?.start ??
      (index === steps.length - 1 && total > 0 ? total : null);
    if (start === null) return end === null ? "—" : mmss(end);
    return end === null ? mmss(start) : `${mmss(start)}–${mmss(end)}`;
  }

  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  // Wall-clock based so the count never drifts, unlike accumulating ticks.
  const startedAt = useRef(0);
  const offset = useRef(0);
  const fired = useRef<Set<string>>(new Set());
  const audio = useRef<AudioContext | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const beep = useCallback((freq: number, ms: number, gain = 0.25) => {
    const ctx = audio.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    // short fade out, otherwise the note clicks
    vol.gain.setValueAtTime(gain, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    osc.connect(vol).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
  }, []);

  const buzz = useCallback((pattern: number | number[]) => {
    // Not supported on iOS Safari at all — sound is the fallback there.
    navigator.vibrate?.(pattern);
  }, []);

  const cueStep = useCallback(() => {
    beep(880, 180);
    buzz(180);
  }, [beep, buzz]);

  const cuePre = useCallback(() => {
    beep(560, 90, 0.15);
    buzz(60);
  }, [beep, buzz]);

  const cueDone = useCallback(() => {
    [0, 220, 440].forEach((d) => setTimeout(() => beep(1046, 200), d));
    buzz([180, 90, 180, 90, 320]);
  }, [beep, buzz]);

  /** Ticks while running and fires any cue whose moment has passed. */
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const now = (Date.now() - startedAt.current) / 1000 + offset.current;
      setElapsed(now);

      for (const c of cues) {
        const at = c.start as number;
        if (now >= at - PRE_ALERT && !fired.current.has(`pre${c.id}`)) {
          fired.current.add(`pre${c.id}`);
          // Skip the warning if we are already past the step itself.
          if (now < at) cuePre();
        }
        if (now >= at && !fired.current.has(`cue${c.id}`)) {
          fired.current.add(`cue${c.id}`);
          cueStep();
        }
      }

      if (total > 0 && now >= total && !fired.current.has("done")) {
        fired.current.add("done");
        cueDone();
        setDone(true);
        setRunning(false);
      }
    }, 100);
    return () => clearInterval(id);
  }, [running, cues, total, cuePre, cueStep, cueDone]);

  /** Keep the screen awake while a brew is actually running. */
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    navigator.wakeLock
      ?.request("screen")
      .then((s) => {
        if (cancelled) void s.release();
        else wakeLock.current = s;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      void audio.current?.close().catch(() => {});
    };
  }, [onClose]);

  function start() {
    // The context must be created from a gesture or the browser mutes it.
    if (!audio.current) {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audio.current = new Ctx();
    }
    void audio.current.resume().catch(() => {});
    startedAt.current = Date.now();
    setRunning(true);
    setDone(false);
  }

  function pause() {
    offset.current = elapsed;
    setRunning(false);
  }

  function reset() {
    setRunning(false);
    setDone(false);
    setElapsed(0);
    offset.current = 0;
    fired.current.clear();
  }

  // Which step is happening now: the last one whose start has passed.
  const currentIndex = steps.reduce(
    (found, s, i) => (s.start !== null && elapsed >= s.start ? i : found),
    0,
  );
  const next = cues.find((c) => (c.start as number) > elapsed);
  const pct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: theme.paper, color: theme.ink }}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center gap-3 px-5 pt-5">
        <div className="mr-auto min-w-0">
          <p
            className="text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: theme.accent }}
          >
            {tr("timerTitle")}
          </p>
          <p className="truncate font-serif text-2xl font-semibold">
            {brew.name || "Method"}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close timer"
          className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
          style={{ border: `1px solid ${theme.rule}`, color: theme.muted }}
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-5">
        <p
          className="font-mono text-7xl font-bold tabular-nums sm:text-8xl"
          style={{ color: done ? theme.accent : theme.ink }}
        >
          {mmss(elapsed)}
        </p>
        <p className="mt-1 font-mono text-sm" style={{ color: theme.muted }}>
          {total > 0 ? `${tr("ofTotal")} ${mmss(total)}` : tr("noTotal")}
        </p>

        <div
          className="mt-5 h-2 w-full max-w-md overflow-hidden rounded-full"
          style={{ background: theme.rule }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{ width: `${pct}%`, background: theme.accent }}
          />
        </div>

        <div className="mt-6 w-full max-w-md text-center">
          {done ? (
            <p className="font-serif text-2xl font-semibold" style={{ color: theme.accent }}>
              {tr("brewComplete")}
            </p>
          ) : (
            <>
              <p className="font-serif text-xl font-semibold">
                {steps[currentIndex]?.text || tr("readyWord")}
              </p>
              {steps[currentIndex] && (
                <p className="mt-0.5 font-mono text-sm" style={{ color: theme.muted }}>
                  {[
                    windowOf(currentIndex),
                    steps[currentIndex].waterG
                      ? formatWeight(steps[currentIndex].waterG)
                      : "",
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </p>
              )}
              {next && (
                <p className="mt-2 font-mono text-sm" style={{ color: theme.muted }}>
                  {tr("nextIn")} {Math.max(0, Math.ceil((next.start as number) - elapsed))}s ·{" "}
                  {windowOf(next.index)} · {next.text}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="max-h-[34vh] overflow-y-auto px-5">
        <ol className="mx-auto flex max-w-md flex-col gap-1">
          {steps.map((s, i) => {
            const isNow = i === currentIndex && !done;
            const passed = s.start !== null && elapsed >= s.start;
            return (
              <li
                key={s.id}
                className="flex items-baseline gap-2 rounded-lg px-3 py-2 text-sm"
                style={{
                  background: isNow ? theme.accent : "transparent",
                  color: isNow ? theme.paper : passed ? theme.muted : theme.ink,
                  opacity: s.start === null ? 0.55 : 1,
                }}
              >
                <span className="font-mono font-bold">{i + 1}.</span>
                <span className="flex-1">{s.text}</span>
                {s.waterG && (
                  <span className="font-mono text-xs">{formatWeight(s.waterG)}</span>
                )}
                <span className="font-mono text-xs whitespace-nowrap">
                  {windowOf(i)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex items-center justify-center gap-3 px-5 py-5">
        {!running ? (
          <button
            onClick={start}
            className="rounded-full px-8 py-3 text-base font-bold"
            style={{ background: theme.accent, color: theme.paper }}
          >
            {elapsed > 0 && !done ? tr("resume") : tr("start")}
          </button>
        ) : (
          <button
            onClick={pause}
            className="rounded-full px-8 py-3 text-base font-bold"
            style={{ border: `2px solid ${theme.accent}`, color: theme.accent }}
          >
            {tr("pause")}
          </button>
        )}
        <button
          onClick={reset}
          className="rounded-full px-6 py-3 text-base font-semibold"
          style={{ border: `1px solid ${theme.rule}`, color: theme.muted }}
        >
          {tr("reset")}
        </button>
      </div>

      <p className="pb-4 text-center text-xs" style={{ color: theme.muted }}>
        {tr("timerFooter")}
      </p>
    </div>
  );
}
