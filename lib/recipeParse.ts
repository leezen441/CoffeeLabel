import { GRINDER_BRANDS, METHOD_PRESETS, emptyStep, grinderModels } from "./types";
import type { BrewStep } from "./types";

/**
 * Reads a brew recipe written as prose — the shape an AI or a roaster's page
 * hands you — into the fields this app stores.
 *
 * It is deliberately a plain parser rather than a model call: it costs nothing,
 * works offline, and the text never leaves the device. It is also happy to find
 * nothing: whatever it cannot read is left blank for the person to fill in,
 * which is why the editor shows what was understood before anything is applied.
 */

export type ParsedRecipe = {
  name: string;
  waterTempC: string;
  doseG: string;
  yieldG: string;
  grinderBrand: string;
  grinderModel: string;
  grind: string;
  totalTime: string;
  steps: BrewStep[];
  /** Field keys that were actually recognised, for the preview. */
  found: string[];
};

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const CLOCK = /\b(\d{1,2}:\d{2})\b/g;

function num(value: string | undefined): string {
  return (value ?? "").replace(",", ".").replace(/\.0+$/, "");
}

/** Lines that open a step: "1.", "2)", "Step 3", "ขั้นที่ 4", "-", "•". */
const STEP_LINE = /^\s*(?:(?:step|ขั้น(?:ที่)?)\s*)?(\d{1,2})\s*[.)］:]\s*|^\s*[-•*]\s*/i;

