"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Sticker from "./Sticker";
import type { CoffeeLabel } from "@/lib/types";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Renders a sticker at its true physical size, then scales the whole thing down
 * to fit the available width. Screen-only — the print pages use <Sticker> raw so
 * the millimetre dimensions reach the printer untouched.
 */
export default function StickerScaler({
  label,
  qrUrl,
  preview,
  maxScale = 1,
  shadow = true,
}: {
  label: CoffeeLabel;
  qrUrl?: string;
  preview?: boolean;
  maxScale?: number;
  shadow?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, h: 0 });

  useIsoLayoutEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;

    const fit = () => {
      const sticker = inner.firstElementChild as HTMLElement | null;
      if (!sticker) return;
      const w = sticker.offsetWidth;
      const h = sticker.offsetHeight;
      const avail = wrap.clientWidth;
      if (!w || !avail) return;
      const scale = Math.min(maxScale, avail / w);
      setBox((prev) =>
        Math.abs(prev.scale - scale) < 0.001 && prev.h === h * scale
          ? prev
          : { scale, h: h * scale },
      );
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
    // customW/H matter too: the sticker resizes without the wrapper changing
  }, [label.size, label.customW, label.customH, maxScale]);

  return (
    <div ref={wrapRef} style={{ width: "100%", height: box.h || undefined }}>
      <div
        ref={innerRef}
        style={{
          transform: `scale(${box.scale})`,
          transformOrigin: "top left",
          width: "max-content",
        }}
      >
        <Sticker
          label={label}
          preview={preview}
          qrUrl={qrUrl}
          style={
            shadow
              ? {
                  boxShadow: "0 10px 30px rgb(36 26 18 / 0.16)",
                  borderRadius: "2px",
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
