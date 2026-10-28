/**
 * Turn the text off a coffee bag into label fields, without a model.
 *
 * The rules are the same ones in `scanRules.ts`, written out as code so they
 * can run in the browser on whatever an OCR engine managed to read. OCR output
 * is messy — stray characters, missing colons, joined-up lines — so every rule
 * is forgiving about spacing and punctuation, and anything it is not sure of
 * is left empty rather than guessed.
 */

import type { ScanResult } from "./scanRules";

/**
 * A line of text, with the height of its letters and how far down the label
 * it sits (0 at the top, 1 at the bottom), where OCR reported them.
 */
export type ScannedLine = { text: string; height?: number; top?: number };

const EMPTY: ScanResult = {
  roaster: "",
  coffeeName: "",
  variety: "",
  origin: "",
  processes: [],
  altitude: "",
  roastLevel: 0,
  roastDate: "",
  netWeight: "",
  tastingNotes: [],
  restFrom: 0,
  restTo: 0,
  unsure: [],
};

/**
 * Keys as roasters write them, loosely — OCR drops and adds characters.
 *
 * Each is a source string rather than a finished regex, because a key is
 * hunted for anywhere in a line, not just at its start: OCR routinely puts
 * a stray mark in front of one ("- 4 (J Varietal : Caturra, ...").
 */
const FIELD_KEYS: { field: keyof ScanResult | "roastWord"; src: string }[] = [
  { field: "tastingNotes", src: String.raw`tast(?:e|ing)?\s*notes?|notes?|flavou?rs?` },
  { field: "processes", src: String.raw`process(?:ing)?(?:\s*method)?` },
  { field: "variety", src: String.raw`variet(?:al|y|ies)|cultivar` },
  { field: "altitude", src: String.raw`altitude|elevation` },
  { field: "restFrom", src: String.raw`degas(?:sing)?(?:\s*period)?|rest(?:ing)?(?:\s*period)?` },
  { field: "roastWord", src: String.raw`roast\s*level|roast(?:ed)?\s*profile` },
  { field: "roastDate", src: String.raw`roast(?:ed)?\s*(?:date|on)|date\s*roasted` },
  { field: "origin", src: String.raw`origins?|region|farm|producer` },
  { field: "roaster", src: String.raw`roaster|roasted\s*by` },
  { field: "netWeight", src: String.raw`net\s*(?:weight|wt)?|weight` },
  { field: "coffeeName", src: String.raw`coffee\s*name` },
];

/** The key, wherever it sits, and whatever follows it on the line. */
function keyMatch(line: string, src: string): RegExpExecArray | null {
  // A colon is the usual separator, a semicolon is a misread one, and a wide
  // gap is what is left when a label sets its keys in a column.
  const clear = new RegExp(
    String.raw`(?:^|[^A-Za-z])(?:${src})\s*(?:[:;：]\s*|\s{2,})(.*)$`,
    "i",
  ).exec(line);
  if (clear) return clear;
  // OCR reads a column gap as a single space, which on its own would make
  // any sentence a field, so a value has to be long enough to be one.
  return new RegExp(String.raw`(?:^|[^A-Za-z])(?:${src})\s+(.{4,})$`, "i").exec(line);
}

/** Is this line one of the labelled fields, under any amount of OCR noise? */
function looksLikeKey(line: string): boolean {
  return FIELD_KEYS.some((f) => keyMatch(line, f.src));
}

/**
 * Drop the marks OCR tacks onto the end of a value — a stray bracket, a
 * fragment of the next column, half a letter from the border.
 */
/** A nickname is printed in quotes; the quotes are not part of the name. */
function dequote(v: string): string {
  return v.replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
}

/** Are all the words of a line set the same way — all caps, or not? */
function sameCase(v: string): boolean {
  const words = v.split(/\s+/).filter((w) => /^[A-Za-z]{2,}$/.test(w));
  if (words.length < 2) return true;
  const caps = words.filter((w) => w === w.toUpperCase()).length;
  return caps === 0 || caps === words.length;
}

