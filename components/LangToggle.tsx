"use client";

import { setLang, useLang } from "@/lib/i18n";

/**
 * EN / TH switch. English stays the default.
 *
 * `dark` is for the app header; `tone` lets the themed pages (brew guide) hand
 * in their own paper/ink so the pill matches the label's colour scheme.
 */
export default function LangToggle({
  dark = false,
  tone,
}: {
  dark?: boolean;
  tone?: { accent: string; rule: string; muted: string; paper: string };
}) {
  const lang = useLang();
  const border = tone ? tone.rule : dark ? "rgb(255 255 255 / 0.25)" : "var(--line)";
  const onBg = tone ? tone.accent : dark ? "rgb(255 255 255 / 0.9)" : "var(--brand)";
  const onInk = tone ? tone.paper : dark ? "#241a12" : "#fff";
  const offInk = tone ? tone.muted : dark ? "rgb(255 255 255 / 0.7)" : "var(--muted)";

  return (
    <div
      className="inline-flex overflow-hidden rounded-full border text-xs font-bold"
      style={{ borderColor: border }}
    >
      {(["en", "th"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className="px-2.5 py-1 transition"
          style={{
            background: lang === l ? onBg : "transparent",
            color: lang === l ? onInk : offInk,
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
