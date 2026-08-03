"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Sticker from "./Sticker";
import * as store from "@/lib/store";
import { useOrigin } from "@/lib/useOrigin";
import { type CoffeeLabel, labelSize, labelTitle } from "@/lib/types";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type SheetId = "a4" | "letter" | "exact";

const SHEETS: Record<SheetId, { name: string; w: number; h: number; margin: number }> = {
  a4: { name: "A4 sheet (210 × 297 mm)", w: 210, h: 297, margin: 8 },
  letter: { name: "US Letter (216 × 279 mm)", w: 216, h: 279, margin: 8 },
  exact: { name: "Label printer — one per page", w: 0, h: 0, margin: 0 },
};

export default function PrintView({ id }: { id: string }) {
  const [label, setLabel] = useState<CoffeeLabel | null>(null);
  const [missing, setMissing] = useState(false);
  const [sheet, setSheet] = useState<SheetId>("a4");
  const [copies, setCopies] = useState(4);
  const [gap, setGap] = useState(4);
  const [guides, setGuides] = useState(true);
  const [variant, setVariant] = useState<"full" | "brew">("full");
  const origin = useOrigin();

  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState({ scale: 1, h: 0 });

  useEffect(() => {
    void store.getLabel(id).then((l) => (l ? setLabel(l) : setMissing(true)));
  }, [id]);

  const size = label ? labelSize(label) : null;

  const grid = useMemo(() => {
    if (!size) return null;
    if (sheet === "exact") {
      return { cols: 1, rows: 1, perPage: 1, pages: copies };
    }
    const s = SHEETS[sheet];
    const usableW = s.w - s.margin * 2;
    const usableH = s.h - s.margin * 2;
    const cols = Math.max(1, Math.floor((usableW + gap) / (size.w + gap)));
    const rows = Math.max(1, Math.floor((usableH + gap) / (size.h + gap)));
    const perPage = cols * rows;
    return { cols, rows, perPage, pages: Math.max(1, Math.ceil(copies / perPage)) };
  }, [sheet, size, gap, copies]);

  useIsoLayoutEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    const fit = () => {
      const first = inner.firstElementChild as HTMLElement | null;
      if (!first) return;
      const w = first.offsetWidth;
      const avail = wrap.clientWidth;
      if (!w || !avail) return;
      const scale = Math.min(1, avail / w);
      setScreen({ scale, h: inner.scrollHeight * scale });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [sheet, copies, gap, label?.size, guides, variant]);

  if (missing) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="font-serif text-2xl font-semibold">Label not found</h1>
        <Link href="/" className="btn btn-primary mt-5">
          Back to library
        </Link>
      </div>
    );
  }

  if (!label || !size || !grid) {
    return <p className="px-5 py-10 text-sm text-muted">Loading…</p>;
  }

  const pageStyle =
    sheet === "exact"
      ? `@page { size: ${size.w}mm ${size.h}mm; margin: 0; }`
      : `@page { size: ${SHEETS[sheet].w}mm ${SHEETS[sheet].h}mm; margin: 0; }`;

  const brewUrl = origin ? `${origin}/b/${label.id}` : "";

  const stickerAt = (n: number) => (
    <Sticker
      key={n}
      label={label}
      qrUrl={brewUrl}
      variant={variant}
      className={guides ? "cut-guide" : ""}
      style={guides ? { outline: "0.1mm dashed #c9c9c9" } : undefined}
    />
  );

  const pages = Array.from({ length: grid.pages }, (_, p) => {
    const start = p * grid.perPage;
    const count = Math.min(grid.perPage, copies - start);
    if (sheet === "exact") {
      return (
        <div
          key={p}
          className="print-page"
          style={{ width: `${size.w}mm`, height: `${size.h}mm`, background: "#fff" }}
        >
          {stickerAt(start)}
        </div>
      );
    }
    const s = SHEETS[sheet];
    return (
      <div
        key={p}
        className="print-page"
        style={{
          width: `${s.w}mm`,
          height: `${s.h}mm`,
          padding: `${s.margin}mm`,
          background: "#fff",
          boxSizing: "border-box",
          display: "grid",
          gridTemplateColumns: `repeat(${grid.cols}, ${size.w}mm)`,
          gridAutoRows: `${size.h}mm`,
          gap: `${gap}mm`,
          alignContent: "start",
          justifyContent: "start",
        }}
      >
        {Array.from({ length: Math.max(0, count) }, (_, i) => stickerAt(start + i))}
      </div>
    );
  });

  return (
    <div className="flex-1">
      <style dangerouslySetInnerHTML={{ __html: pageStyle }} />

      <header className="no-print sticky top-0 z-20 border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-5 py-3">
          <Link href={`/editor/${label.id}`} className="btn btn-ghost">
            ← Editor
          </Link>
          <h1 className="mr-auto truncate font-serif text-lg font-semibold">
            Print · {labelTitle(label)}
          </h1>
          <button className="btn btn-primary" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </header>

      <div className="no-print mx-auto max-w-6xl px-5 pt-5">
        <div className="panel grid gap-3 p-4 sm:grid-cols-5">
          <label className="field">
            <span>Content</span>
            <select
              className="select"
              value={variant}
              onChange={(e) => setVariant(e.target.value as "full" | "brew")}
            >
              <option value="full">Full label</option>
              <option value="brew">Brew guide only</option>
            </select>
          </label>
          <label className="field">
            <span>Paper</span>
            <select
              className="select"
              value={sheet}
              onChange={(e) => setSheet(e.target.value as SheetId)}
            >
              {(Object.keys(SHEETS) as SheetId[]).map((k) => (
                <option key={k} value={k}>
                  {SHEETS[k].name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Copies</span>
            <input
              type="number"
              min={1}
              max={100}
              className="input"
              value={copies}
              onChange={(e) =>
                setCopies(Math.min(100, Math.max(1, Number(e.target.value) || 1)))
              }
            />
          </label>
          <label className="field">
            <span>Gap (mm)</span>
            <input
              type="number"
              min={0}
              max={20}
              className="input"
              disabled={sheet === "exact"}
              value={gap}
              onChange={(e) => setGap(Math.min(20, Math.max(0, Number(e.target.value) || 0)))}
            />
          </label>
          <label className="field">
            <span>Cut guides</span>
            <span className="flex h-[38px] items-center gap-2">
              <input
                type="checkbox"
                checked={guides}
                onChange={(e) => setGuides(e.target.checked)}
              />
              <span className="text-sm font-normal normal-case tracking-normal text-ink">
                Show dashed outline
              </span>
            </span>
          </label>
        </div>

        <p className="mt-3 text-xs text-muted">
          Sticker {size.name} · {grid.cols} × {grid.rows} per page ·{" "}
          {grid.pages} page{grid.pages === 1 ? "" : "s"}.
        </p>
        <div className="mt-2 rounded-lg border border-line bg-brand-soft/50 px-3 py-2 text-xs text-muted">
          <b className="text-ink">In the browser print dialog → More settings:</b>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>
              Untick <b className="text-ink">Headers and footers</b> — otherwise the browser
              prints the date and page URL in the corners
            </li>
            <li>
              <b className="text-ink">Margins: None</b>
            </li>
            <li>
              <b className="text-ink">Scale: 100%</b> — not &ldquo;Fit to page&rdquo;, which
              breaks the millimetre sizing
            </li>
            <li>
              Enable <b className="text-ink">Background graphics</b> so the colours print
            </li>
          </ul>
        </div>
      </div>

      <div className="print-root mx-auto max-w-6xl px-5 py-5">
        <div ref={wrapRef} className="screen-scale" style={{ height: screen.h || undefined }}>
          <div
            ref={innerRef}
            className="print-reset"
            style={{
              transform: `scale(${screen.scale})`,
              transformOrigin: "top left",
              width: "max-content",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {pages}
          </div>
        </div>
      </div>
    </div>
  );
}
