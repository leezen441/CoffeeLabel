"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeT, useLang, type Lang } from "@/lib/i18n";
import {
  cancelSpeech,
  setVoiceOn,
  speakCoach,
  unlockSpeech,
  useVoiceOn,
} from "@/lib/voiceCoach";
import PourRibbon, { timerRibbonBlocks } from "./PourRibbon";
import {
  type BrewMethod,
  type Palette,
  brewTimeline,
  formatWeight,
  stepSpan,
} from "@/lib/types";

/** Beep this many seconds before a step. */
const PRE_ALERT = 3;
/** Speak early enough that the sentence can finish before the pour. */
const SPEAK_ALERT = 8;
/** Hands-free start: one tap, then this many seconds before the clock runs. */
const COUNTDOWN_FROM = 3;

type AudioCtxCtor = typeof AudioContext;

let sharedAudio: AudioContext | null = null;

function audioCtor(): AudioCtxCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: AudioCtxCtor }).webkitAudioContext ??
    null
  );
}

/**
 * Call from a tap so the browser allows sound later. The countdown itself
 * starts from an effect, which is no longer a user gesture.
 */
export function unlockTimerAudio(): AudioContext | null {
  const Ctx = audioCtor();
  if (!Ctx) return null;
  if (!sharedAudio || sharedAudio.state === "closed") sharedAudio = new Ctx();
  void sharedAudio.resume().catch(() => {});
  unlockSpeech();
  return sharedAudio;
}

