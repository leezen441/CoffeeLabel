export type RoastLevel = 1 | 2 | 3 | 4 | 5;

export type BrewStep = {
  id: string;
  /** e.g. "Bloom 40g, swirl" */
  text: string;
  /** mm:ss this step begins; blank means "when the previous step ended" */
  startAt: string;
  /** mm:ss this step ends */
  endAt: string;
  /** cumulative water in the brewer at the end of this step, drives the ribbon */
  waterG: string;
};

/** "0:30–1:00", "0:30", or "" — for printing, not for the timer. */
export function stepTimeLabel(step: BrewStep): string {
  const a = (step.startAt ?? "").trim();
  const b = (step.endAt ?? "").trim();
  if (a && b) return `${a}–${b}`;
  return b || a || "";
}

export type BrewMethod = {
  id: string;
  /** Espresso, V60, Aeropress, ... */
  name: string;
  waterTempC: string;
  doseG: string;
  yieldG: string;
  /** brand and model are picked separately; either may be free text */
  grinderBrand: string;
  grinderModel: string;
  /** dial setting on that grinder, e.g. "24" or "3.2.0" or "800" */
  grind: string;
  /** total brew time, e.g. "2:45" */
  totalTime: string;
  steps: BrewStep[];
};

/* --------------------------- grinder dial presets --------------------------- */

export type DialKind = "clicks" | "number" | "microns";

export type GrinderModel = { name: string; dial: DialKind; placeholder: string };

/** Brand → models. Both levels fall back to free text via "Other…". */
export const GRINDER_BRANDS: { brand: string; models: GrinderModel[] }[] = [
  {
    brand: "Comandante",
    models: [
      { name: "C40 MK4", dial: "clicks", placeholder: "24" },
      { name: "C40 MK3", dial: "clicks", placeholder: "24" },
      { name: "X25", dial: "clicks", placeholder: "24" },
    ],
  },
  {
    brand: "1Zpresso",
    models: [
      { name: "J-Max", dial: "clicks", placeholder: "2.4.0" },
      { name: "JX-Pro", dial: "clicks", placeholder: "3.2.0" },
      { name: "JX", dial: "clicks", placeholder: "3.2.0" },
      { name: "K-Ultra", dial: "clicks", placeholder: "4.5.0" },
      { name: "K-Max", dial: "clicks", placeholder: "4.5.0" },
      { name: "K-Plus", dial: "clicks", placeholder: "4.5.0" },
      { name: "X-Pro", dial: "clicks", placeholder: "20" },
      { name: "Q2", dial: "clicks", placeholder: "12" },
      { name: "ZP6", dial: "clicks", placeholder: "3.0.0" },
    ],
  },
  {
    brand: "Timemore",
    models: [
      { name: "Chestnut C2", dial: "clicks", placeholder: "18" },
      { name: "Chestnut C3", dial: "clicks", placeholder: "18" },
      { name: "Chestnut X", dial: "clicks", placeholder: "12" },
      { name: "Sculptor 064", dial: "number", placeholder: "3.5" },
      { name: "Sculptor 078", dial: "number", placeholder: "3.5" },
    ],
  },
  {
    brand: "Kingrinder",
    models: [
      { name: "K2", dial: "clicks", placeholder: "70" },
      { name: "K4", dial: "clicks", placeholder: "70" },
      { name: "K6", dial: "clicks", placeholder: "70" },
      { name: "P2", dial: "clicks", placeholder: "70" },
    ],
  },
  {
    brand: "DF",
    models: [
      { name: "DF54", dial: "number", placeholder: "6.2" },
      { name: "DF64", dial: "number", placeholder: "6.2" },
      { name: "DF64 Gen 2", dial: "number", placeholder: "6.2" },
      { name: "DF64V", dial: "number", placeholder: "6.2" },
      { name: "DF83", dial: "number", placeholder: "6.2" },
      { name: "DF83V", dial: "number", placeholder: "6.2" },
    ],
  },
  {
    brand: "Option-O",
    models: [
      { name: "Lagom 01", dial: "clicks", placeholder: "12" },
      { name: "Lagom Mini", dial: "number", placeholder: "3.5" },
      { name: "Lagom Casa 65", dial: "number", placeholder: "6.2" },
      { name: "Lagom P64", dial: "number", placeholder: "3.5" },
      { name: "Lagom P100", dial: "number", placeholder: "3.5" },
    ],
  },
  {
    brand: "Niche",
    models: [
      { name: "Zero", dial: "number", placeholder: "20" },
      { name: "Duo", dial: "number", placeholder: "20" },
    ],
  },
  {
    brand: "Fellow",
    models: [
      { name: "Ode Gen 1", dial: "number", placeholder: "4" },
      { name: "Ode Gen 2", dial: "number", placeholder: "4.1" },
      { name: "Opus", dial: "number", placeholder: "6" },
    ],
  },
  {
    brand: "Baratza",
    models: [
      { name: "Encore", dial: "number", placeholder: "15" },
      { name: "Encore ESP", dial: "number", placeholder: "15" },
      { name: "Virtuoso+", dial: "number", placeholder: "15" },
      { name: "Sette 270", dial: "number", placeholder: "10" },
      { name: "Vario+", dial: "number", placeholder: "5A" },
    ],
  },
  {
    brand: "Eureka",
    models: [
      { name: "Mignon Specialita", dial: "number", placeholder: "3.5" },
      { name: "Mignon Silenzio", dial: "number", placeholder: "3.5" },
      { name: "Mignon XL", dial: "number", placeholder: "3.5" },
      { name: "Atom 75", dial: "number", placeholder: "3.5" },
    ],
  },
  {
    brand: "Mazzer",
    models: [
      { name: "Mini", dial: "number", placeholder: "10" },
      { name: "Super Jolly", dial: "number", placeholder: "10" },
      { name: "Philos", dial: "number", placeholder: "10" },
    ],
  },
  {
    brand: "Mahlkönig",
    models: [
      { name: "EK43", dial: "number", placeholder: "6" },
      { name: "EK43 S", dial: "number", placeholder: "6" },
      { name: "E65S", dial: "number", placeholder: "6" },
      { name: "X54", dial: "number", placeholder: "6" },
    ],
  },
  {
    brand: "Weber Workshops",
    models: [
      { name: "EG-1", dial: "number", placeholder: "3.5" },
      { name: "Key", dial: "number", placeholder: "3.5" },
    ],
  },
  {
    brand: "Varia",
    models: [
      { name: "VS3", dial: "clicks", placeholder: "20" },
      { name: "VS6", dial: "number", placeholder: "3.5" },
    ],
  },
  {
    brand: "Wilfa",
    models: [
      { name: "Uniform", dial: "number", placeholder: "15" },
      { name: "Svart", dial: "number", placeholder: "15" },
    ],
  },
  {
    brand: "Hario",
    models: [
      { name: "Skerton Pro", dial: "clicks", placeholder: "8" },
      { name: "Mini Mill Slim", dial: "clicks", placeholder: "8" },
    ],
  },
  {
    brand: "Porlex",
    models: [
      { name: "Mini II", dial: "clicks", placeholder: "8" },
      { name: "Tall II", dial: "clicks", placeholder: "8" },
    ],
  },
  {
    brand: "Generic",
    models: [
      { name: "Micron setting", dial: "microns", placeholder: "800" },
      { name: "Dial number", dial: "number", placeholder: "6.2" },
      { name: "Clicks", dial: "clicks", placeholder: "20" },
    ],
  },
];

