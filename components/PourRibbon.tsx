"use client";

import {
  type TimelineStep,
  type Palette,
  stepSpan,
} from "@/lib/types";

export type TimerRibbonBlock = {
  id: string;
  text: string;
  at: string;
  addedG: number;
  totalG: number;
  start: number | null;
  end: number | null;
  duration: number;
  share: number;
};

/** Blocks sized by how long each step lasts, not by how much water it adds. */
export function timerRibbonBlocks(
  steps: TimelineStep[],
  total: number,
): TimerRibbonBlock[] {
  const raw: TimerRibbonBlock[] = [];
  let prevWater = 0;

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const { start, end } = stepSpan(steps, total, i);
    const duration =
      start !== null && end !== null && end > start ? end - start : 0;
    if (duration <= 0) continue;

    const totalG = parseFloat(s.waterG);
    const hasWater = Number.isFinite(totalG) && totalG > 0;
    const addedG = hasWater ? Math.max(0, totalG - prevWater) : 0;
    if (hasWater) prevWater = totalG;

    raw.push({
      id: s.id,
      text: s.text,
      at: s.raw,
      addedG,
      totalG: hasWater ? totalG : 0,
      start,
      end,
      duration,
      share: 0,
    });
  }

  if (raw.length === 0) return [];

  const sum = raw.reduce((a, b) => a + b.duration, 0);
  if (!(sum > 0)) return [];

  return raw.map((b) => ({ ...b, share: b.duration / sum }));
}

export default function PourRibbon({
  steps,
  total,
  elapsed,
  theme,
  label,
}: {
  steps: TimelineStep[];
  total: number;
  elapsed: number;
  theme: Palette;
  label: string;
}) {
  const live = timerRibbonBlocks(steps, total);
  if (live.length === 0) return null;

  const recipeTotal = live.reduce((a, b) => Math.max(a, b.totalG), 0);
  let poured = 0;
  for (const b of live) poured += b.addedG * fillOf(b, elapsed);

  return (
    <div className="mt-5 w-full max-w-md">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span
          className="font-bold uppercase tracking-[0.12em]"
          style={{ color: theme.muted }}
        >
          {label}
        </span>
        {recipeTotal > 0 && (
          <span className="font-mono tabular-nums" style={{ color: theme.ink }}>
            {fmtG(poured)} / {fmtG(recipeTotal)} g
          </span>
        )}
      </div>
      <div className="flex h-12 w-full gap-0.5 overflow-hidden rounded-xl">
        {live.map((b, i) => {
          const fill = fillOf(b, elapsed);
          const shade = 0.4 + (i / Math.max(1, live.length - 1)) * 0.6;
          return (
            <div
              key={b.id}
              className="relative min-w-0 overflow-hidden"
              style={{
                width: `${b.share * 100}%`,
                background: theme.rule,
              }}
              title={`${b.text} · ${b.duration}s${b.totalG ? ` · ${b.totalG} g` : ""}`}
            >
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${fill * 100}%`,
                  background: theme.accent,
                  opacity: shade,
                  transition: "width 0.1s linear",
                }}
              />
              <span
                className="relative z-10 flex h-full items-center justify-end pr-1.5 font-mono text-[0.65rem] font-bold tabular-nums"
                style={{
                  color: fill > 0.35 ? theme.paper : theme.muted,
                }}
              >
                {b.totalG > 0 ? b.totalG : ""}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex w-full gap-0.5">
        {live.map((b) => (
          <span
            key={b.id}
            className="min-w-0 truncate text-right font-mono text-[0.65rem] leading-tight"
            style={{ width: `${b.share * 100}%`, color: theme.muted }}
          >
            {b.at}
          </span>
        ))}
      </div>
    </div>
  );
}

function fillOf(
  b: { start: number | null; end: number | null },
  elapsed: number,
): number {
  if (b.start === null) return elapsed > 0 ? 1 : 0;
  if (elapsed <= b.start) return 0;
  if (b.end === null || b.end <= b.start) return 1;
  if (elapsed >= b.end) return 1;
  return (elapsed - b.start) / (b.end - b.start);
}

function fmtG(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n));
}