function coachLine(
  lang: Lang,
  step: { text: string; waterG: string },
  kind: "now" | "next" | "first",
): string {
  const text = step.text.trim();
  const g = parseFloat(step.waterG);
  const water =
    Number.isFinite(g) && g > 0
      ? lang === "th"
        ? ` ถึง ${g} กรัม`
        : `, to ${g} grams`
      : "";
  if (kind === "next") {
    return lang === "th" ? `ขั้นต่อไป ${text}${water}` : `Next. ${text}${water}`;
  }
  if (kind === "first") {
    return lang === "th" ? `ขั้นแรก ${text}${water}` : `First. ${text}${water}`;
  }
  return `${text}${water}`;
}

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
  theme: Palette;
  onClose: () => void;
}) {
  const lang = useLang();
  const tr = makeT(lang);
  const { steps, total } = useMemo(() => brewTimeline(brew), [brew]);
  const hasRibbon = timerRibbonBlocks(steps, total).length > 0;
  /** only steps with a real start time can be cued */
  const cues = useMemo(
    () => steps.map((s, i) => ({ ...s, index: i })).filter((s) => s.start !== null),
    [steps],
  );

  /**
   * "0:30–1:00", the same window the label prints — knowing when a step ends
   * matters as much as knowing when it starts. A step that never wrote its own
   * end borrows the next step's start, and the last one closes on the total.
   */
  function windowOf(index: number): string {
    const { start, end } = stepSpan(steps, total, index);
    if (start === null) return end === null ? "—" : mmss(end);
    return end === null ? mmss(start) : `${mmss(start)}–${mmss(end)}`;
  }

  const voice = useVoiceOn();
  /** The step the coach reads out before the countdown, when there is one. */
  const firstSpoken = useMemo(() => {
    const first = steps.find((s) => s.start === 0) ?? steps[0];
    return first?.text.trim() ? first : null;
  }, [steps]);
  const canBrief = voice && firstSpoken !== null;

  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  /** Speak the first step to completion before 3-2-1. */
  const [briefing, setBriefing] = useState(canBrief);
  /** 3 → 2 → 1 while waiting; null when briefing, idle, or the clock is running. */
  const [countdown, setCountdown] = useState<number | null>(
    canBrief ? null : COUNTDOWN_FROM,
  );

  // Wall-clock based so the count never drifts, unlike accumulating ticks.
  const startedAt = useRef(0);
  const offset = useRef(0);
  const fired = useRef<Set<string>>(new Set());
  const audio = useRef<AudioContext | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const beep = useCallback((freq: number, ms: number, gain = 0.7) => {
    const ctx = audio.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const click = ctx.createOscillator();
    const vol = ctx.createGain();
    const clickVol = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "triangle";
    click.frequency.value = freq * 2;
    click.type = "square";
    const t = ctx.currentTime;
    vol.gain.setValueAtTime(gain, t);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    clickVol.gain.setValueAtTime(gain * 0.22, t);
    clickVol.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(vol).connect(ctx.destination);
    click.connect(clickVol).connect(ctx.destination);
    osc.start(t);
    click.start(t);
    osc.stop(t + ms / 1000);
    click.stop(t + ms / 1000);
  }, []);

  const buzz = useCallback((pattern: number | number[]) => {
    // Not supported on iOS Safari at all — sound is the fallback there.
    navigator.vibrate?.(pattern);
  }, []);

  const cueStep = useCallback(() => {
    beep(880, 260, 0.8);
    buzz(180);
  }, [beep, buzz]);

  const cuePre = useCallback(() => {
    beep(560, 160, 0.55);
    buzz(60);
  }, [beep, buzz]);

  const cueDone = useCallback(() => {
    [0, 220, 440].forEach((d) => setTimeout(() => beep(1046, 240, 0.8), d));
    buzz([180, 90, 180, 90, 320]);
  }, [beep, buzz]);

  const say = useCallback(
    (text: string, delayMs = 0, onEnd?: () => void) => {
      if (!voice) {
        onEnd?.();
        return;
      }
      speakCoach(text, lang, delayMs, onEnd);
    },
    [lang, voice],
  );

  const beginCountdown = useCallback(() => {
    setBriefing(false);
    setCountdown(COUNTDOWN_FROM);
  }, []);

  /** Ticks while running and fires any cue whose moment has passed. */
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const now = (Date.now() - startedAt.current) / 1000 + offset.current;
      setElapsed(now);

      for (const c of cues) {
        const at = c.start as number;
        const beepable = at > 0;
        if (beepable && now >= at - SPEAK_ALERT && !fired.current.has(`speak${c.id}`)) {
          fired.current.add(`speak${c.id}`);
          if (now < at) say(coachLine(lang, c, "next"));
        }
        if (beepable && now >= at - PRE_ALERT && !fired.current.has(`pre${c.id}`)) {
          fired.current.add(`pre${c.id}`);
          if (now < at) cuePre();
        }
        if (now >= at && !fired.current.has(`cue${c.id}`)) {
          fired.current.add(`cue${c.id}`);
          if (beepable) cueStep();
          // Don't talk over the 8s warning — only speak here if we never got one.
          if (!fired.current.has(`speak${c.id}`)) {
            fired.current.add(`speak${c.id}`);
            say(coachLine(lang, c, "now"));
          }
        }
      }

      if (total > 0 && now >= total && !fired.current.has("done")) {
        fired.current.add("done");
        cueDone();
        say(lang === "th" ? "ชงเสร็จแล้ว" : "Brew complete", 400);
        setDone(true);
        setRunning(false);
      }
    }, 100);
    return () => clearInterval(id);
  }, [running, cues, total, cuePre, cueStep, cueDone, say, lang]);

  /** Keep the screen awake while counting down or brewing. */
  useEffect(() => {
    if (!running && countdown === null && !briefing) return;
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
  }, [running, countdown, briefing]);

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
      cancelSpeech();
      void audio.current?.close().catch(() => {});
    };
  }, [onClose]);

  const ensureAudio = useCallback(() => {
    const unlocked = unlockTimerAudio();
    audio.current = unlocked ?? audio.current;
    if (!audio.current) {
      const Ctx = audioCtor();
      if (Ctx) audio.current = new Ctx();
    }
    void audio.current?.resume().catch(() => {});
  }, []);

  /** Speak step 1 all the way through, then start 3-2-1. */
  useEffect(() => {
    if (!briefing || !firstSpoken) return;
    ensureAudio();
    fired.current.add(`speak${firstSpoken.id}`);
    speakCoach(coachLine(lang, firstSpoken, "first"), lang, 0, beginCountdown);
  }, [briefing, beginCountdown, ensureAudio, lang, firstSpoken]);

  const start = useCallback(() => {
    ensureAudio();
    cancelSpeech();
    setBriefing(false);
    startedAt.current = Date.now();
    setCountdown(null);
    setRunning(true);
    setDone(false);
  }, [ensureAudio]);

  function pause() {
    offset.current = elapsed;
    setRunning(false);
    cancelSpeech();
  }

  function reset() {
    setRunning(false);
    setDone(false);
    setElapsed(0);
    setBriefing(false);
    setCountdown(null);
    offset.current = 0;
    fired.current.clear();
    cancelSpeech();
  }

  function requestStart() {
    // Resume a paused brew immediately; a fresh start gets the 3-2-1 first.
    if (elapsed > 0 && !done) start();
    else if (canBrief) setBriefing(true);
    else setCountdown(COUNTDOWN_FROM);
  }

  /** Tick 3 → 2 → 1, then start the clock. Skip/reset clears this. */
  useEffect(() => {
    if (countdown === null) return;
    ensureAudio();
    if (countdown === 1) {
      beep(880, 260, 0.8);
      buzz(80);
    } else {
      beep(560, 160, 0.55);
      buzz(40);
    }
    const id = window.setTimeout(() => {
      if (countdown <= 1) start();
      else setCountdown(countdown - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [countdown, ensureAudio, beep, buzz, start]);

  // Which step is happening now: the last one whose start has passed.
  const currentIndex = steps.reduce(
    (found, s, i) => (s.start !== null && elapsed >= s.start ? i : found),
    0,
  );
  const next = cues.find((c) => (c.start as number) > elapsed);
  const pct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;
  const firstStep = steps.find((s) => s.start === 0) ?? steps[0];
  const waiting = briefing || countdown !== null;

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
          type="button"
          onClick={() => {
            const nextOn = !voice;
            setVoiceOn(nextOn);
            if (!nextOn) {
              cancelSpeech();
              if (briefing) beginCountdown();
            }
          }}
          aria-pressed={voice}
          aria-label={voice ? tr("voiceOn") : tr("voiceOff")}
          title={voice ? tr("voiceOn") : tr("voiceOff")}
          className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
          style={{
            border: `1px solid ${voice ? theme.accent : theme.rule}`,
            color: voice ? theme.accent : theme.muted,
          }}
        >
          {voice ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
        </button>
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
        {briefing ? (
          <p
            className="max-w-md text-center font-serif text-3xl leading-tight font-semibold sm:text-4xl"
            style={{ color: theme.accent }}
          >
            {firstStep?.text || tr("readyWord")}
          </p>
        ) : countdown !== null ? (
          <button
            type="button"
            onClick={start}
            aria-label={tr("startNow")}
            className="bg-transparent p-0 font-mono text-7xl font-bold tabular-nums sm:text-8xl"
            style={{ color: theme.accent }}
          >
            <span aria-live="assertive">{countdown}</span>
          </button>
        ) : (
          <p
            className="font-mono text-7xl font-bold tabular-nums sm:text-8xl"
            style={{ color: done ? theme.accent : theme.ink }}
          >
            {mmss(elapsed)}
          </p>
        )}
        <p className="mt-1 font-mono text-sm" style={{ color: theme.muted }}>
          {briefing
            ? firstStep?.waterG
              ? formatWeight(firstStep.waterG)
              : tr("briefingHint")
            : countdown !== null
              ? tr("startingIn")
              : total > 0
                ? `${tr("ofTotal")} ${mmss(total)}`
                : tr("noTotal")}
        </p>

        {hasRibbon ? (
          <PourRibbon
            steps={steps}
            total={total}
            elapsed={waiting ? 0 : elapsed}
            theme={theme}
            label={tr("pourRibbon")}
          />
        ) : (
          countdown === null &&
          !briefing && (
            <div
              className="mt-5 h-2 w-full max-w-md overflow-hidden rounded-full"
              style={{ background: theme.rule }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-100"
                style={{ width: `${pct}%`, background: theme.accent }}
              />
            </div>
          )
        )}

        <div className="mt-6 w-full max-w-md text-center">
          {briefing ? (
            <p className="text-sm" style={{ color: theme.muted }}>
              {tr("briefingHint")}
            </p>
          ) : countdown !== null ? (
            <p className="text-sm" style={{ color: theme.muted }}>
              {tr("countdownHint")}
            </p>
          ) : done ? (
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
            const isNow =
              (i === currentIndex && running && !done) || (briefing && i === 0);
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
        {waiting ? (
          <button
            onClick={start}
            className="rounded-full px-8 py-3 text-base font-bold"
            style={{ background: theme.accent, color: theme.paper }}
          >
            {tr("startNow")}
          </button>
        ) : !running ? (
          <button
            onClick={requestStart}
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

function SpeakerOnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9v6h3l5 4V5L7 9H4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16 8.5a5 5 0 0 1 0 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9v6h3l5 4V5L7 9H4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M19 9l-4 6M15 9l4 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