export function grinderModels(brand: string): GrinderModel[] {
  return GRINDER_BRANDS.find((b) => b.brand === brand)?.models ?? [];
}

export function grinderModelOf(brew: BrewMethod): GrinderModel | undefined {
  return grinderModels(brew.grinderBrand).find((m) => m.name === brew.grinderModel);
}

/** Unit shown after the dial value, e.g. "24 clicks" or "800 µm". */
export const DIAL_UNIT: Record<DialKind, string> = {
  clicks: "clicks",
  number: "",
  microns: "µm",
};

export function grinderOf(brew: BrewMethod): { name: string; dial: DialKind } {
  const name = [brew.grinderBrand, brew.grinderModel]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return { name, dial: grinderModelOf(brew)?.dial ?? "number" };
}

/** "Comandante C40 · 24 clicks" — empty when nothing is set. */
export function dialLabel(brew: BrewMethod): string {
  const value = (brew.grind ?? "").trim();
  if (!value) return "";
  const { dial } = grinderOf(brew);
  const unit = DIAL_UNIT[dial];
  if (!unit || /[a-z]/i.test(value)) return value;
  return `${value} ${unit}`;
}

export type LabelGroup = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};

/** Chip colours cycled through as groups are created. */
export const GROUP_COLORS = [
  "#8A5A2B",
  "#A4302A",
  "#2E6B4B",
  "#26547C",
  "#6B4E9E",
  "#B07C1E",
  "#1F6F6B",
  "#9B3D6E",
] as const;

export function emptyGroup(name: string, index = 0): LabelGroup {
  return {
    id: uid(),
    name: name.trim(),
    color: GROUP_COLORS[index % GROUP_COLORS.length],
    createdAt: new Date().toISOString(),
  };
}

