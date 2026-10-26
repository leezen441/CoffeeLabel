"use client";

import Link from "next/link";
import PeakStatus from "./PeakStatus";
import { makeT, useLang } from "@/lib/i18n";
import {
  type BrewMethod,
  type CoffeeLabel,
  formatDoseYield,
  formatTime,
  labelTitle,
  ratioOf,
  restStatus,
} from "@/lib/types";

/** A method can only be counted down if it has steps to count. */
function timeable(label: CoffeeLabel): BrewMethod[] {
  return label.brews.filter((b) => b.steps.some((s) => s.text.trim()));
}

/**
 * Everything brewable, on one page: a bag, its methods, and a button that
 * starts the countdown. Bags in their peak window come first, because that is
 * the question this page answers — what should I be drinking today.
 */
export default function BrewNow({ labels }: { labels: CoffeeLabel[] }) {
  const tr = makeT(useLang());
  const withRecipes = labels.filter((l) => timeable(l).length > 0);
  const ready = withRecipes.filter((l) => restStatus(l).status === "peak");
  const rest = withRecipes.filter((l) => restStatus(l).status !== "peak");

  if (withRecipes.length === 0) {
    return <p className="py-10 text-sm text-muted">{tr("brewNowEmpty")}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {ready.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="section-title">{tr("drinkingNow")}</h2>
          {ready.map((l) => (
            <BagCard key={l.id} label={l} />
          ))}
        </section>
      )}
      {rest.length > 0 && (
        <section className="flex flex-col gap-3">
          {/* Kept rather than hidden: a bag outside its window is still the one
              you own, and the status on each card says where it stands. */}
          <h2 className="section-title">
            {ready.length > 0 ? tr("outsidePeak") : tr("nothingInPeak")}
          </h2>
          {rest.map((l) => (
            <BagCard key={l.id} label={l} />
          ))}
        </section>
      )}
    </div>
  );
}

function BagCard({ label }: { label: CoffeeLabel }) {
  const tr = makeT(useLang());
  return (
    <article className="panel p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-serif text-lg font-semibold">{labelTitle(label)}</h3>
        <PeakStatus label={label} className="text-xs" />
      </div>
      {label.roaster.trim() && (
        <p className="text-xs text-muted">{label.roaster.trim()}</p>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {timeable(label).map((b, i) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line p-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {b.name.trim() || `${tr("methodWord")} ${i + 1}`}
              </p>
              {/* Wraps rather than truncates: the ratio and the time are the
                  point of the line, and they are at the end of it. */}
              <p className="font-mono text-xs leading-snug text-muted">
                {[
                  b.waterTempC.trim() && `${b.waterTempC.trim()}°C`,
                  formatDoseYield(b.doseG, b.yieldG),
                  ratioOf(b),
                  formatTime(b.totalTime),
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
            </div>
            <Link
              href={`/b/${label.id}?brew=${b.id}`}
              prefetch
              className="btn btn-ghost text-xs"
            >
              {tr("brewGuide")}
            </Link>
            <Link
              href={`/b/${label.id}?brew=${b.id}&timer=1`}
              prefetch
              className="btn btn-primary text-xs"
            >
              ▶ {tr("start")}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
