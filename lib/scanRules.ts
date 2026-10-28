/**
 * What Claude is told about a coffee bag label, and what it may send back.
 *
 * This is the file to extend when a new roaster's label reads badly: add a
 * rule, or an example under EXAMPLES. Nothing here is trained — it is the
 * prompt, so a change takes effect on the very next scan.
 */

import { z } from "zod";

/** One scanned label. Every field is required; unknown ones come back empty. */
export const ScanSchema = z.object({
  roaster: z.string(),
  coffeeName: z.string(),
  variety: z.string(),
  origin: z.string(),
  processes: z.array(z.string()),
  altitude: z.string(),
  /** 1 light … 5 dark; 0 when the label does not say */
  roastLevel: z.number(),
  /** YYYY-MM-DD, already converted from whatever the bag used */
  roastDate: z.string(),
  /** grams, digits only: "200", "250", "1000" */
  netWeight: z.string(),
  tastingNotes: z.array(z.string()),
  /** the degassing window in days, 0/0 when the label does not say */
  restFrom: z.number(),
  restTo: z.number(),
  /** field names that were on the bag but could not be read with confidence */
  unsure: z.array(z.string()),
});

export type ScanResult = z.infer<typeof ScanSchema>;

export const SYSTEM_PROMPT = `You read photographs of coffee bags and turn the label into fields.

The photo is of a real bag, tin or sticker, often taken in a hurry: rotated by
90 or 180 degrees, curved around a tin, dim, or at an angle. Read it anyway —
rotate it mentally. Never guess a value that is not on the label: leave the
field empty instead, and name it in "unsure" if it is written there but you
cannot make it out.

FIELDS

- roaster — the roasting company, often a logo or a line above the name.
- coffeeName — the name of this particular coffee, not the country. On
  "Colombia / Flower Of Dream" the name is "Flower Of Dream" and the country
  belongs in origin. Keep a quoted nickname without its quotes.
- origin — country, and region or farm when given, as one line:
  "Nan, Thailand", "Nyeri, Kenya", "Thailand Huay Krai, Khun Lao, Rom Yen".
- variety — the cultivar(s): "Caturra, Bourbon, Sidra", "SL28, SL34",
  "Arusha, Typica". A label may call it Varietal or Variety. It is NOT the
  process and NOT the region.
- processes — one entry per process named: ["Washed"], ["Natural"],
  ["Double Anaerobic Honey"], ["Special Process"]. Keep the roaster's own
  wording; do not split "Double Anaerobic Honey" into separate entries.
- altitude — as printed, including the unit: "1,700 - 1,800 masl",
  "1500 - 1850 meters", "1400-1600 masl".
- roastLevel — 1 light, 2 light-medium, 3 medium, 4 medium-dark, 5 dark.
  Many labels show a scale instead of a word: a row of bean icons with some
  filled in (3 of 5 filled = 3), or a Light/Medium/Dark axis with a dot or
  marker on one. A tick in a checkbox next to "Light" means 1. When a scale
  and a word disagree, trust the scale. "Omni" or "Omni roasted" is not a
  level — read the scale, and if there is none leave 0.
- roastDate — the day it was roasted, as YYYY-MM-DD. It is often a small
  separate sticker, or handwritten in a box. See DATES below.
- netWeight — grams, digits only. A label may print it ("Net 200 g.") or
  offer boxes to tick ("250G" / "1KG"): read the ticked one, and convert
  kilos to grams. Leave empty when nothing is ticked.
- tastingNotes — one entry per note, in the label's order. A label may call
  them Tastenote, Notes, or Taste Notes and separate them with commas.
  Keep every one, however many there are, exactly as written.
- restFrom / restTo — the degassing window in days. "Degas Period : 7 - 12
  Days" is restFrom 7, restTo 12. "Rest 10 days" is 10 and 10.

DATES

Thai roasters usually print the Buddhist year, which is 543 ahead of the
Western one, and the day first: "25-10-2569" is 25 October 2569 BE, so
roastDate is "2026-10-25". Any year above 2400 is a Buddhist year —
subtract 543. A two-digit year is 20xx. "2/10" handwritten with no year is
the 2nd of October of the current year; if that would be in the future, use
last year. When the day and month are genuinely ambiguous, prefer
day-month, which is how both Thai and British labels are written.

WHAT NOT TO DO

- Do not translate. Keep the label's own words and spelling, including
  misspellings like "Blackcerrant".
- Do not invent a roast date, weight, or degas window that is not printed.
- Do not put acidity, sweetness or body scores anywhere — this app has no
  field for them.
- Ignore a QR code, a barcode, a price, and marketing lines like
  "USDA ORGANIC" or "IDEAL FOR ESPRESSO".`;