export type CoffeeLabel = {
  id: string;
  /** "" means ungrouped */
  groupId: string;
  roaster: string;
  coffeeName: string;
  variety: string;
  origin: string;
  process: string;
  altitude: string;
  roastLevel: RoastLevel;
  roastDate: string;
  bestBeforeDays: number;
  tastingNotes: string[];
  netWeight: string;
  brews: BrewMethod[];
  /** "beans" = five bean icons, "scale" = segmented roast bar */
  roastDisplay: "beans" | "scale";
  /** resting window; 0/0 means derive it from the process */
  showRest: boolean;
  restFrom: number;
  restTo: number;
  /** row of tick boxes for tracking single doses used out of the bag */
  showDoseBoxes: boolean;
  doseBoxes: number;

  /** sticker appearance */
  theme: ThemeId;
  size: SizeId;
  /** used only when size === "custom", in millimetres */
  customW: number;
  customH: number;
  layout: LayoutId;
  showQr: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ThemeId = "espresso" | "crimson" | "forest" | "navy" | "mono";
export type SizeId =
  | "100x150"
  | "100x100"
  | "100x70"
  | "90x60"
  | "80x50"
  | "70x40"
  | "60x60"
  | "a6"
  | "custom";
export type LayoutId = "full" | "ribbon" | "compact";

export const MAX_BREWS = 5;
export const DEFAULT_BREWS = 3;
export const MAX_NOTES = 4;

export const ROAST_LEVELS: Record<RoastLevel, { name: string; blurb: string }> = {
  1: { name: "Light", blurb: "Bright, floral, high acidity" },
  2: { name: "Light-Medium", blurb: "Fruit-forward, clean finish" },
  3: { name: "Medium", blurb: "Balanced sweetness and body" },
  4: { name: "Medium-Dark", blurb: "Chocolate, low acidity" },
  5: { name: "Dark", blurb: "Bold, smoky, full body" },
};

/* ------------------------------ flavour wheel ------------------------------ */

export type FlavorFamily = {
  id: string;
  name: string;
  color: string;
  /** notes typed by hand are matched against these to pick up the colour */
  keywords: string[];
};

/** Families and colours follow the SCA flavour wheel groupings. */
export const FLAVOR_FAMILIES: FlavorFamily[] = [
  {
    id: "citrus",
    name: "Citrus",
    color: "#E3B23C",
    keywords: ["citrus", "lemon", "lime", "orange", "grapefruit", "bergamot", "mandarin"],
  },
  {
    id: "floral",
    name: "Floral",
    color: "#D9789E",
    keywords: ["floral", "jasmine", "rose", "lavender", "hibiscus", "chamomile", "blossom"],
  },
  {
    id: "berry",
    name: "Berry",
    color: "#8E4FA8",
    keywords: ["berry", "strawberry", "raspberry", "blueberry", "blackberry", "currant", "cherry"],
  },
  {
    id: "stone-fruit",
    name: "Stone Fruit",
    color: "#E2803C",
    keywords: ["peach", "apricot", "nectarine", "plum", "stone fruit"],
  },
  {
    id: "tropical",
    name: "Tropical",
    color: "#3FA796",
    keywords: ["tropical", "mango", "pineapple", "papaya", "lychee", "passion", "melon"],
  },
  {
    id: "nutty",
    name: "Nutty",
    color: "#B08A5E",
    keywords: ["nut", "almond", "hazelnut", "walnut", "peanut", "pecan"],
  },
  {
    id: "chocolate",
    name: "Chocolate",
    color: "#6B4327",
    keywords: ["chocolate", "cocoa", "cacao", "fudge", "mocha"],
  },
  {
    id: "caramel",
    name: "Caramel / Sweet",
    color: "#C98A3E",
    keywords: ["caramel", "toffee", "honey", "brown sugar", "molasses", "vanilla", "syrup", "sweet"],
  },
  {
    id: "spice",
    name: "Spices",
    color: "#A4432A",
    keywords: ["spice", "cinnamon", "clove", "nutmeg", "cardamom", "pepper", "anise"],
  },
  {
    id: "herbal",
    name: "Herbal / Green",
    color: "#4E8C5A",
    keywords: ["herbal", "green", "tea", "grass", "mint", "sage", "tobacco", "earthy"],
  },
  {
    id: "fermented",
    name: "Winey / Fermented",
    color: "#7B2D4A",
    keywords: ["wine", "winey", "boozy", "rum", "whisky", "bourbon", "ferment", "funky", "raisin"],
  },
];

const NEUTRAL_FLAVOR = "#8b7a68";

/** Colour for a tasting note, matched loosely against the flavour families. */
export function flavorColor(note: string): string {
  const n = (note ?? "").trim().toLowerCase();
  if (!n) return NEUTRAL_FLAVOR;
  for (const f of FLAVOR_FAMILIES) {
    if (f.id === n) return f.color;
    if (f.keywords.some((k) => n.includes(k))) return f.color;
  }
  return NEUTRAL_FLAVOR;
}

/* --------------------------- rest / degas window --------------------------- */

/**
 * Base resting days by roast level. Roast level is the strongest driver: a
 * light roast is denser and holds CO2 far longer than a dark one. Pressure
 * brewing is the second driver — leftover CO2 disrupts an espresso shot long
 * after the same coffee tastes fine through a filter.
 */
const REST_BY_ROAST: Record<
  RoastLevel,
  { filter: [number, number]; espresso: [number, number] }
> = {
  1: { filter: [10, 16], espresso: [18, 28] },
  2: { filter: [8, 14], espresso: [15, 24] },
  3: { filter: [6, 12], espresso: [12, 20] },
  4: { filter: [5, 9], espresso: [9, 16] },
  5: { filter: [3, 7], espresso: [6, 12] },
};

const ESPRESSO_RE = /espresso|moka|lever|piston/i;

/** True when any recipe on the label is a pressure brew. */
export function hasEspresso(label: CoffeeLabel): boolean {
  return label.brews.some((b) => ESPRESSO_RE.test(b.name ?? ""));
}

/**
 * Recommended resting days from roast level × brew method × process, unless
 * the label overrides it. When a label carries both espresso and filter
 * recipes the espresso window wins, since it is the binding constraint.
 */
export function restWindow(label: CoffeeLabel): {
  from: number;
  to: number;
  auto: boolean;
  basis: string;
} {
  if (label.restFrom > 0 && label.restTo > 0) {
    return { from: label.restFrom, to: label.restTo, auto: false, basis: "Custom" };
  }

  const level = (REST_BY_ROAST[label.roastLevel] ?? REST_BY_ROAST[3]);
  const espresso = hasEspresso(label);
  const [baseFrom, baseTo] = espresso ? level.espresso : level.filter;
  const bias = processBias(label.process);

  const from = Math.max(1, baseFrom + bias);
  const to = Math.max(from + 1, baseTo + bias);

  const parts = [
    `${ROAST_LEVELS[label.roastLevel]?.name ?? "Medium"} roast`,
    espresso ? "espresso" : "filter",
  ];
  if (bias !== 0 && label.process.trim()) {
    parts.push(`${label.process.trim()} ${bias > 0 ? "+" : ""}${bias}d`);
  }
  return { from, to, auto: true, basis: parts.join(" · ") };
}

export const METHOD_PRESETS = [
  "Espresso",
  "Filter",
  "V60",
  "Aeropress",
  "French Press",
  "Moka Pot",
  "Chemex",
  "Cold Brew",
  "Kalita Wave",
  "Siphon",
] as const;

/**
 * Processing methods, grouped for the picker. `restBias` shifts the resting
 * window: the more fermentation a coffee has seen, the longer it wants to
 * degas. Washed is the baseline at 0.
 */
export type ProcessOption = { name: string; restBias: number };

export const PROCESS_GROUPS: { group: string; items: ProcessOption[] }[] = [
  {
    group: "Washed",
    items: [
      { name: "Washed", restBias: 0 },
      { name: "Fully Washed", restBias: 0 },
      { name: "Double Washed", restBias: 0 },
      { name: "Semi-Washed", restBias: 0 },
      { name: "Wet Hulled (Giling Basah)", restBias: 0 },
    ],
  },
  {
    group: "Honey / Pulped Natural",
    items: [
      { name: "Honey", restBias: 2 },
      { name: "White Honey", restBias: 1 },
      { name: "Yellow Honey", restBias: 2 },
      { name: "Red Honey", restBias: 2 },
      { name: "Black Honey", restBias: 3 },
      { name: "Pulped Natural", restBias: 2 },
    ],
  },
  {
    group: "Natural",
    items: [
      { name: "Natural", restBias: 3 },
      { name: "Dry Natural", restBias: 3 },
      { name: "Monsooned", restBias: -2 },
    ],
  },
  {
    group: "Fermented / Experimental",
    items: [
      { name: "Anaerobic Natural", restBias: 5 },
      { name: "Anaerobic Washed", restBias: 5 },
      { name: "Carbonic Maceration", restBias: 5 },
      { name: "Lactic Fermentation", restBias: 5 },
      { name: "Yeast Fermentation", restBias: 5 },
      { name: "Co-Fermented", restBias: 5 },
      { name: "Barrel Aged", restBias: 5 },
      { name: "Thermal Shock", restBias: 4 },
      { name: "Infused", restBias: 5 },
    ],
  },
  {
    group: "Decaf",
    items: [
      { name: "Swiss Water Decaf", restBias: -2 },
      { name: "Sugarcane EA Decaf", restBias: -2 },
      { name: "CO₂ Decaf", restBias: -2 },
    ],
  },
];

export const PROCESS_OPTIONS: ProcessOption[] = PROCESS_GROUPS.flatMap((g) => g.items);

/** Fallback keyword matching, so free-typed legacy values still get a bias. */
const PROCESS_KEYWORDS: { match: RegExp; bias: number }[] = [
  { match: /anaerobic|carbonic|macerat|lactic|yeast|co-?ferment|barrel|infus/i, bias: 5 },
  { match: /thermal/i, bias: 4 },
  { match: /natural|dry\s*process/i, bias: 3 },
  { match: /black\s*honey/i, bias: 3 },
  { match: /honey|pulped/i, bias: 2 },
  { match: /decaf|swiss water|sugarcane|monsoon/i, bias: -2 },
  { match: /washed|wet/i, bias: 0 },
];

export function processBias(process: string): number {
  const p = (process ?? "").trim();
  if (!p) return 0;
  const exact = PROCESS_OPTIONS.find((o) => o.name.toLowerCase() === p.toLowerCase());
  if (exact) return exact.restBias;
  // Compound entries like "Barrel Aged, Natural" take the strongest match.
  const hits = PROCESS_KEYWORDS.filter((k) => k.match.test(p)).map((k) => k.bias);
  return hits.length ? Math.max(...hits) : 0;
}

export const THEMES: Record<
  ThemeId,
  { name: string; ink: string; accent: string; paper: string; muted: string; rule: string }
> = {
  espresso: {
    name: "Espresso",
    ink: "#2A1A10",
    accent: "#8A5A2B",
    paper: "#FBF7F0",
    muted: "#7A6656",
    rule: "#D9C9B6",
  },
  crimson: {
    name: "Crimson",
    ink: "#2B1414",
    accent: "#A4302A",
    paper: "#FCF6F4",
    muted: "#7E5F5C",
    rule: "#E0C8C4",
  },
  forest: {
    name: "Forest",
    ink: "#132218",
    accent: "#2E6B4B",
    paper: "#F4F9F5",
    muted: "#5E7669",
    rule: "#C6DBCC",
  },
  navy: {
    name: "Navy",
    ink: "#111E2B",
    accent: "#26547C",
    paper: "#F4F8FC",
    muted: "#5C7085",
    rule: "#C5D6E4",
  },
  mono: {
    name: "Mono",
    ink: "#111111",
    accent: "#111111",
    paper: "#FFFFFF",
    muted: "#666666",
    rule: "#CCCCCC",
  },
};

/** Physical sticker sizes in millimetres. */
export const SIZES: Record<SizeId, { name: string; w: number; h: number; hint: string }> = {
  "100x150": {
    name: "100 × 150 mm",
    w: 100,
    h: 150,
    hint: "4×6in thermal label roll — biggest, most readable print",
  },
  "100x100": { name: "100 × 100 mm", w: 100, h: 100, hint: "Square thermal label roll" },
  "100x70": { name: "100 × 70 mm", w: 100, h: 70, hint: "Bag label — fits all brew steps" },
  "90x60": { name: "90 × 60 mm", w: 90, h: 60, hint: "Standard sticker sheet" },
  "80x50": { name: "80 × 50 mm", w: 80, h: 50, hint: "Thermal label printer" },
  "70x40": { name: "70 × 40 mm", w: 70, h: 40, hint: "Small — use Compact layout" },
  "60x60": { name: "60 × 60 mm", w: 60, h: 60, hint: "Square — use Compact layout" },
  a6: { name: "A6 card (105 × 148 mm)", w: 105, h: 148, hint: "Brew card for the counter" },
  custom: { name: "Custom size…", w: 100, h: 70, hint: "Type the exact width and height" },
};

/** Bounds for a custom size, in millimetres. */
export const MIN_MM = 20;
export const MAX_MM = 300;

export function clampMm(value: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(MAX_MM, Math.max(MIN_MM, n));
}

/**
 * Resolve a label's physical size. Everything that renders or prints a sticker
 * goes through this so a custom size behaves exactly like a preset one.
 */
export function labelSize(label: CoffeeLabel): {
  name: string;
  w: number;
  h: number;
  hint: string;
} {
  if (label.size === "custom") {
    const w = clampMm(label.customW, 100);
    const h = clampMm(label.customH, 70);
    return { name: `${w} × ${h} mm`, w, h, hint: "Custom size" };
  }
  return SIZES[label.size] ?? SIZES["100x70"];
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

export function emptyStep(): BrewStep {
  return { id: uid(), text: "", startAt: "", endAt: "", waterG: "" };
}

export function emptyBrew(name = ""): BrewMethod {
  return {
    id: uid(),
    name,
    waterTempC: "",
    doseG: "",
    yieldG: "",
    grinderBrand: "",
    grinderModel: "",
    grind: "",
    totalTime: "",
    steps: [emptyStep()],
  };
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function emptyLabel(): CoffeeLabel {
  const now = new Date().toISOString();
  return {
    id: uid(),
    groupId: "",
    roaster: "",
    coffeeName: "",
    variety: "",
    origin: "",
    process: "",
    altitude: "",
    roastLevel: 3,
    roastDate: todayISO(),
    bestBeforeDays: 90,
    tastingNotes: [],
    netWeight: "",
    roastDisplay: "scale",
    showRest: true,
    restFrom: 0,
    restTo: 0,
    showDoseBoxes: false,
    doseBoxes: 5,
    brews: [emptyBrew("Espresso"), emptyBrew("V60"), emptyBrew("Aeropress")],
    theme: "espresso",
    size: "100x70",
    customW: 100,
    customH: 70,
    layout: "full",
    showQr: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Fill in anything a stored record is missing so old rows keep working. */
/**
 * Splits a legacy single-field grinder name ("Comandante C40") into brand and
 * model, so labels saved before the two-step picker keep working.
 */
/**
 * Steps used to carry one free-text `at` field. Splits it into the explicit
 * start/end pair: "0:30-1:00" becomes 0:30 → 1:00, while a lone "0:30" becomes
 * the *end*, leaving the start blank so it continues from the previous step —
 * which is what those recipes meant.
 */
function migrateStep(s: Partial<BrewStep> & { at?: string }): BrewStep {
  const base = emptyStep();
  if (s.startAt !== undefined || s.endAt !== undefined) {
    return {
      ...base,
      ...s,
      startAt: s.startAt ?? "",
      endAt: s.endAt ?? "",
    };
  }
  const clock = (v: string) => {
    const n = parseClock(v);
    if (n === null) return "";
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  };
  const parts = (s.at ?? "").trim().split(/\s*[-–—]\s*/);
  const migrated =
    parts.length >= 2
      ? { startAt: clock(parts[0]), endAt: clock(parts[1]) }
      : { startAt: "", endAt: clock(parts[0] ?? "") };
  return { ...base, ...s, ...migrated };
}

/** Brands that were once stored under a different name. */
function remapBrand(brand: string, model: string): string {
  if (brand === "DF / Lagom") return /^lagom/i.test(model) ? "Option-O" : "DF";
  return brand;
}

function splitLegacyGrinder(name: string): { grinderBrand: string; grinderModel: string } {
  const legacy = (name ?? "").trim();
  if (!legacy) return { grinderBrand: "", grinderModel: "" };
  for (const b of GRINDER_BRANDS) {
    if (legacy.toLowerCase().startsWith(b.brand.toLowerCase())) {
      const rest = legacy.slice(b.brand.length).trim();
      const model = b.models.find((m) => m.name.toLowerCase() === rest.toLowerCase());
      return { grinderBrand: b.brand, grinderModel: model ? model.name : rest };
    }
  }
  return { grinderBrand: "", grinderModel: legacy };
}

export function normalizeLabel(raw: Partial<CoffeeLabel> & { id: string }): CoffeeLabel {
  const base = emptyLabel();
  const brews = Array.isArray(raw.brews) && raw.brews.length ? raw.brews : base.brews;
  return {
    ...base,
    ...raw,
    tastingNotes: Array.isArray(raw.tastingNotes) ? raw.tastingNotes : [],
    brews: brews.slice(0, MAX_BREWS).map((b) => {
      const legacy = b as Partial<BrewMethod> & { grinder?: string };
      const grinder =
        legacy.grinderBrand || legacy.grinderModel
          ? {
              grinderBrand: remapBrand(
                legacy.grinderBrand ?? "",
                legacy.grinderModel ?? "",
              ),
              grinderModel: legacy.grinderModel ?? "",
            }
          : splitLegacyGrinder(legacy.grinder ?? "");
      const rawSteps = Array.isArray(b.steps) && b.steps.length ? b.steps : [emptyStep()];
      return {
        ...emptyBrew(),
        ...b,
        ...grinder,
        steps: rawSteps.map(migrateStep),
      };
    }),
  };
}

/* ------------------------------- brew log -------------------------------- */

/** How the cup came out. Each flag votes the grind finer or coarser. */
export type TasteFlag =
  | "sour"
  | "bitter"
  | "weak"
  | "harsh"
  | "fast"
  | "slow"
  | "good";

export const TASTE_FLAGS: {
  id: TasteFlag;
  label: string;
  /** −1 wants finer, +1 wants coarser, 0 is neutral */
  vote: -1 | 0 | 1;
}[] = [
  { id: "sour", label: "Sour / sharp", vote: -1 },
  { id: "weak", label: "Weak / thin", vote: -1 },
  { id: "fast", label: "Ran fast", vote: -1 },
  { id: "good", label: "Just right", vote: 0 },
  { id: "slow", label: "Ran slow", vote: 1 },
  { id: "bitter", label: "Bitter", vote: 1 },
  { id: "harsh", label: "Harsh / drying", vote: 1 },
];

export type BrewEntry = {
  id: string;
  labelId: string;
  /** snapshot, so the entry survives the method being renamed or removed */
  methodName: string;
  brewedAt: string;
  grind: string;
  doseG: string;
  yieldG: string;
  timeText: string;
  /** 0 = unrated, otherwise 1–5 */
  rating: number;
  taste: TasteFlag[];
  note: string;
};

export function emptyEntry(labelId: string, methodName: string): BrewEntry {
  return {
    id: uid(),
    labelId,
    methodName,
    brewedAt: new Date().toISOString(),
    grind: "",
    doseG: "",
    yieldG: "",
    timeText: "",
    rating: 0,
    taste: [],
    note: "",
  };
}

/** Step size for a nudge, in that grinder's own units. */
function dialStep(dial: DialKind): { step: number; unit: string; decimals: number } {
  if (dial === "clicks") return { step: 1, unit: "clicks", decimals: 0 };
  if (dial === "microns") return { step: 25, unit: "µm", decimals: 0 };
  return { step: 0.2, unit: "", decimals: 1 };
}

export type DialAdvice = {
  direction: "finer" | "coarser" | "hold";
  headline: string;
  detail: string;
  /** suggested next dial value, when the last one was a plain number */
  suggested: string | null;
};

/**
 * Turns the taste flags of the most recent brew into a grind adjustment.
 *
 * Votes are summed, so "sour and ran fast" pushes finer twice as hard as sour
 * alone. Assumes a lower dial number means finer, which holds for every
 * grinder in GRINDER_BRANDS.
 */
export function dialInAdvice(
  brew: BrewMethod,
  last: BrewEntry | undefined,
): DialAdvice | null {
  if (!last || last.taste.length === 0) return null;

  const votes = last.taste.reduce((sum, id) => {
    const f = TASTE_FLAGS.find((t) => t.id === id);
    return sum + (f?.vote ?? 0);
  }, 0);

  const { dial } = grinderOf(brew);
  const { step, unit, decimals } = dialStep(dial);

  if (votes === 0) {
    return {
      direction: "hold",
      headline: "Keep the same grind",
      detail: last.taste.includes("good")
        ? "Last brew was on the money."
        : "The notes pull both ways — change one thing at a time.",
      suggested: last.grind || null,
    };
  }

  const finer = votes < 0;
  const magnitude = Math.min(2, Math.abs(votes));
  const delta = step * magnitude;
  const base = parseFloat((last.grind || "").replace(",", "."));
  const suggested = Number.isFinite(base)
    ? (finer ? base - delta : base + delta).toFixed(decimals)
    : null;

  const amount = `${delta.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
  return {
    direction: finer ? "finer" : "coarser",
    headline: `Go ${finer ? "finer" : "coarser"} by about ${amount}`,
    detail: last.grind
      ? `Last brew ran at ${last.grind}${unit ? ` ${unit}` : ""}.`
      : "No grind was recorded last time.",
    suggested,
  };
}

/* -------------------------------- scaling -------------------------------- */

/** Multiplies a numeric field, keeping blanks blank and units intact. */
export function scaleAmount(value: string, factor: number): string {
  const v = (value ?? "").trim();
  if (!v || factor === 1) return v;
  const n = parseFloat(v.replace(",", "."));
  if (!Number.isFinite(n)) return v;
  const scaled = n * factor;
  // keep one decimal only when it actually adds something
  const text = scaled >= 100 ? String(Math.round(scaled)) : scaled.toFixed(1).replace(/\.0$/, "");
  return v.replace(/[\d.,]+/, text);
}

/** A whole recipe at a different size — display only, never saved. */
export function scaleBrew(brew: BrewMethod, factor: number): BrewMethod {
  if (factor === 1) return brew;
  return {
    ...brew,
    doseG: scaleAmount(brew.doseG, factor),
    yieldG: scaleAmount(brew.yieldG, factor),
    steps: brew.steps.map((s) => ({ ...s, waterG: scaleAmount(s.waterG, factor) })),
  };
}

/* ------------------------------ rest status ------------------------------ */

export type RestStatus = "unknown" | "resting" | "peak" | "past";

export const REST_STATUS_META: Record<
  RestStatus,
  { label: string; color: string; short: string }
> = {
  unknown: { label: "No roast date", color: "#8b7a68", short: "—" },
  resting: { label: "Still resting", color: "#B07C1E", short: "Resting" },
  peak: { label: "Drinking now", color: "#2E6B4B", short: "Ready" },
  past: { label: "Past peak", color: "#A4302A", short: "Past peak" },
};

/**
 * Where a bag sits against its own peak window today. Uses the same
 * roast-level × brew-method × process calculation the label prints.
 */
export function restStatus(label: CoffeeLabel): {
  status: RestStatus;
  age: number | null;
  from: number;
  to: number;
  /** days until the window opens, or 0 once it has */
  daysToPeak: number;
} {
  const { from, to } = restWindow(label);
  const age = daysSince(label.roastDate);
  if (age === null || age < 0) {
    return { status: "unknown", age, from, to, daysToPeak: 0 };
  }
  const status: RestStatus = age < from ? "resting" : age <= to ? "peak" : "past";
  return { status, age, from, to, daysToPeak: Math.max(0, from - age) };
}

/* ------------------------------- brew timer ------------------------------- */

/** "1:45" → 105, "28" → 28. Units are stripped before this is called. */
export function parseClock(token: string): number | null {
  const t = token.replace(/[^\d:]/g, "");
  if (!t) return null;
  const mmss = t.match(/^(\d+):(\d{1,2})$/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const plain = t.match(/^\d+$/);
  return plain ? Number(t) : null;
}

export type TimelineStep = {
  id: string;
  text: string;
  waterG: string;
  raw: string;
  /** seconds from the start of the brew; null when no time could be read */
  start: number | null;
  end: number | null;
};

/**
 * Builds a runnable timeline from the free-text timestamps.
 *
 * A range ("0:30-1:00") is read as start–end. A single value ("0:30") is read
 * as the *end* of that step, so it begins where the previous one finished —
 * which is how these labels are actually written: step 1 "0:30" means bloom for
 * the first 30 seconds, and step 2 "0:30-1:00" picks up exactly there.
 */
export function brewTimeline(brew: BrewMethod): {
  steps: TimelineStep[];
  total: number;
} {
  const steps: TimelineStep[] = [];
  let prevEnd = 0;

  for (const s of brew.steps) {
    if (!s.text?.trim()) continue;
    const parsedStart = parseClock(s.startAt ?? "");
    const end = parseClock(s.endAt ?? "");
    // A blank start means "carry on from the previous step".
    const start = parsedStart ?? (end !== null ? prevEnd : null);
    if (end !== null) prevEnd = end;

    steps.push({
      id: s.id,
      text: s.text,
      waterG: s.waterG ?? "",
      raw: stepTimeLabel(s),
      start,
      end,
    });
  }

  const declared = parseClock((brew.totalTime ?? "").split(/\s*[-–—]\s*/).pop() ?? "");
  const lastEnd = steps.reduce((a, s) => Math.max(a, s.end ?? 0), 0);
  return { steps, total: Math.max(declared ?? 0, lastEnd) };
}

export type RibbonBlock = {
  id: string;
  /** share of the total pour, 0–1 — drives the block width */
  share: number;
  /** water added during this step */
  addedG: number;
  /** running total after this step */
  totalG: number;
  at: string;
  text: string;
};

/**
 * Turns the steps into proportional blocks for the pour timeline. Needs
 * cumulative water on at least two steps; returns [] otherwise so the label
 * can fall back to the plain numbered list.
 */
export function ribbonBlocks(brew: BrewMethod): RibbonBlock[] {
  const withWater = brew.steps
    .map((s) => ({ ...s, n: parseFloat(s.waterG) }))
    .filter((s) => Number.isFinite(s.n) && s.n > 0);
  if (withWater.length < 2) return [];

  const total = withWater[withWater.length - 1].n;
  if (!(total > 0)) return [];

  let prev = 0;
  const blocks = withWater.map((s) => {
    const added = Math.max(0, s.n - prev);
    prev = s.n;
    return {
      id: s.id,
      share: added / total,
      addedG: added,
      totalG: s.n,
      at: stepTimeLabel(s),
      text: s.text,
    };
  });
  // A zero-width first block would vanish; give every block a visible minimum.
  const floor = 0.06;
  const raised = blocks.map((b) => ({ ...b, share: Math.max(floor, b.share) }));
  const sum = raised.reduce((a, b) => a + b.share, 0);
  return raised.map((b) => ({ ...b, share: b.share / sum }));
}

export function ratioOf(brew: BrewMethod): string {
  const dose = parseFloat(brew.doseG);
  const out = parseFloat(brew.yieldG);
  if (!dose || !out) return "";
  return `1:${(out / dose).toFixed(1).replace(/\.0$/, "")}`;
}

/**
 * Appends the time unit so it never has to be typed. Anything containing a
 * letter is assumed to already carry its own unit ("28s", "2:15 Min") and is
 * left exactly as entered.
 */
export function formatTime(value: string): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (/[a-z]/i.test(v)) return v;
  return `${v} min.`;
}

/** Same idea as formatTime, for weights. */
export function formatWeight(value: string): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (/[a-z]/i.test(v)) return v;
  return `${v} g.`;
}

/** "18.2→36 g." — the unit is written once, at the end of the pair. */
export function formatDoseYield(dose: string, out: string): string {
  const d = (dose ?? "").trim();
  const y = (out ?? "").trim();
  if (!d && !y) return "";
  const joined = d && y ? `${d}→${y}` : d || y;
  if (/[a-z]/i.test(joined)) return joined;
  return `${joined} g.`;
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * YYYY-MM-DD from a Date's *local* parts. Using toISOString() here would shift
 * the day by the UTC offset — local midnight in UTC+7 is the previous date in UTC.
 */
function localISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** roastDate + n days, as an ISO date. */
export function addDays(iso: string, days: number): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return localISO(d);
}

/**
 * "18–22 Aug 2026", collapsing the month and year when they are shared so the
 * range stays short enough for one line on a sticker.
 */
export function formatDateRange(fromIso: string, toIso: string): string {
  if (!fromIso || !toIso) return "";
  const a = new Date(`${fromIso}T00:00:00`);
  const b = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
  const day = (d: Date) => String(d.getDate()).padStart(2, "0");
  const mon = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" });
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const sameYear = a.getFullYear() === b.getFullYear();
  if (sameMonth) return `${day(a)}–${day(b)} ${mon(b)} ${b.getFullYear()}`;
  if (sameYear) return `${day(a)} ${mon(a)} – ${day(b)} ${mon(b)} ${b.getFullYear()}`;
  return `${day(a)} ${mon(a)} ${a.getFullYear()} – ${day(b)} ${mon(b)} ${b.getFullYear()}`;
}

export function bestBefore(iso: string, days: number): string {
  if (!iso || !days) return "";
  return addDays(iso, days);
}

export function daysSince(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export function labelTitle(label: CoffeeLabel): string {
  return label.coffeeName?.trim() || "Untitled coffee";
}
