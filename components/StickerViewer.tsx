"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Sticker from "./Sticker";
import { saveStickerImage } from "@/lib/saveImage";
import { type CoffeeLabel, labelSize, labelTitle } from "@/lib/types";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;

/** Read-only lightbox: view a sticker large, zoom and pan around it. */
export default function StickerViewer({
  label,
  qrUrl,
  onClose,
}: {
  label: CoffeeLabel;
  qrUrl?: string;
  onClose: () => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  /** scale that makes the sticker fit the viewport — 100% on the zoom readout */
  const [fit, setFit] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  /** every finger/pointer currently down, so two-finger pinch can be tracked */
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinch = useRef<{
    dist: number;
    fx: number;
    fy: number;
    zoom: number;
    px: number;
    py: number;
  } | null>(null);
  const moved = useRef(false);
  /** mirrors the gesture refs for rendering — the transition is off mid-gesture */
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  async function saveImage() {
    // Export the offscreen copy, not what's on screen: a saved image is an
    // artefact like a print, so it drops the live rest bar and "Nd rested".
    const node = exportRef.current?.firstElementChild as HTMLElement | null;
    if (!node) return;
    setSaving(true);
    try {
      await saveStickerImage(node, labelTitle(label));
    } catch (err) {
      alert(`Could not save the image: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  const size = labelSize(label);

  const measure = useCallback(() => {
    const area = areaRef.current;
    const inner = innerRef.current;
    if (!area || !inner) return;
    const sticker = inner.firstElementChild as HTMLElement | null;
    if (!sticker) return;
    const w = sticker.offsetWidth;
    const h = sticker.offsetHeight;
    if (!w || !h) return;
    const next = Math.min((area.clientWidth * 0.9) / w, (area.clientHeight * 0.9) / h);
    setFit(next > 0 ? next : 1);
  }, []);

  useIsoLayoutEffect(() => {
    measure();
    const area = areaRef.current;
    if (!area) return;
    const ro = new ResizeObserver(measure);
    ro.observe(area);
    return () => ro.disconnect();
  }, [measure, label.size]);

  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const nudge = useCallback((factor: number) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
  }, []);

  // Keyboard shortcuts, and stop the page behind from scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") nudge(1.25);
      else if (e.key === "-" || e.key === "_") nudge(0.8);
      else if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // iOS Safari fires its own non-standard gesture events and will zoom the
    // whole page on a two-finger pinch, fighting the viewer's own zoom.
    // Suppressed only while the viewer is open.
    const stopSafariPinch = (e: Event) => e.preventDefault();
    const gestures = ["gesturestart", "gesturechange", "gestureend"];
    gestures.forEach((g) =>
      document.addEventListener(g, stopSafariPinch, { passive: false }),
    );

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      gestures.forEach((g) => document.removeEventListener(g, stopSafariPinch));
    };
  }, [onClose, nudge, reset]);

  /** centre of the viewing area in client coordinates — the transform origin */
  const areaCentre = () => {
    const r = areaRef.current?.getBoundingClientRect();
    return r
      ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
      : { cx: 0, cy: 0 };
  };

  /**
   * Zoom so that the content under `f` stays under `f`.
   * Derived from  f = centre + pan + contentPoint * scale  solved for the new pan.
   */
  const applyZoom = (
    nextRaw: number,
    fx: number,
    fy: number,
    from: { zoom: number; px: number; py: number },
    fromX = fx,
    fromY = fy,
  ) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextRaw));
    const { cx, cy } = areaCentre();
    const k = next / from.zoom;
    setPan({
      x: fx - cx - (fromX - cx - from.px) * k,
      y: fy - cy - (fromY - cy - from.py) * k,
    });
    setZoom(next);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    applyZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY, {
      zoom,
      px: pan.x,
      py: pan.y,
    });
  };

  const twoFingers = () => {
    const [a, b] = [...pointers.current.values()];
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      fx: (a.x + b.x) / 2,
      fy: (a.y + b.y) / 2,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // pointer already released — capture is an optimisation, not a requirement
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);

    if (pointers.current.size === 1) {
      moved.current = false;
      drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    } else if (pointers.current.size === 2) {
      // A pinch is starting — stop single-finger panning and never treat it as a tap.
      drag.current = null;
      moved.current = true;
      const { dist, fx, fy } = twoFingers();
      pinch.current = { dist, fx, fy, zoom, px: pan.x, py: pan.y };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      const p = pinch.current;
      const { dist, fx, fy } = twoFingers();
      if (p.dist > 0) {
        // Uses the pinch-start pan/zoom, so the gesture stays stable, and the
        // moving midpoint pans at the same time.
        applyZoom(p.zoom * (dist / p.dist), fx, fy, p, p.fx, p.fy);
      }
      return;
    }

    const d = drag.current;
    if (!d || zoom <= 1) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
    setPan({ x: d.px + dx, y: d.py + dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      drag.current = null;
      setDragging(false);
    }
  };

  const pct = Math.round(zoom * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgb(36 26 18 / 0.82)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`${labelTitle(label)} preview`}
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-white">
        <div className="mr-auto min-w-0">
          <p className="truncate font-serif text-lg font-semibold">{labelTitle(label)}</p>
          <p className="text-xs opacity-70">
            {size.name} · {label.layout === "compact" ? "Compact" : "Full"} layout
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
          <button
            className="h-8 w-8 rounded text-lg leading-none hover:bg-white/15"
            onClick={() => nudge(0.8)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="w-14 text-center font-mono text-xs tabular-nums">{pct}%</span>
          <button
            className="h-8 w-8 rounded text-lg leading-none hover:bg-white/15"
            onClick={() => nudge(1.25)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            className="h-8 rounded px-2 text-xs font-semibold hover:bg-white/15"
            onClick={reset}
          >
            Fit
          </button>
        </div>

        <button
          onClick={saveImage}
          disabled={saving}
          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 disabled:opacity-50"
        >
          {saving ? "Rendering…" : "Save image"}
        </button>
        <Link
          href={`/editor/${label.id}`}
          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
        >
          Edit
        </Link>
        <Link
          href={`/print/${label.id}`}
          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20"
        >
          Print
        </Link>
        <button
          className="h-9 w-9 rounded-lg bg-white/10 text-lg leading-none hover:bg-white/20"
          onClick={onClose}
          aria-label="Close preview"
        >
          ✕
        </button>
      </div>

      <div
        ref={areaRef}
        className="flex flex-1 items-center justify-center overflow-hidden"
        style={{
          cursor: dragging ? "grabbing" : zoom > 1 ? "grab" : "default",
          touchAction: "none",
        }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (!moved.current) onClose();
        }}
      >
        <div
          ref={innerRef}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={() => (zoom > 1 ? reset() : setZoom(2))}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${fit * zoom})`,
            transformOrigin: "center center",
            transition: dragging ? "none" : "transform 0.12s ease-out",
          }}
        >
          <Sticker
            label={label}
            qrUrl={qrUrl}
            preview
            style={{ boxShadow: "0 24px 60px rgb(0 0 0 / 0.45)" }}
          />
        </div>
      </div>

      <p className="px-4 pb-3 text-center text-xs text-white/50">
        Pinch or scroll to zoom · drag to move · double-tap to toggle · Esc to close
      </p>

      {/* Offscreen, unscaled and non-live — this is what "Save image" renders. */}
      <div
        ref={exportRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-[-10000px] top-0"
      >
        <Sticker label={label} qrUrl={qrUrl} live={false} />
      </div>
    </div>
  );
}
