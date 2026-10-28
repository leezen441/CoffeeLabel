"use client";

import { useRef, useState } from "react";
import { makeT, useLang } from "@/lib/i18n";
import {
  type ScanError,
  labelFromScan,
  scanLabelImage,
  rotateImage,
  shrinkImage,
  thumbnail,
} from "@/lib/scan";
import { correctionHints } from "@/lib/scanMemory";
import { readLabelLocally } from "@/lib/ocr";
import type { ScanResult } from "@/lib/scanRules";
import {
  type CoffeeLabel,
  type RoastLevel,
  MAX_PROCESSES,
  ROAST_LEVELS,
  clampMm,
} from "@/lib/types";

/** Which reader produced a result, so the screen can say what to expect. */
type Via = "claude" | "device";

type Stage =
  | { at: "idle" }
  | { at: "working"; via: Via; progress: number }
  | { at: "failed"; error: ScanError }
  | {
      at: "review";
      /** what was read, kept as it was so corrections can be measured */
      scan: ScanResult;
      /** what will be saved, which is the reading plus whatever you fix here */
      draft: CoffeeLabel;
      /** a small copy of the photo, for checking against; never stored */
      photo: string;
      via: Via;
    };

/**
 * Photograph a bag, get a label. The reading is never saved straight away —
 * it is shown first, next to the photo and open to correction, because a
 * misread roast date is worse than no roast date.
 */
