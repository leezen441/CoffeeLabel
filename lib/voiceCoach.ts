import type { Lang } from "./i18n";

let queued: ReturnType<typeof setTimeout> | null = null;

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
  if (queued) {
    clearTimeout(queued);
    queued = null;
  }
  synth()?.cancel();
}

/**
 * Speaks a brew cue. Cancels anything still talking so overlapping steps
 * don't pile up. `delayMs` lets the beep finish first.
 */
export function speakCoach(text: string, lang: Lang, delayMs = 0): void {
  const line = text.trim();
  if (!line) return;
  cancelSpeech();
  const run = () => {
    queued = null;
    const s = synth();
    if (!s) return;
    const u = new SpeechSynthesisUtterance(line);
    u.lang = lang === "th" ? "th-TH" : "en-GB";
    u.rate = 0.95;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    s.speak(u);
  };
  if (delayMs > 0) queued = setTimeout(run, delayMs);
  else run();
}
