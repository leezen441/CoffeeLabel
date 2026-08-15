"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Sticker from "./Sticker";
import LangToggle from "./LangToggle";
import { type MsgKey, makeT, sizeHint, sizeName, useLang } from "@/lib/i18n";
import * as store from "@/lib/store";
import { saveStickerImage } from "@/lib/saveImage";
import { useOrigin } from "@/lib/useOrigin";
import {
  type CoffeeLabel,
  type LayoutId,
  type SizeId,
  type ThemeId,
  MAX_MM,
  MIN_MM,
  SIZES,
  THEMES,
  clampMm,
  labelSize,
  labelTitle,
} from "@/lib/types";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type SheetId = "a4" | "letter" | "exact";

const SHEETS: Record<SheetId, { key: MsgKey; w: number; h: number; margin: number }> = {
  a4: { key: "sheetA4", w: 210, h: 297, margin: 8 },
  letter: { key: "sheetLetter", w: 216, h: 279, margin: 8 },
  exact: { key: "sheetExact", w: 0, h: 0, margin: 0 },
};

export default function PrintView({ id }: { id: string }) {
  const [label, setLabel] = useState<CoffeeLabel | null>(null);
  const [missing, setMissing] = useState(false);
  const [sheet, setSheet] = useState<SheetId>("a4");
  const [copies, setCopies] = useState(1);
  const [gap, setGap] = useState(4);
  const [guides, setGuides] = useState(true);
  const [variant, setVariant] = useState<"full" | "brew">("full");
  const origin = useOrigin();
  const lang = useLang();
  const tr = makeT(lang);

  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState({ scale: 1, h: 0 });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** an unscaled, guide-free copy of the sticker, rendered only for PNG export */
  const exportRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  async function saveImage() {
    const node = exportRef.current?.firstElementChild as HTMLElement | null;
    if (!node || !label) return;
    setSaving(true);
    try {
      const how = await saveStickerImage(node, labelTitle(label));
      if (how === "downloaded") {
        // On a phone the share sheet handles it; on desktop say where it went.
        console.info("Label saved as PNG");
      }
    } catch (err) {
      alert(`${tr("saveImageFailed")} ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void store.getLabel(id).then((l) => (l ? setLabel(l) : setMissing(true)));
  }, [id]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  /**
   * Sticker appearance is stored on the label, so editing it here has to save
   * back — debounced, the same way the editor does it.
   */
  const update = (patch: Partial<CoffeeLabel>) => {
    setLabel((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void store.saveLabel(next).catch(() => {}), 600);
      return next;
    });
  };

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
  }, [
    sheet,
    copies,
    gap,
    guides,
    variant,
    label?.size,
    label?.customW,
    label?.customH,
    label?.layout,
    label?.showQr,
  ]);

  if (missing) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="font-serif text-2xl font-semibold">{tr("labelNotFound")}</h1>
        <Link href="/" className="btn btn-primary mt-5">
          {tr("backToLibrary")}
        </Link>
      </div>
    );
  }

  if (!label || !size || !grid) {
    return <p className="px-5 py-10 text-sm text-muted">{tr("loading")}</p>;
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
      live={false}
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
            ← {tr("editorWord")}
          </Link>
          <h1 className="mr-auto truncate font-serif text-lg font-semibold">
            {tr("printTitle")} · {labelTitle(label)}
          </h1>
          <LangToggle />
          <button className="btn" onClick={saveImage} disabled={saving}>
            {saving ? tr("rendering") : tr("saveImage")}
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            {tr("print")}
          </button>
        </div>
      </header>

      <div className="no-print mx-auto max-w-6xl px-5 pt-5">
        <div className="panel mb-3 p-4">
          <h2 className="section-title mb-3">{tr("secSticker")}</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="field">
              <span>{tr("fSize")}</span>
              <select
                className="select"
                value={label.size}
                onChange={(e) => update({ size: e.target.value as SizeId })}
              >
                {(Object.keys(SIZES) as SizeId[]).map((k) => (
                  <option key={k} value={k}>
                    {sizeName(k, SIZES[k].name, lang)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{tr("fLayout")}</span>
              <select
                className="select"
                value={label.layout}
                onChange={(e) => update({ layout: e.target.value as LayoutId })}
              >
                <option value="full">{tr("layoutFull")}</option>
                <option value="ribbon">{tr("layoutRibbon")}</option>
                <option value="compact">{tr("layoutCompact")}</option>
              </select>
            </label>
            <label className="field">
              <span>{tr("fColour")}</span>
              <select
                className="select"
                value={label.theme}
                onChange={(e) => update({ theme: e.target.value as ThemeId })}
              >
                {(Object.keys(THEMES) as ThemeId[]).map((k) => (
                  <option key={k} value={k}>
                    {THEMES[k].name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{tr("fQr")}</span>
              <span className="flex h-[38px] items-center gap-2">
                <input
                  type="checkbox"
                  checked={label.showQr}
                  onChange={(e) => update({ showQr: e.target.checked })}
                />
                <span className="text-sm font-normal normal-case tracking-normal text-ink">
                  {tr("printQr")}
                </span>
              </span>
            </label>

            {label.size === "custom" && (
              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <label className="field">
                  <span>{tr("fWidthMm")}</span>
                  <input
                    type="number"
                    min={MIN_MM}
                    max={MAX_MM}
                    className="input"
                    value={label.customW}
                    onChange={(e) => update({ customW: Number(e.target.value) })}
                    onBlur={(e) => update({ customW: clampMm(Number(e.target.value), 100) })}
                  />
                </label>
                <label className="field">
                  <span>{tr("fHeightMm")}</span>
                  <input
                    type="number"
                    min={MIN_MM}
                    max={MAX_MM}
                    className="input"
                    value={label.customH}
                    onChange={(e) => update({ customH: Number(e.target.value) })}
                    onBlur={(e) => update({ customH: clampMm(Number(e.target.value), 70) })}
                  />
                </label>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">
            {label.size === "custom"
              ? `${tr("customBetween")} ${MIN_MM}–${MAX_MM} ${tr("mmEachSide")}`
              : sizeHint(label.size, SIZES[label.size].hint, lang)}
            {" · "}
            {tr("savedToLabel")}
          </p>
        </div>

        <div className="panel grid gap-3 p-4 sm:grid-cols-5">
          <label className="field">
            <span>{tr("fContent")}</span>
            <select
              className="select"
              value={variant}
              onChange={(e) => setVariant(e.target.value as "full" | "brew")}
            >
              <option value="full">{tr("fullLabel")}</option>
              <option value="brew">{tr("brewOnly")}</option>
            </select>
          </label>
          <label className="field">
            <span>{tr("fPaper")}</span>
            <select
              className="select"
              value={sheet}
              onChange={(e) => setSheet(e.target.value as SheetId)}
            >
              {(Object.keys(SHEETS) as SheetId[]).map((k) => (
                <option key={k} value={k}>
                  {tr(SHEETS[k].key)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{tr("fCopies")}</span>
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
            <span>{tr("fGapMm")}</span>
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
            <span>{tr("fCutGuides")}</span>
            <span className="flex h-[38px] items-center gap-2">
              <input
                type="checkbox"
                checked={guides}
                onChange={(e) => setGuides(e.target.checked)}
              />
              <span className="text-sm font-normal normal-case tracking-normal text-ink">
                {tr("showDashed")}
              </span>
            </span>
          </label>
        </div>

        <p className="mt-3 text-xs text-muted">
          {tr("stickerWord")} {size.name} · {grid.cols} × {grid.rows} {tr("perPage")} ·{" "}
          {grid.pages} {grid.pages === 1 ? tr("pageWord") : tr("pagesWord")}.
        </p>
        <div className="mt-2 rounded-lg border border-line bg-brand-soft/50 px-3 py-2 text-xs text-muted">
          <b className="text-ink">{tr("printTipsTitle")}</b>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>{tr("tipHeaders")}</li>
            <li>
              <b className="text-ink">{tr("tipMargins")}</b>
            </li>
            <li>{tr("tipScale")}</li>
            <li>{tr("tipBackground")}</li>
          </ul>
        </div>
      </div>

      {/* Off-screen so it can be rendered to PNG at full size without the
          on-screen fit scaling or the dashed cut guide. */}
      <div
        ref={exportRef}
        aria-hidden="true"
        className="no-print pointer-events-none fixed left-[-10000px] top-0"
      >
        <Sticker label={label} qrUrl={brewUrl} variant={variant} live={false} />
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