export function parseRecipe(raw: string): ParsedRecipe {
  const text = raw.replace(/\r/g, "");
  const allLines = text.split("\n");
  /**
   * Every line that is not a step. Reading the whole text meant "Add 50 g
   * water" in step one was taken for the water total; reading only the lines
   * above the steps missed a grinder noted underneath them.
   */
  const meta = allLines.filter((l) => !STEP_LINE.test(l)).join("\n");
  const found: string[] = [];
  const mark = (key: string) => {
    if (!found.includes(key)) found.push(key);
  };

  /* ---- temperature first: it owns a number that water totals would steal ---- */
  let waterTempC = "";
  const temp =
    meta.match(new RegExp(String.raw`(${NUM})\s*(?:°\s*c\b|℃|องศา|degrees?\b|deg\b)`, "i")) ??
    meta.match(
      new RegExp(String.raw`(?:อุณหภูมิ|temp\w*|water)\D{0,10}(${NUM})\s*(?:c\b|°|องศา)?`, "i"),
    );
  if (temp) {
    const n = parseFloat(num(temp[1]));
    // Anything outside this is a weight or a time, not a brew temperature.
    if (n >= 60 && n <= 100) {
      waterTempC = num(temp[1]);
      mark("waterTempC");
    }
  }
  // Take it out of the way so weights cannot match it.
  const body = waterTempC
    ? meta.replace(
        new RegExp(String.raw`${waterTempC}\s*(?:°\s*c|℃|องศา|degrees?|deg|c\b)`, "i"),
        " ",
      )
    : meta;

  /* ---- dose and yield ---- */
  const grams = String.raw`\s*(?:g\b|gr\b|grams?\b|กรัม|ก\.)`;
  let doseG = "";
  let yieldG = "";

  const dose =
    body.match(new RegExp(String.raw`(?:dose|ผง|กาแฟ|coffee)\D{0,10}(${NUM})`, "i")) ??
    body.match(new RegExp(String.raw`(${NUM})${grams}\s*(?:of\s*)?(?:coffee|ผง|กาแฟ)`, "i")) ??
    body.match(new RegExp(String.raw`(${NUM})${grams}\s*in\b`, "i"));
  if (dose) {
    doseG = num(dose[1]);
    mark("doseG");
  }

  const yieldMatch =
    body.match(
      new RegExp(String.raw`(?:yield|น้ำรวม|total\s*water|น้ำทั้งหมด)\D{0,10}(${NUM})`, "i"),
    ) ??
    body.match(new RegExp(String.raw`(${NUM})${grams}\s*out\b`, "i")) ??
    body.match(new RegExp(String.raw`(${NUM})${grams}\s*(?:of\s*)?(?:water|น้ำ)`, "i"));
  if (yieldMatch) {
    yieldG = num(yieldMatch[1]);
    mark("yieldG");
  }

  // "1:16" fills in whichever side is missing.
  const ratio = body.match(new RegExp(String.raw`\b1\s*:\s*(${NUM})\b`));
  if (ratio) {
    const r = parseFloat(num(ratio[1]));
    if (r > 1 && r < 30) {
      if (doseG && !yieldG) {
        yieldG = String(Math.round(parseFloat(doseG) * r));
        mark("yieldG");
      } else if (yieldG && !doseG) {
        doseG = (parseFloat(yieldG) / r).toFixed(1).replace(/\.0$/, "");
        mark("doseG");
      }
    }
  }

  /* ---- grinder ---- */
  let grinderBrand = "";
  let grinderModel = "";
  for (const b of GRINDER_BRANDS) {
    if (new RegExp(String.raw`\b${b.brand.replace(/[-/\^$*+?.()|[\]{}]/g, "\$&")}\b`, "i").test(body)) {
      grinderBrand = b.brand;
      mark("grinderBrand");
      for (const m of grinderModels(b.brand)) {
        if (new RegExp(m.name.replace(/[-/\^$*+?.()|[\]{}]/g, "\$&"), "i").test(body)) {
          grinderModel = m.name;
          mark("grinderModel");
          break;
        }
      }
      break;
    }
  }

  let grind = "";
  const clicks =
    body.match(new RegExp(String.raw`(${NUM})\s*(?:clicks?|คลิก)`, "i")) ??
    // \bgrind\b so "Grinder: 1Zpresso" cannot donate its 1.
    body.match(
      new RegExp(String.raw`\b(?:setting|grind(?:\s*size)?|เบอร์(?:บด)?|ตั้ง)\b\W{0,4}(${NUM})`, "i"),
    );
  if (clicks) {
    grind = num(clicks[1]);
    mark("grind");
  }

  /* ---- steps ---- */
  const lines = text.split("\n");
  const steps: BrewStep[] = [];
  for (const line of lines) {
    if (!STEP_LINE.test(line)) continue;
    let rest = line.replace(STEP_LINE, "").trim();
    if (!rest) continue;

    const clocks = [...rest.matchAll(CLOCK)].map((m) => m[1]);
    let startAt = "";
    let endAt = "";
    if (clocks.length >= 2) {
      [startAt, endAt] = clocks;
    } else if (clocks.length === 1) {
      // One time is the end of the step, the way the app's own labels read.
      endAt = clocks[0];
    }

    const water = rest.match(new RegExp(String.raw`(${NUM})${grams}`, "i"));
    const waterG = water ? num(water[1]) : "";

    // Leave the sentence, drop the figures that now live in their own fields.
    rest = rest
      .replace(/\b\d{1,2}:\d{2}\s*[–\-—~]\s*\d{1,2}:\d{2}\b/g, " ")
      .replace(/\b\d{1,2}:\d{2}\b/g, " ")
      .replace(/[(（]\s*[)）]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      // "…cap and flip at", "…จบที่" — the clock they pointed to has moved out.
      .replace(/[\s,;·|—–-]*(?:\b(?:at|by|until)\b|จบที่|ที่|เมื่อ|ตอน)\s*$/i, "")
      .replace(/[\s,;·|—–-]+$/, "")
      .trim();

    steps.push({ ...emptyStep(), text: rest, startAt, endAt, waterG });
  }
  if (steps.length) mark("steps");

  /* ---- water figures: cumulative is what we store ---- */
  const figures = steps.map((s) => parseFloat(s.waterG)).filter((n) => Number.isFinite(n));
  const rising = figures.every((n, i) => i === 0 || n >= figures[i - 1]);
  /**
   * Rising figures are not proof of a running total — "add 50, add 70, add 90"
   * rises too — so the wording decides it. Arithmetic cannot: a recipe whose
   * pours genuinely run 50 then 175 sums to exactly the 225 it declares, and
   * rewriting those figures would be changing numbers the person can read.
   */
  const stepWords = steps.map((s) => s.text).join(" ");
  const saysAdd = /\b(?:add|another|more)\b|เพิ่ม|อีก/i.test(stepWords);
  const saysUpTo = /\b(?:to|until)\b|ถึง|รวม/i.test(stepWords);
  if (figures.length > 1 && (!rising || (saysAdd && !saysUpTo))) {
    // Written as separate pours — add them up into the running total.
    let sum = 0;
    for (const step of steps) {
      const n = parseFloat(step.waterG);
      if (!Number.isFinite(n)) continue;
      sum += n;
      step.waterG = String(Math.round(sum * 10) / 10);
    }
    mark("poursSummed");
  }

  /* ---- total time ---- */
  let totalTime = "";
  const declared = text.match(
    /(?:total|รวม|จบ(?:ที่)?|finish(?:es)?(?:\s*at)?|ends?\s*at)\D{0,10}(\d{1,2}:\d{2})/i,
  );
  if (declared) {
    totalTime = declared[1];
    mark("totalTime");
  } else {
    const lastEnd = steps.map((s) => s.endAt).filter(Boolean).pop();
    if (lastEnd) {
      totalTime = lastEnd;
      mark("totalTime");
    }
  }

  /* ---- name ---- */
  let name = "";
  const preset = METHOD_PRESETS.find((m) =>
    new RegExp(String.raw`\b${m.replace(/\s+/g, String.raw`\s*`)}\b`, "i").test(text),
  );
  if (preset) {
    name = preset;
    mark("name");
  } else {
    const first = lines.map((l) => l.trim()).find(Boolean) ?? "";
    if (first && first.length <= 40 && !STEP_LINE.test(first)) {
      name = first;
      mark("name");
    }
  }

  if (!yieldG && figures.length) {
    const top = steps.map((s) => parseFloat(s.waterG)).filter(Number.isFinite).pop();
    if (top) {
      yieldG = String(top);
      mark("yieldG");
    }
  }

  return {
    name,
    waterTempC,
    doseG,
    yieldG,
    grinderBrand,
    grinderModel,
    grind,
    totalTime,
    steps,
    found,
  };
}
