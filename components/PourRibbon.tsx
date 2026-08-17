"use client";

import {
  type BrewMethod,
  type TimelineStep,
  THEMES,
  ribbonBlocks,
  stepSpan,
} from "@/lib/types";

export default function PourRibbon({
  brew,
  steps,
  total,
  elapsed,
  theme,
  label,
}: {
  brew: BrewMethod;
  steps: TimelineStep[];
  total: number;
  elapsed: number;
  theme: (typeof THEMES)[keyof typeof THEMES];
  label: string;
}) {
  const blocks = ribbonBlocks(brew);
  if (blocks.length === 0) return null;

  const byId = new Map(steps.map((s, i) => [s.id, i]));
  const live = blocks.map((b) => {
    const index = byId.get(b.id);
    const span =
      index === undefined ? { start: null, end: null } : stepSpan(steps, total, index);
    return { ...b, ...span };
  });

  const recipeTotal = live[live.length - 1]?.totalG ?? 0;
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
              title={`${b.text} · ${b.totalG} g`}
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
                {b.totalG}
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
  return n >= 100 ? String(Math.round(n)) : n.toFixed(0);
}