/** Is this token a fragment of the artwork rather than a word? */
function isNoise(token: string): boolean {
  if (!/[A-Za-z0-9]/.test(token)) return true;
  if (token.length <= 2) return true;
  return /^[A-Za-z]{3,4}$/.test(token) && !/[aeiouy]/i.test(token);
}

function scrub(v: string): string {
  let out = cleanValue(v);
  // Junk arrives at the front of a line as often as at the end.
  for (let i = 0; i < 4; i += 1) {
    const lead = /^(\S{1,3})\s+(\S.*)$/.exec(out);
    // A number at the front is the value itself: "7 - 12 Days", "250 g".
    if (!lead || /\d/.test(lead[1]) || !isNoise(lead[1])) break;
    out = cleanValue(lead[2]);
  }
  for (let i = 0; i < 4; i += 1) {
    const m = /^(.*\S)\s+(\S{1,3})$/.exec(out);
    if (!m) break;
    const tail = m[2];
    // Letters with no vowel in them are a fragment of the artwork, not a word.
    if (/^[A-Za-z]{3,4}$/.test(tail) && !/[aeiouy]/i.test(tail)) {
      out = cleanValue(m[1]);
      continue;
    }
    if (/^[A-Za-z]{3,}$/.test(tail)) break;
    out = cleanValue(m[1]);
  }
  return out;
}

/** Words that are a process on their own line, as the tin labels print them. */
const PROCESS_WORDS =
  /\b(washed|natural|honey|anaerobic|carbonic\s*maceration|semi[- ]washed|wet[- ]hulled|dry\s*process|fermentation)\b/i;

const ROAST_WORDS: { re: RegExp; level: number }[] = [
  { re: /\b(?:light[-\s]*medium|medium[-\s]*light)\b/i, level: 2 },
  { re: /\b(?:medium[-\s]*dark|dark[-\s]*medium)\b/i, level: 4 },
  { re: /\blight\b/i, level: 1 },
  { re: /\bmedium\b/i, level: 3 },
  { re: /\b(?:dark|french|italian)\b/i, level: 5 },
];

/**
 * Countries a bag is likely to shout at the top. When one of these is the
 * biggest line, the name of the coffee is the next one down — "Colombia" over
 * "Flower Of Dream" is an origin and a name, not a two-line name.
 */
const ORIGIN_COUNTRY =
  /^(?:colombia|brazil|brasil|ethiopia|kenya|rwanda|burundi|guatemala|costa\s*rica|panama|honduras|el\s*salvador|nicaragua|mexico|peru|bolivia|ecuador|indonesia|sumatra|java|bali|papua\s*new\s*guinea|png|vietnam|viet\s*nam|laos|myanmar|burma|india|china|yunnan|yemen|tanzania|uganda|malawi|zambia|congo|thailand|timor|east\s*timor|jamaica|hawaii|nepal)\b/i;

/** Lines that are never a coffee name, however big they are printed. */
const NOT_A_NAME =
  /^(?:usda|organic|certified\s+organic|ideal\s+for|blend|single\s+origin|filter\s+roasted|omni\s+roasted|espresso\s+roasted|sweetness|acidity|body|roast|light|medium|dark|net|www\.|https?:)/i;

function cleanValue(v: string): string {
  return v
    .replace(/^[\s:;.\-–—|]+/, "")
    .replace(/[\s:;|]+$/, "")
    .trim();
}

function splitList(v: string): string[] {
  return v
    .split(/\s*[,/·•]\s*|\s{3,}/)
    .map((p) => cleanValue(p))
    .filter((p) => p.length > 1 && p.length < 40);
}

/**
 * A date as a bag prints it. Thai roasters use the Buddhist year, 543 ahead of
 * the Western one, and write the day first: "25-10-2569" is 2026-10-25.
 */