export default function ScanLabel({
  onUse,
  busy,
}: {
  /** The label to save, and the raw reading, for the corrections log. */
  onUse: (label: CoffeeLabel, scan: ScanResult) => void;
  busy?: boolean;
}) {
  const tr = makeT(useLang());
  const [stage, setStage] = useState<Stage>({ at: "idle" });
  const file = useRef<HTMLInputElement>(null);

  /** Change one field of the draft, leaving the reading it came from alone. */
  const edit = (patch: Partial<CoffeeLabel>) =>
    setStage((s) => (s.at === "review" ? { ...s, draft: { ...s.draft, ...patch } } : s));

  /**
   * Claude reads the photo when the deployment has a key. Without one it is
   * read here on the phone instead — free, slower, and plainly worse, so the
   * review screen says which one did it.
   */
  async function read(chosen: File) {
    setStage({ at: "working", via: "claude", progress: 0 });
    try {
      const [photo, small] = await Promise.all([shrinkImage(chosen), thumbnail(chosen)]);
      const res = await scanLabelImage(photo, correctionHints());
      if (res.ok) {
        setStage({
          at: "review",
          scan: res.result,
          draft: labelFromScan(res.result),
          photo: small,
          via: "claude",
        });
        return;
      }
      if (res.error !== "no-key" && res.error !== "bad-key") {
        setStage({ at: "failed", error: res.error });
        return;
      }

      setStage({ at: "working", via: "device", progress: 0 });
      const local = await readLabelLocally(chosen, (progress) =>
        setStage({ at: "working", via: "device", progress }),
      );
      if (!local.ok) {
        setStage({ at: "failed", error: local.error });
        return;
      }
      setStage({
        at: "review",
        scan: local.result,
        draft: labelFromScan(local.result),
        // The reader already worked out which way up the bag was.
        photo: local.turn === 0 ? small : await rotateImage(small, local.turn),
        via: "device",
      });
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
            className="panel fixed inset-x-4 top-[5vh] z-50 mx-auto max-h-[90vh] max-w-lg overflow-y-auto p-5"
          >
            {stage.at === "working" && (
              <>
                <h2 className="font-serif text-xl font-semibold">{tr("scanWorking")}</h2>
                <p className="mt-2 text-sm text-muted">
                  {stage.via === "device" ? tr("scanOnDeviceHint") : tr("scanWorkingHint")}
                </p>
                {stage.via === "device" && (
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-brand transition-[width]"
                      style={{ width: `${Math.round(stage.progress * 100)}%` }}
                    />
                  </div>
                )}
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
                <p className="mt-1 text-sm text-muted">
                  {stage.via === "device" ? tr("scanOnDeviceRead") : tr("scanReviewHint")}
                </p>

                {/* The bag, to read the fields against. It is held here only
                    while this dialog is open; no photo is ever saved. */}
                <div className="relative mt-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={stage.photo}
                    alt={tr("scanPhotoAlt")}
                    className="max-h-44 w-full rounded-xl border border-line object-contain"
                  />
                  <button
                    type="button"
                    className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card text-muted shadow-sm hover:border-brand hover:text-brand"
                    title={tr("scanRotate")}
                    aria-label={tr("scanRotate")}
                    onClick={async () => {
                      const turned = await rotateImage(stage.photo, 90);
                      setStage((st) =>
                        st.at === "review" ? { ...st, photo: turned } : st,
                      );
                    }}
                  >
                    ⟳
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <Field label={tr("fRoaster")}>
                    <input
                      className="input"
                      value={stage.draft.roaster}
                      onChange={(e) => edit({ roaster: e.target.value })}
                    />
                  </Field>
                  <Field label={tr("fCoffeeName")}>
                    <input
                      className="input"
                      value={stage.draft.coffeeName}
                      onChange={(e) => edit({ coffeeName: e.target.value })}
                    />
                  </Field>
                  <Field label={tr("fOrigin")}>
                    <input
                      className="input"
                      value={stage.draft.origin}
                      onChange={(e) => edit({ origin: e.target.value })}
                    />
                  </Field>
                  <Field label={tr("fVariety")}>
                    <input
                      className="input"
                      value={stage.draft.variety}
                      onChange={(e) => edit({ variety: e.target.value })}
                    />
                  </Field>
                  <Field label={tr("fProcess")} hint={tr("scanCommaHint")}>
                    <input
                      className="input"
                      value={stage.draft.processes.join(", ")}
                      onChange={(e) =>
                        edit({
                          processes: splitCommas(e.target.value).slice(0, MAX_PROCESSES),
                        })
                      }
                    />
                  </Field>
                  <Field label={tr("fAltitude")}>
                    <input
                      className="input"
                      value={stage.draft.altitude}
                      onChange={(e) => edit({ altitude: e.target.value })}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label={tr("fRoastLevel")}>
                      <select
                        className="select"
                        value={stage.draft.roastLevel}
                        onChange={(e) =>
                          edit({ roastLevel: Number(e.target.value) as RoastLevel })
                        }
                      >
                        {([1, 2, 3, 4, 5] as RoastLevel[]).map((n) => (
                          <option key={n} value={n}>
                            {ROAST_LEVELS[n].name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={tr("fRoastDate")}>
                      <input
                        type="date"
                        className="input"
                        value={stage.draft.roastDate}
                        onChange={(e) => edit({ roastDate: e.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Field label={tr("fNetWeight")}>
                      <input
                        className="input"
                        inputMode="decimal"
                        value={stage.draft.netWeight}
                        onChange={(e) =>
                          edit({ netWeight: e.target.value.replace(/[^\d.]/g, "") })
                        }
                      />
                    </Field>
                    <Field label={tr("fRestFrom")}>
                      <input
                        className="input"
                        inputMode="numeric"
                        value={stage.draft.restFrom || ""}
                        onChange={(e) =>
                          edit({ restFrom: clampMm(Number(e.target.value), 0) || 0 })
                        }
                      />
                    </Field>
                    <Field label={tr("fRestTo")}>
                      <input
                        className="input"
                        inputMode="numeric"
                        value={stage.draft.restTo || ""}
                        onChange={(e) =>
                          edit({ restTo: clampMm(Number(e.target.value), 0) || 0 })
                        }
                      />
                    </Field>
                  </div>

                  <Field label={tr("secNotes")} hint={tr("scanCommaHint")}>
                    <input
                      className="input"
                      value={stage.draft.tastingNotes.join(", ")}
                      onChange={(e) => edit({ tastingNotes: splitCommas(e.target.value) })}
                    />
                  </Field>
                </div>

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
                      const { draft, scan } = stage;
                      close();
                      onUse(draft, scan);
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

function splitCommas(v: string): string[] {
  return v
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {hint && (
          <span className="ml-1 font-normal normal-case tracking-normal text-muted">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
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
