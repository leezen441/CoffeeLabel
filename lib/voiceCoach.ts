"use client";

import { useSyncExternalStore } from "react";
import type { Lang } from "./i18n";

let queued: ReturnType<typeof setTimeout> | null = null;
let fallback: ReturnType<typeof setTimeout> | null = null;
/** Bumped on cancel so a skipped utterance cannot fire its onEnd. */
let speakGen = 0;

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

function pickVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  const s = synth();
  if (!s) return undefined;
  const prefix = lang === "th" ? "th" : "en";
  const voices = s.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(prefix === "th" ? "th" : "en-gb")) ??
    voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(prefix))
  );
}

/** Warm the speech engine from a tap so later cues are allowed to speak. */
export function unlockSpeech(): void {
  const s = synth();
  if (!s) return;
  s.getVoices();
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  u.rate = 1;
  s.speak(u);
}

export function cancelSpeech(): void {
  speakGen += 1;
  if (queued) {
    clearTimeout(queued);
    queued = null;
  }
  if (fallback) {
    clearTimeout(fallback);
    fallback = null;
  }
  synth()?.cancel();
}

/**
 * Speaks a brew cue. Cancels anything still talking so overlapping steps
 * don't pile up. `delayMs` lets the beep finish first.
 * `onEnd` runs when the utterance finishes, errors, or hits a time fallback —
 * not when it was cancelled to make room for another cue.
 */
export function speakCoach(
  text: string,
  lang: Lang,
  delayMs = 0,
  onEnd?: () => void,
): void {
  const line = text.trim();
  if (!line) {
    onEnd?.();
    return;
  }
  cancelSpeech();
  const gen = speakGen;
  let settled = false;
  const finish = () => {
    if (gen !== speakGen || settled) return;
    settled = true;
    if (fallback) {
      clearTimeout(fallback);
      fallback = null;
    }
    onEnd?.();
  };
  const run = () => {
    queued = null;
    if (gen !== speakGen) return;
    const s = synth();
    if (!s) {
      finish();
      return;
    }
    const u = new SpeechSynthesisUtterance(line);
    u.lang = lang === "th" ? "th-TH" : "en-GB";
    u.rate = 0.95;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.onend = finish;
    u.onerror = finish;
    const wait = Math.min(14_000, Math.max(3_000, line.length * (lang === "th" ? 220 : 100)));
    fallback = setTimeout(finish, wait);
    s.speak(u);
  };
  if (delayMs > 0) queued = setTimeout(run, delayMs);
  else run();
}

/* ------------------------- the on/off preference ------------------------- */

/**
 * Whether the coach speaks, remembered across brews. It is a store for the same
 * reason the language is: reading localStorage during render would not match
 * the server's HTML, and reading it in an effect means setting state in an
 * effect, which cascades a second render every time the timer opens.
 */

const VOICE_KEY = "bean-label/voice-coach";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): boolean {
  return window.localStorage.getItem(VOICE_KEY) !== "off";
}

/** On by default, which is also what the server renders. */
function getServerSnapshot(): boolean {
  return true;
}

export function useVoiceOn(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setVoiceOn(on: boolean): void {
  try {
    window.localStorage.setItem(VOICE_KEY, on ? "on" : "off");
  } catch {
    // Private mode — the choice still holds for this session.
  }
  listeners.forEach((cb) => cb());
}