export function parseLabelDate(text: string, today = new Date(), bare = false): string {
  const full = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(text);
  if (full) {
    let [, d, m, y] = full.map(Number) as unknown as [number, number, number, number];
    if (y < 100) y += 2000;
    if (y > 2400) y -= 543;
    // Written month-first when the first number cannot be a day.
    if (d > 31 || (m > 12 && d <= 12)) [d, m] = [m, d];
    if (m < 1 || m > 12 || d < 1 || d > 31) return "";
    if (y < 2000 || y > today.getFullYear() + 1) return "";
    return iso(y, m, d);
  }
  // "2/10" handwritten in a roast box: this year, or last if that is ahead.
  // Only where the label already said this is a date — on its own, two small
  // numbers with a dash between them is far more often a range.
  const short = bare ? /\b(\d{1,2})\s*[/-]\s*(\d{1,2})\b/.exec(text) : null;
  if (short) {
    const d = Number(short[1]);
    const m = Number(short[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const y = today.getFullYear();
      const guess = new Date(Date.UTC(y, m - 1, d));
      return iso(guess > today ? y - 1 : y, m, d);
    }
  }
  return "";
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "7 - 12 Days" → [7, 12]; "10 days" → [10, 10]. */
function parseRest(v: string): [number, number] {
  const range = /(\d{1,3})\s*[-–—to]+\s*(\d{1,3})/i.exec(v);
  if (range) return [Number(range[1]), Number(range[2])];
  const one = /(\d{1,3})/.exec(v);
  return one ? [Number(one[1]), Number(one[1])] : [0, 0];
}

/** Grams. "250G" is 250, "1KG" is 1000, "Net 200 g." is 200. */
function parseWeight(v: string): string {
  // "250G [ ] 1KG" is a choice with a tick box, and the tick is not text:
  // reading either number would be a coin toss, so read neither.
  const all = [...v.matchAll(/(\d+(?:\.\d+)?)\s*(kg|g\b|gr|gm|กก|กรัม)/gi)].map((m) =>
    /^(?:kg|กก)/i.test(m[2]) ? String(Math.round(Number(m[1]) * 1000)) : m[1],
  );
  const distinct = [...new Set(all)];
  return distinct.length === 1 ? distinct[0] : "";
}

export function parseLabelText(lines: ScannedLine[], today = new Date()): ScanResult {
  const out: ScanResult = { ...EMPTY, processes: [], tastingNotes: [], unsure: [] };
  const rows = lines
    // Tabs and newlines become spaces, but runs of spaces survive: on a label
    // with no colons, the gap after "Notes" is all that marks it as a key.
    .map((l) => ({ ...l, text: l.text.replace(/[^\S ]+/g, " ").trim() }))
    .filter((l) => l.text.length > 0);
  const used = new Set<number>();
  let roastWord = "";

  rows.forEach((row, i) => {
    let hit: (typeof FIELD_KEYS)[number] | undefined;
    let rest = "";
    for (const f of FIELD_KEYS) {
      const m = keyMatch(row.text, f.src);
      if (m) {
        hit = f;
        rest = m[1];
        break;
      }
    }
    if (!hit) return;

    // The value may have wrapped onto the next line.
    let value = scrub(rest);
    if (!value && rows[i + 1] && !looksLikeKey(rows[i + 1].text)) {
      value = scrub(rows[i + 1].text);
      used.add(i + 1);
    }
    if (!value) return;
    used.add(i);

    switch (hit.field) {
      case "tastingNotes":
        out.tastingNotes = splitList(value).map(scrub).filter(Boolean);
        break;
      case "processes":
        out.processes = [value];
        break;
      case "variety":
        out.variety = value;
        break;
      case "altitude":
        out.altitude = value;
        break;
      case "origin":
        out.origin = value;
        break;
      case "roaster":
        out.roaster = value;
        break;
      case "coffeeName":
        out.coffeeName = value;
        break;
      case "netWeight":
        out.netWeight = parseWeight(value);
        break;
      case "restFrom": {
        const [from, to] = parseRest(value);
        out.restFrom = from;
        out.restTo = to;
        break;
      }
      case "roastWord":
        roastWord = value;
        break;
      case "roastDate":
        out.roastDate = parseLabelDate(value, today, true);
        break;
    }
  });

  // A date printed on its own sticker, away from any "Roast date" line.
  if (!out.roastDate) {
    for (let i = 0; i < rows.length; i += 1) {
      if (used.has(i)) continue;
      // A line that is nothing but "2/10" is a date someone wrote in a box.
      // A dash would be a range, so only a slash counts out here.
      const alone = /^\d{1,2}\s*\/\s*\d{1,2}$/.test(rows[i].text);
      const found = parseLabelDate(rows[i].text, today, alone);
      if (found) {
        out.roastDate = found;
        break;
      }
    }
  }

  // A roast level from its own line ("LIGHT", or an axis read as one line).
  if (!roastWord) {
    const free = rows.filter((r, i) => !used.has(i) && r.text.length < 24);
    const says = (re: RegExp) => free.some((r) => re.test(r.text));
    // A Light–Medium–Dark axis prints all three and marks one with a dot. The
    // dot is not text, so an axis says nothing about the level at all.
    const isAxis = says(/\blight\b/i) && says(/\bmedium\b/i) && says(/\bdark\b/i);
    const lone = free.find((r) => /\blight\b|\bmedium\b|\bdark\b/i.test(r.text));
    if (!isAxis && lone) roastWord = lone.text;
  }
  if (roastWord) {
    out.roastLevel = ROAST_WORDS.find((w) => w.re.test(roastWord))?.level ?? 0;
  } else {
    out.unsure.push("roast level");
  }

  // A process word on a line of its own, the way a tin label prints it. Only
  // the word itself: on a tin the columns sit at the same height, so its line
  // may also carry a tasting note and a roast scale.
  if (out.processes.length === 0) {
    for (let i = 0; i < rows.length; i += 1) {
      if (used.has(i)) continue;
      const m = PROCESS_WORDS.exec(rows[i].text);
      if (m) {
        out.processes = [cleanValue(m[0])];
        break;
      }
    }
  }

  if (!out.netWeight) {
    const weights = rows.filter((r) => /\b\d{2,4}\s*(?:g\b|gr|gm)|\b\d+(?:\.\d+)?\s*kg\b/i.test(r.text));
    // Boxes to tick are often one per line, which is the same coin toss.
    const found = weights.map((r) => parseWeight(r.text)).filter(Boolean);
    const distinct = [...new Set(found)];
    if (distinct.length === 1) out.netWeight = distinct[0];
    else if (distinct.length > 1) out.unsure.push("net weight");
  }

  if (!out.altitude) {
    const row = rows.find((r) => /\d[\d,.\s–-]*\s*(?:masl|m\.?a\.?s\.?l|meters?|metres?)\b/i.test(r.text));
    if (row) out.altitude = cleanValue(row.text);
  }

  // The name is the tallest line OCR found that is not a field or a slogan.
  // Without letter heights there is nothing to rank by, so nothing is claimed.
  const titles = rows
    // Scrubbed first: "RUMUKIA |:" is a name with a scrap of a border on it.
    .map((r, i) => ({ ...r, i, text: scrub(r.text) }))
    .filter(
      (r) =>
        !used.has(r.i) &&
        r.height !== undefined &&
        r.text.length >= 3 &&
        r.text.length <= 40 &&
        !NOT_A_NAME.test(r.text) &&
        !/\d{2,}/.test(r.text) &&
        !looksLikeKey(r.text) &&
        // A title is words. OCR noise is symbols and one-letter fragments, and
        // a wrong name is worse than none, so anything scruffy is left out.
        r.text.split(/\s+/).length <= 4 &&
        // A printed title is set in one style throughout. "Rea ETRE" mixes
        // Title case with CAPS, which no label does and OCR noise often does.
        sameCase(dequote(r.text)) &&
        // One proper word at least: "GEE Een ER EER" is noise that happens
        // to be spellable, and a wrong name is worse than none.
        dequote(r.text)
          .split(/\s+/)
          .some((word) => /^[A-Za-z]{4,}$/.test(word) && /[aeiouy]/i.test(word)) &&
        // Words have vowels. "YHI | NVN" is "NAN | THAILAND" upside down.
        dequote(r.text)
          .split(/\s+/)
          .filter((word) => word.length >= 3)
          .every((word) => /[aeiouy]/i.test(word)) &&
        // Real titles are made of real words. "B hoe Ne eo" is four letter
        // groups that happen to be letters, and is not a name.
        (dequote(r.text).split(/\s+/).filter((w) => w.length >= 3).length >= 2 ||
          /^[A-Za-z'’-]{4,}$/.test(dequote(r.text))) &&
        // A nickname is printed in quotes; they are not part of the name.
        /^[A-Za-z][A-Za-z'’\-\s|]+$/.test(dequote(r.text)) &&
        /[A-Za-z]{3,}/.test(r.text),
    )
    // Tallest first — but a name is printed at the top of a label, and a line
    // height is unreliable where the lettering overlaps artwork. On the tins a
    // tasting note measured taller than the coffee's own name.
    .sort((a, b) => {
      const rank = (r: { height?: number; top?: number }) =>
        (r.height ?? 0) * (r.top !== undefined && r.top < 0.4 ? 1 : 0.6);
      return rank(b) - rank(a);
    });

  if (!out.coffeeName && titles[0]) {
    const first = titles[0];
    const second = titles[1];
    if (ORIGIN_COUNTRY.test(first.text) && second && !ORIGIN_COUNTRY.test(second.text)) {
      // The country is set above the coffee's own name.
      if (!out.origin) out.origin = first.text;
      out.coffeeName = dequote(second.text);
    } else {
      out.coffeeName = dequote(first.text);
      // "NAN | THAILAND" under the name is a region and a country.
      if (second && !out.origin && /\|/.test(second.text)) {
        out.origin = second.text.replace(/\s*\|\s*/g, ", ");
      }
    }
  }
  if (!out.coffeeName) out.unsure.push("coffee name");
  if (!out.roaster) out.unsure.push("roaster");
  if (!out.roastDate) out.unsure.push("roast date");

  return out;
}

/** How much of a label a reading actually filled in. */
export function filledFields(r: ScanResult): number {
  return (
    [r.roaster, r.coffeeName, r.variety, r.origin, r.altitude, r.netWeight, r.roastDate].filter(
      (v) => v.trim(),
    ).length +
    (r.processes.length ? 1 : 0) +
    (r.tastingNotes.length ? 1 : 0) +
    (r.roastLevel ? 1 : 0) +
    (r.restFrom || r.restTo ? 1 : 0)
  );
}

/**
 * Two readings of the same bag, taken together. A cropped read is cleaner, so
 * it wins any field both of them found; the wider one is there to supply the
 * fields the crop cut off.
 */
export function mergeScans(first: ScanResult, second: ScanResult): ScanResult {
  const text = (a: string, b: string) => (a.trim() ? a : b);
  const merged: ScanResult = {
    // Not the name or the roaster: those are the biggest print on the label,
    // so if the crop could not read them the wider, noisier frame will only
    // offer something that looks like words.
    roaster: first.roaster,
    coffeeName: first.coffeeName,
    variety: text(first.variety, second.variety),
    origin: text(first.origin, second.origin),
    processes: first.processes.length ? first.processes : second.processes,
    altitude: text(first.altitude, second.altitude),
    roastLevel: first.roastLevel || second.roastLevel,
    roastDate: text(first.roastDate, second.roastDate),
    netWeight: text(first.netWeight, second.netWeight),
    tastingNotes: first.tastingNotes.length ? first.tastingNotes : second.tastingNotes,
    restFrom: first.restFrom || second.restFrom,
    restTo: first.restTo || second.restTo,
    unsure: [],
  };
  // Only still unsure about what neither reading managed.
  merged.unsure = first.unsure.filter((u) => second.unsure.includes(u));
  return merged;
}
