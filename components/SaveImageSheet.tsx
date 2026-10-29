"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deliverPng, stickerToPng } from "@/lib/saveImage";
import { useBackClosesSheet } from "./BackToHome";
import { makeT, useLang } from "@/lib/i18n";

/** How long a finger has to stay down before it counts as a press-and-hold. */
const HOLD_MS = 500;
/** How far it may drift in that time and still count, rather than a scroll. */
const SLOP_PX = 10;

/**
 * Press-and-hold on touch, right-click with a mouse. Spread the returned
 * handlers on the element. The element should also carry the `no-callout`
 * styles below, or iOS draws its own menu and Android selects the text.
 */
export function useLongPress(onHold: () => void) {
  const timer = useRef<number | null>(null);
  const start = useRef({ x: 0, y: 0 });
  /** what the last press was made with — a mouse holds with right-click */
  const kind = useRef("");

  const cancel = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      kind.current = e.pointerType;
      if (e.pointerType === "mouse") return; // a mouse uses right-click instead
      start.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        navigator.vibrate?.(15);
        onHold();
      }, HOLD_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (timer.current === null) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      if (dx * dx + dy * dy > SLOP_PX * SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    // Android fires this on a long press too; the timer has it covered, so all
    // that is left to do is keep the browser's own menu away.
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      if (kind.current !== "mouse") return;
      cancel();
      onHold();
    },
  };
}

/** Styles that stop the browser's own press-and-hold behaviour. */
export const noCallout: React.CSSProperties = {
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  userSelect: "none",
};

type Shot =
  | { state: "making" }
  | { state: "ready"; url: string; blob: Blob }
  | { state: "failed" };

/**
 * Turns a rendered sticker into a picture and offers to save it. The sheet
 * shows the picture itself too, so pressing and holding it gives the phone's
 * own "save image" as well.
 */
export default function SaveImageSheet({
  node,
  name,
  onClose,
}: {
  /** the sticker element, at its true size — not the scaled wrapper */
  node: HTMLElement;
  /** the coffee's name, for the file name */
  name: string;
  onClose: () => void;
}) {
  const tr = makeT(useLang());
  const [shot, setShot] = useState<Shot>({ state: "making" });
  const dismiss = useBackClosesSheet(onClose);

  useEffect(() => {
    let live = true;
    let url = "";
    // The same renderer as Save image in the viewer and on the print page.
    stickerToPng(node)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (live) setShot({ state: "ready", url, blob });
      })
      .catch(() => {
        if (live) setShot({ state: "failed" });
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [node]);

  const save = () => {
    if (shot.state !== "ready") return;
    deliverPng(shot.blob, name).catch((err) =>
      alert(`Could not save the image: ${String(err)}`),
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={tr("saveImage")}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-40 items-center justify-center rounded-lg bg-[#f4efe8] p-3">
          {shot.state === "making" && (
            <p className="text-sm text-muted">{tr("makingImage")}</p>
          )}
          {shot.state === "failed" && (
            <p className="text-sm text-muted">{tr("imageFailed")}</p>
          )}
          {shot.state === "ready" && (
            // eslint-disable-next-line @next/next/no-img-element -- a blob URL made on the spot
            <img src={shot.url} alt={name} className="max-h-[55vh] w-auto max-w-full shadow" />
          )}
        </div>
        {shot.state === "ready" && (
          <p className="mt-2 text-center text-xs text-muted">{tr("holdToSave")}</p>
        )}
        <div className="mt-3 flex gap-2">
          <button className="btn btn-ghost flex-1" onClick={dismiss}>
            {tr("close")}
          </button>
          <button
            className="btn btn-primary flex-1"
            onClick={save}
            disabled={shot.state !== "ready"}
          >
            {tr("saveImage")}
          </button>
        </div>
      </div>
    </div>
  );
}