/**
 * Worked examples, as plain text rather than images: they cost a fraction of
 * a photo and still teach the shapes these roasters use. Add one when a new
 * label reads badly — the label's text, then the fields it should produce.
 */
export const EXAMPLES: { label: string; result: Partial<ScanResult> }[] = [
  {
    label: `ME COFFEE ROASTER logo. Handwritten title "Colombia / Flower Of Dream".
Tastenote : Rose, Red Fruit, Lychee, Gummy
Process : Double Anaerobic Honey
Varietal : Caturra, Bourbon, Syrina
Altitude : 1,700 - 1,800 Masl.
Degas Period : 7 - 12 Days
Roast Level :  Light
Roast Date :  [separate sticker] 25-10-2569`,
    result: {
      roaster: "ME Coffee Roaster",
      coffeeName: "Flower Of Dream",
      origin: "Colombia",
      variety: "Caturra, Bourbon, Syrina",
      processes: ["Double Anaerobic Honey"],
      altitude: "1,700 - 1,800 masl",
      roastLevel: 1,
      roastDate: "2026-10-25",
      tastingNotes: ["Rose", "Red Fruit", "Lychee", "Gummy"],
      restFrom: 7,
      restTo: 12,
      netWeight: "",
    },
  },
  {
    label: `GAYO / NAN | THAILAND, printed on a black tin.
Icons across the middle: "GAYO 1400-1600 MASL", "WASHED",
"POMEGRANATE / RED BERRY / PINK FLORAL / PINEAPPLE",
a LIGHT–MEDIUM–DARK axis with the dot on LIGHT.
"FILTER ROASTED" in the corner. 100G / 200G, with 200G marked.`,
    result: {
      coffeeName: "Gayo",
      origin: "Nan, Thailand",
      variety: "Gayo",
      processes: ["Washed"],
      altitude: "1400-1600 masl",
      roastLevel: 1,
      netWeight: "200",
      tastingNotes: ["Pomegranate", "Red Berry", "Pink Floral", "Pineapple"],
      roastDate: "",
      restFrom: 0,
      restTo: 0,
    },
  },
  {
    label: `CERTIFIED GOOD. USDA ORGANIC. IDEAL FOR ESPRESSO.
Roast: five bean icons, the first three filled.
Acidity: five bean icons, the first three filled.
Notes: Mixed berries, stone fruit, milk chocolate, hazelnuts
Origins: Thailand Huay Krai, Khun Lao, Rom Yen
BLEND ______   [x] 250G  [ ] 1KG
ROAST box, handwritten: 2/10`,
    result: {
      coffeeName: "Certified Good",
      origin: "Thailand Huay Krai, Khun Lao, Rom Yen",
      processes: [],
      variety: "",
      altitude: "",
      roastLevel: 3,
      netWeight: "250",
      tastingNotes: ["Mixed berries", "stone fruit", "milk chocolate", "hazelnuts"],
      restFrom: 0,
      restTo: 0,
    },
  },
];

/** The examples, as the message pair they are sent as. */
export function exampleTurns(): { role: "user" | "assistant"; content: string }[] {
  return EXAMPLES.flatMap((e) => [
    { role: "user" as const, content: `A bag label reading:\n${e.label}` },
    { role: "assistant" as const, content: JSON.stringify(e.result) },
  ]);
}
