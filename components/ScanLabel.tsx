"use client";

import { useRef, useState } from "react";
import { makeT, useLang } from "@/lib/i18n";
import { type ScanError, labelFromScan, scanLabelImage, shrinkImage } from "@/lib/scan";
import { correctionHints } from "@/lib/scanMemory";
import type { ScanResult } from "@/lib/scanRules";
import { type CoffeeLabel, ROAST_LEVELS, formatWeight, processText } from "@/lib/types";

type Stage =
  | { at: "idle" }
  | { at: "working" }
  | { at: "failed"; error: ScanError }
  | { at: "review"; scan: ScanResult; label: CoffeeLabel; photo: string };

/**
 * Photograph a bag, get a label. The reading is never saved straight away —
 * it is shown first, because a misread roast date is worse than no roast date.
 */
export default function ScanLabel({
  onUse,
  busy,
}: {
  /** The scan the person accepted, plus what was read, for the corrections log. */
  onUse: (label: CoffeeLabel, scan: ScanResult) => void;
  busy?: boolean;
}) {
  const tr = makeT(useLang());
  const [stage, setStage] = useState<Stage>({ at: "idle" });
  const file = useRef<HTMLInputElement>(null);

  async function read(chosen: File) {
    setStage({ at: "working" });
    try {
      const photo = await shrinkImage(chosen);
      const res = await scanLabelImage(photo, correctionHints());
      if (!res.ok) {
        setStage({ at: "failed", error: res.error });
        return;
      }
      setStage({ at: "review", scan: res.result, label: labelFromScan(res.result), photo });
    } catch {
      setStage({ at: "failed", error: "bad-image" });
    }
  }

  const close = () => setStage({ at: "idle" });

  return (
    <>
      <input
        ref={file}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          // Cleared so picking the same photo twice still fires a change.
          e.target.value = "";
          if (chosen) void read(chosen);
        }}
      />
      <button
        className="btn"
        disabled={busy || stage.at === "working"}
        onClick={() => file.current?.click()}
      >
        {stage.at === "working" ? tr("scanWorking") : tr("scanLabel")}
      </button>

      {stage.at !== "idle" && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/40" onClick={close} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            className="panel fixed inset-x-4 top-[6vh] z-50 mx-auto max-h-[88vh] max-w-lg overflow-y-auto p-5"
          >
            {stage.at === "working" && (
              <>
                <h2 className="font-serif text-xl font-semibold">{tr("scanWorking")}</h2>
                <p className="mt-2 text-sm text-muted">{tr("scanWorkingHint")}</p>
              </>
            )}

            {stage.at === "failed" && (
              <>
                <h2 className="font-serif text-xl font-semibold">{tr("scanFailed")}</h2>
                <p className="mt-2 text-sm text-muted">{errorText(stage.error, tr)}</p>
                <Tips tr={tr} />
                <div className="mt-5 flex gap-2">
                  <button className="btn btn-primary" onClick={() => file.current?.click()}>
                    {tr("scanAgain")}
                  </button>
                  <button className="btn btn-ghost" onClick={close}>
                    {tr("cancel")}
                  </button>
                </div>
              </>
            )}

            {stage.at === "review" && (
              <>
                <h2 className="font-serif text-xl font-semibold">{tr("scanReview")}</h2>
                <p className="mt-1 text-sm text-muted">{tr("scanReviewHint")}</p>

                <dl className="mt-4 flex flex-col gap-1.5 text-sm">
                  <Row name={tr("fRoaster")} value={stage.label.roaster} />
                  <Row name={tr("fCoffeeName")} value={stage.label.coffeeName} />
                  <Row name={tr("fOrigin")} value={stage.label.origin} />
                  <Row name={tr("fVariety")} value={stage.label.variety} />
                  <Row name={tr("fProcess")} value={processText(stage.label)} />
                  <Row name={tr("fAltitude")} value={stage.label.altitude} />
                  <Row
                    name={tr("fRoastLevel")}
                    value={ROAST_LEVELS[stage.label.roastLevel].name}
                  />
                  <Row name={tr("fRoastDate")} value={stage.label.roastDate} />
                  <Row name={tr("fNetWeight")} value={formatWeight(stage.label.netWeight)} />
                  <Row name={tr("secNotes")} value={stage.label.tastingNotes.join(", ")} />
                  <Row
                    name={tr("fRestWindow")}
                    value={
                      stage.label.restFrom || stage.label.restTo
                        ? `${stage.label.restFrom}–${stage.label.restTo} ${tr("dayMany")}`
                        : ""
                    }
                  />
                </dl>

                {stage.scan.unsure.length > 0 && (
                  <p className="mt-3 text-xs" style={{ color: "var(--danger)" }}>
                    {tr("scanUnsure")} {stage.scan.unsure.join(", ")}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => {
                      close();
                      onUse(stage.label, stage.scan);
                    }}
                  >
                    {tr("scanUse")}
                  </button>
                  <button className="btn" onClick={() => file.current?.click()}>
                    {tr("scanAgain")}
                  </button>
                  <button className="btn btn-ghost" onClick={close}>
                    {tr("cancel")}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

function Row({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-line pb-1.5 last:border-0">
      <dt className="w-32 shrink-0 text-xs font-bold uppercase tracking-[0.08em] text-muted">
        {name}
      </dt>
      <dd className={`min-w-0 flex-1 ${value ? "" : "text-muted"}`}>{value || "—"}</dd>
    </div>
  );
}

function Tips({ tr }: { tr: (k: Parameters<ReturnType<typeof makeT>>[0]) => string }) {
  return (
    <div className="mt-4 rounded-xl border border-line bg-paper/60 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
        {tr("scanTipsTitle")}
      </p>
      <ul className="mt-1.5 list-disc pl-5 text-xs text-muted">
        <li>{tr("scanTip1")}</li>
        <li>{tr("scanTip2")}</li>
        <li>{tr("scanTip3")}</li>
        <li>{tr("scanTip4")}</li>
      </ul>
    </div>
  );
}

function errorText(
  error: ScanError,
  tr: (k: Parameters<ReturnType<typeof makeT>>[0]) => string,
): string {
  switch (error) {
    case "no-key":
    case "bad-key":
      return tr("scanNoKey");
    case "too-large":
      return tr("scanTooLarge");
    case "rate-limited":
      return tr("scanRateLimited");
    case "offline":
      return tr("scanOffline");
    case "unreadable":
    case "refused":
      return tr("scanUnreadable");
    default:
      return tr("scanGeneric");
  }
}
