"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Sticker from "./Sticker";
import { type CoffeeLabel, SIZES, labelTitle } from "@/lib/types";

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

  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const moved = useRef(false);
  /** mirrors `drag.current` for rendering — the transition is disabled mid-drag */
  const [dragging, setDragging] = useState(false);

  const size = SIZES[label.size] ?? SIZES["100x70"];

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
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, nudge, reset]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    nudge(e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    moved.current = false;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
    setPan({ x: d.px + dx, y: d.py + dy });
  };

  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
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
        Scroll to zoom · drag to move · double-click to toggle · Esc to close
      </p>
    </div>
  );
}
