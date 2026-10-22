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
  type StickerVariant,
  MAX_MM,
  brewHasDetail,
  MIN_MM,
  SIZES,
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
  /** null = not run yet, a number = how many stickers the last run resized */
  const [resized, setResized] = useState<number | null>(null);
  const [resizing, setResizing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copies, setCopies] = useState(1);
  const [gap, setGap] = useState(4);
  const [guides, setGuides] = useState(true);
  /** "both" prints the bag sticker and the recipe sticker, one after the other. */
  const [variant, setVariant] = useState<"both" | "beans" | "brew" | "full">("both");
  /** which of the two stickers the size controls are editing */
  const [which, setWhich] = useState<"beans" | "brew">("beans");
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

  /**
   * Give every other sticker this one's size.
   *
   * Labels that already match are saved too, untouched. The library is ordered
   * by when a label was last written, so skipping them would shuffle them to
   * the bottom; writing all of them oldest-first leaves that order exactly as
   * it was. The count reported back is only the ones that actually moved.
   */
  async function applySizeToAll() {
    if (!label || resizing) return;
    const all = await store.listLabels();
    const others = all.filter((l) => l.id !== label.id);
    if (others.length === 0) {
      setResized(0);
      return;
    }
    if (!confirm(tr("sizeToAllConfirm"))) return;

    const patch: Partial<CoffeeLabel> =
      which === "brew"
        ? {
            brewSize: label.brewSize,
            brewCustomW: label.brewCustomW,
            brewCustomH: label.brewCustomH,
          }
        : { size: label.size, customW: label.customW, customH: label.customH };
    const keys = Object.keys(patch) as (keyof CoffeeLabel)[];
    setResizing(true);
    setFailed(false);
    try {
      let changed = 0;
      for (const other of [...others].reverse()) {
        if (keys.some((k) => other[k] !== patch[k])) changed++;
        await store.saveLabel({ ...other, ...patch });
      }
      // The debounced save for this label has not necessarily fired yet, and
      // it is the one every other sticker was just matched to.
      await store.saveLabel(label);
      setResized(changed);
    } catch {
      setFailed(true);
    } finally {
      setResizing(false);
    }
  }

  const size = label ? labelSize(label) : null;

  /**
   * One copy is one or two stickers. The recipe sticker is skipped when there
   * is no recipe to put on it, rather than printing a sticker with a name and
   * nothing else.
   */
  const sheetsPerCopy = useMemo<("beans" | "brew" | "full")[]>(() => {
    const hasRecipe = (label?.brews ?? []).some(brewHasDetail);
    if (variant === "both") return hasRecipe ? ["beans", "brew"] : ["beans"];
    return [variant];
  }, [variant, label]);

  const stickers = useMemo(
    () => Array.from({ length: copies }, () => sheetsPerCopy).flat(),
    [copies, sheetsPerCopy],
  );

  /**
   * A sheet holds one kind of sticker at a time, since the bag and the recipe
   * can be cut from different stock. Copies of each kind are tiled together
   * rather than interleaved, which is also how they are easiest to peel.
   */
  const runs = useMemo(() => {
    if (!label) return [];
    const order: StickerVariant[] = [];
    const counts = new Map<StickerVariant, number>();
    for (const kind of stickers) {
      if (!counts.has(kind)) order.push(kind);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    return order.map((kind) => {
      const count = counts.get(kind) ?? 0;
      const mm = labelSize(label, kind);
      if (sheet === "exact") {
        return { kind, size: mm, cols: 1, rows: 1, perPage: 1, count, pages: count };
      }
      const s = SHEETS[sheet];
      const cols = Math.max(1, Math.floor((s.w - s.margin * 2 + gap) / (mm.w + gap)));
      const rows = Math.max(1, Math.floor((s.h - s.margin * 2 + gap) / (mm.h + gap)));
      const perPage = cols * rows;
      return {
        kind,
        size: mm,
        cols,
        rows,
        perPage,
        count,
        pages: Math.max(1, Math.ceil(count / perPage)),
      };
    });
  }, [stickers, label, sheet, gap]);

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
    label?.brewSize,
    label?.brewCustomW,
    label?.brewCustomH,
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

  if (!label || !size) {
    return <p className="px-5 py-10 text-sm text-muted">{tr("loading")}</p>;
  }

  // On a sheet every page is the same paper. Printing at the exact sticker
  // size, each kind needs its own page rule — but only when they really
  // differ, so a single-size run keeps the plain rule every browser honours.
  const exactSizes = new Set(runs.map((r) => `${r.size.w}x${r.size.h}`));
  const pageStyle =
    sheet !== "exact"
      ? `@page { size: ${SHEETS[sheet].w}mm ${SHEETS[sheet].h}mm; margin: 0; }`
      : exactSizes.size <= 1
        ? `@page { size: ${runs[0]?.size.w ?? size.w}mm ${runs[0]?.size.h ?? size.h}mm; margin: 0; }`
        : runs
            .map(
              (r) =>
                `@page ${r.kind} { size: ${r.size.w}mm ${r.size.h}mm; margin: 0; } ` +
                `.print-page-${r.kind} { page: ${r.kind}; }`,
            )
            .join(" ");

  const brewUrl = origin ? `${origin}/b/${label.id}` : "";

  // The size controls edit one sticker at a time; these read and write it.
  const brewPicked = which === "brew";
  const sizeId = brewPicked ? label.brewSize : label.size;
  const mmW = brewPicked ? label.brewCustomW : label.customW;
  const mmH = brewPicked ? label.brewCustomH : label.customH;
  const setSizeId = (id: SizeId) => {
    setResized(null);
    update(brewPicked ? { brewSize: id } : { size: id });
  };
  const setMmW = (w: number) => update(brewPicked ? { brewCustomW: w } : { customW: w });
  const setMmH = (h: number) => update(brewPicked ? { brewCustomH: h } : { customH: h });

  const kindName = (kind: StickerVariant) =>
    kind === "brew" ? tr("sticker2") : kind === "full" ? tr("fullLabel") : tr("sticker1");

  const stickerOf = (kind: StickerVariant, key: number) => (
    <Sticker
      key={key}
      label={label}
      qrUrl={brewUrl}
      variant={kind}
      live={false}
      className={guides ? "cut-guide" : ""}
      style={guides ? { outline: "0.1mm dashed #c9c9c9" } : undefined}
    />
  );

  const pages = runs.flatMap((run) =>
    Array.from({ length: run.pages }, (_, p) => {
      const start = p * run.perPage;
      const count = Math.min(run.perPage, run.count - start);
      if (sheet === "exact") {
        return (
          <div
            key={`${run.kind}-${p}`}
            className={`print-page print-page-${run.kind}`}
            style={{
              width: `${run.size.w}mm`,
              height: `${run.size.h}mm`,
              background: "#fff",
            }}
          >
            {stickerOf(run.kind, start)}
          </div>
        );
      }
      const s = SHEETS[sheet];
      return (
        <div
          key={`${run.kind}-${p}`}
          className={`print-page print-page-${run.kind}`}
          style={{
            width: `${s.w}mm`,
            height: `${s.h}mm`,
            padding: `${s.margin}mm`,
            background: "#fff",
            boxSizing: "border-box",
            display: "grid",
            gridTemplateColumns: `repeat(${run.cols}, ${run.size.w}mm)`,
            gridAutoRows: `${run.size.h}mm`,
            gap: `${gap}mm`,
            alignContent: "start",
            justifyContent: "start",
          }}
        >
          {Array.from({ length: Math.max(0, count) }, (_, i) =>
            stickerOf(run.kind, start + i),
          )}
        </div>
      );
    }),
  );

  return (
    <div className="flex-1">
      <style dangerouslySetInnerHTML={{ __html: pageStyle }} />

      <header className="no-print sticky top-0 z-20 border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-5 py-3">
          <Link href="/" className="btn btn-ghost">
            ← {tr("library")}
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
          <div className="mb-3 flex flex-wrap gap-2">
            {(["beans", "brew"] as const).map((k) => (
              <button
                key={k}
                className={`btn text-xs ${which === k ? "btn-primary" : "btn-ghost"}`}
                aria-pressed={which === k}
                onClick={() => {
                  setWhich(k);
                  setResized(null);
                }}
              >
                {kindName(k)}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="field">
              <span>{tr("fSize")}</span>
              <select
                className="select"
                value={sizeId}
                onChange={(e) => setSizeId(e.target.value as SizeId)}
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

            {sizeId === "custom" && (
              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <label className="field">
                  <span>{tr("fWidthMm")}</span>
                  <input
                    type="number"
                    min={MIN_MM}
                    max={MAX_MM}
                    className="input"
                    value={mmW}
                    onChange={(e) => setMmW(Number(e.target.value))}
                    onBlur={(e) => setMmW(clampMm(Number(e.target.value), 100))}
                  />
                </label>
                <label className="field">
                  <span>{tr("fHeightMm")}</span>
                  <input
                    type="number"
                    min={MIN_MM}
                    max={MAX_MM}
                    className="input"
                    value={mmH}
                    onChange={(e) => setMmH(Number(e.target.value))}
                    onBlur={(e) => setMmH(clampMm(Number(e.target.value), 70))}
                  />
                </label>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">
            {sizeId === "custom"
              ? `${tr("customBetween")} ${MIN_MM}–${MAX_MM} ${tr("mmEachSide")}`
              : sizeHint(sizeId, SIZES[sizeId].hint, lang)}
            {" · "}
            {tr("savedToLabel")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className="btn text-xs shadow-[0_2px_0_rgba(0,0,0,0.18)] transition-transform active:translate-y-px disabled:shadow-none"
              disabled={resizing}
              onClick={applySizeToAll}
              style={
                resized !== null
                  ? { background: "#2E6B4B", borderColor: "#2E6B4B", color: "#fff" }
                  : failed
                    ? { background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" }
                    : { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" }
              }
            >
              {resizing
                ? tr("sizeToAllBusy")
                : failed
                  ? tr("sizeToAllFailed")
                  : resized === null
                    ? tr("sizeToAll")
                    : resized === 0
                      ? tr("sizeToAllNone")
                      : `${tr("sizeToAllDone")} ${resized} ${tr("stickersWord")}`}
            </button>
          </div>
        </div>

        <div className="panel grid gap-3 p-4 sm:grid-cols-5">
          <label className="field">
            <span>{tr("fContent")}</span>
            <select
              className="select"
              value={variant}
              onChange={(e) =>
                setVariant(e.target.value as "both" | "beans" | "brew" | "full")
              }
            >
              <option value="both">{tr("twoStickers")}</option>
              <option value="beans">{tr("beansOnly")}</option>
              <option value="brew">{tr("brewOnly")}</option>
              <option value="full">{tr("fullLabel")}</option>
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

        <div className="mt-3 text-xs text-muted">
          {runs.map((run) => (
            <p key={run.kind}>
              {kindName(run.kind)} · {run.size.name} · {run.cols} × {run.rows}{" "}
              {tr("perPage")} · {run.pages}{" "}
              {run.pages === 1 ? tr("pageWord") : tr("pagesWord")}.
            </p>
          ))}
          {sheetsPerCopy.length > 1 && <p>{tr("twoPerCopy")}.</p>}
        </div>
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
        {/* Save image exports one sticker; with "both" that is the bag one. */}
        <Sticker
          label={label}
          qrUrl={brewUrl}
          variant={sheetsPerCopy[0] ?? "beans"}
          live={false}
        />
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
