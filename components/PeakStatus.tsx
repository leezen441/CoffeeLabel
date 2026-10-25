"use client";

import { makeT, useLang } from "@/lib/i18n";
import { type CoffeeLabel, REST_STATUS_META, restStatus } from "@/lib/types";

/**
 * Where the bag stands against its peak window, in words: "Peak in 5 days",
 * "In peak · 2 days left" or "Past peak". Nothing without a roast date.
 */
export default function PeakStatus({
  label,
  className = "",
}: {
  label: CoffeeLabel;
  className?: string;
}) {
  const tr = makeT(useLang());
  const rest = restStatus(label);
  if (rest.status === "unknown") return null;

  const unit = (n: number) => (n === 1 ? tr("dayOne") : tr("dayMany"));
  const words = (...parts: (string | number)[]) => parts.filter((p) => p !== "").join(" ");

  let text: string;
  if (rest.status === "resting") {
    text = words(tr("peakInPre"), rest.daysToPeak, unit(rest.daysToPeak), tr("peakInPost"));
  } else if (rest.status === "peak") {
    // The window is inclusive, so its last day still counts.
    const left = rest.to - (rest.age ?? rest.to) + 1;
    text = `${tr("inPeak")} · ${words(tr("daysLeftPre"), left, unit(left), tr("daysLeftPost"))}`;
  } else {
    text = tr("pastPeak");
  }

  const color = REST_STATUS_META[rest.status].color;
  return (
    <p className={`flex items-center gap-1.5 font-semibold ${className}`} style={{ color }}>
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />
      {text}
    </p>
  );
}
