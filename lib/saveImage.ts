/**
 * Renders a sticker element to a PNG and hands it to the user.
 *
 * On a phone the Web Share sheet is used, which is the only route that offers
 * "Save Image" straight into the photo album. Everywhere else it falls back to
 * a normal download.
 *
 * The sticker is drawn by wrapping a clone of it in an SVG <foreignObject> and
 * rasterising that. Only the rules the sticker actually uses are carried over,
 * which keeps the data URL small and avoids the whole-stylesheet walk that made
 * off-the-shelf DOM-to-image libraries stall on this markup.
 */
export type SaveResult = "shared" | "downloaded";

function slug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "bean-label"
  );
}

/** `:root` variables plus every `.cl-*` rule — everything the sticker needs. */
function stickerCss(): string {
  const keep = /(^|[\s,>])(:root|html|body|\.cl-)/;
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet, nothing readable
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule && keep.test(rule.selectorText)) {
        out.push(rule.cssText);
      }
    }
  }
  return out.join("\n");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The label image could not be rasterised"));
    img.src = src;
  });
}

export async function stickerToPng(
  el: HTMLElement,
  /** multiplier over the on-screen size — 4 is roughly 300 dpi at label size */
  scale = 4,
  /**
   * The sticker's real size in millimetres, with the dots per inch to render
   * it at. Given both, the PNG comes out at exactly the pixel count that
   * printer wants for that label, instead of a multiple of the CSS size that
   * the printer's own app would then have to resample. `scale` is ignored.
   */
  exact?: { mm: { w: number; h: number }; dpi: number },
): Promise<Blob> {
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  if (!width || !height) throw new Error("The label has no size to render");

  const clone = el.cloneNode(true) as HTMLElement;
  // The dashed cut guide is a print aid, not part of the artwork.
  clone.classList.remove("cut-guide");
  clone.style.outline = "none";
  clone.style.boxShadow = "none";
  clone.style.margin = "0";

  const serialized = new XMLSerializer().serializeToString(clone);
  const css = stickerCss();

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml">` +
    `<style>/*<![CDATA[*/${css}/*]]>*/</style>` +
    serialized +
    `</div></foreignObject></svg>`;

  const img = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );

  const canvas = document.createElement("canvas");
  if (exact) {
    const px = (mm: number) => Math.round((mm / 25.4) * exact.dpi);
    canvas.width = px(exact.mm.w);
    canvas.height = px(exact.mm.h);
  } else {
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  // Paint white underneath so transparent edges don't come out black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Could not encode the PNG");
  return blob;
}

export async function saveStickerImage(
  el: HTMLElement,
  coffeeName: string,
  exact?: { mm: { w: number; h: number }; dpi: number },
): Promise<SaveResult> {
  return deliverPng(await stickerToPng(el, 4, exact), coffeeName);
}

/** Whether this browser can put an image on the clipboard at all. */
export function canCopyImages(): boolean {
  return (
    typeof ClipboardItem !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function"
  );
}

/**
 * Puts the sticker on the clipboard, ready to paste into a chat or a document.
 *
 * Takes the PNG as a promise rather than a finished blob on purpose: Safari
 * only allows a clipboard write inside the gesture that asked for it, and
 * rendering the sticker first would end that gesture. Building the
 * ClipboardItem from the promise keeps the write inside it.
 */
export async function copyPngToClipboard(png: Blob | Promise<Blob>): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

/** Dots per inch of the printer a layout is drawn for. */
export const THERMAL_DPI = 300;

/**
 * How to rasterise this label: at the printer's own resolution when it is
 * drawn for one, and at the usual multiple of the screen size otherwise.
 */
export function exactFor(
  label: { layout: string },
  mm: { w: number; h: number },
): { mm: { w: number; h: number }; dpi: number } | undefined {
  return label.layout === "thermal" ? { mm, dpi: THERMAL_DPI } : undefined;
}

/** Hands a picture already made to the user: share sheet on a phone, else a download. */
export async function deliverPng(blob: Blob, coffeeName: string): Promise<SaveResult> {
  const filename = `${slug(coffeeName)}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
  };
  if (nav.canShare?.({ files: [file] }) && typeof navigator.share === "function") {
    try {
      await navigator.share({ files: [file], title: coffeeName });
      return "shared";
    } catch (err) {
      // Dismissing the share sheet is not an error worth reporting.
      if (err instanceof DOMException && err.name === "AbortError") return "shared";
      // Anything else falls through to a plain download.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
