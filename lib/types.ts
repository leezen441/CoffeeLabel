export type RoastLevel = 1 | 2 | 3 | 4 | 5;

export type BrewStep = {
  id: string;
  /** e.g. "Bloom 40g, swirl" */
  text: string;
  /** optional cumulative timestamp, e.g. "0:45" */
  at: string;
  /** cumulative water in the brewer at the end of this step, drives the ribbon */
  waterG: string;
};

export type BrewMethod = {
  id: string;
  /** Espresso, V60, Aeropress, ... */
  name: string;
  waterTempC: string;
  doseG: string;
  yieldG: string;
  /** key into GRINDERS, or "" for a free-typed model */
  grinderId: string;
  /** grinder model, e.g. "Comandante C40" */
  grinder: string;
  /** dial setting on that grinder, e.g. "24" or "3.2.0" or "800" */
  grind: string;
  /** total brew time, e.g. "2:45" */
  totalTime: string;
  steps: BrewStep[];
};

/* --------------------------- grinder dial presets --------------------------- */

export type DialKind = "clicks" | "number" | "microns";

export const GRINDERS: Record<
  string,
  { name: string; dial: DialKind; placeholder: string }
> = {
  comandante: { name: "Comandante C40", dial: "clicks", placeholder: "24" },
  "1zpresso-jx": { name: "1Zpresso JX-Pro", dial: "clicks", placeholder: "3.2.0" },
  "1zpresso-k": { name: "1Zpresso K-Ultra", dial: "clicks", placeholder: "4.5.0" },
  "1zpresso-j": { name: "1Zpresso J-Max", dial: "clicks", placeholder: "2.4.0" },
  timemore: { name: "Timemore Chestnut", dial: "clicks", placeholder: "18" },
  kingrinder: { name: "Kingrinder K6", dial: "clicks", placeholder: "70" },
  df64: { name: "DF64 / Lagom", dial: "number", placeholder: "6.2" },
  niche: { name: "Niche Zero", dial: "number", placeholder: "20" },
  fellow: { name: "Fellow Ode Gen 2", dial: "number", placeholder: "4.1" },
  baratza: { name: "Baratza Encore", dial: "number", placeholder: "15" },
  eureka: { name: "Eureka Mignon", dial: "number", placeholder: "3.5" },
  generic: { name: "Generic / Micron", dial: "microns", placeholder: "800" },
};

/** Unit shown after the dial value, e.g. "24 clicks" or "800 µm". */
export const DIAL_UNIT: Record<DialKind, string> = {
  clicks: "clicks",
  number: "",
  microns: "µm",
};

export function grinderOf(brew: BrewMethod): { name: string; dial: DialKind } {
  const preset = GRINDERS[brew.grinderId];
  if (preset) return { name: preset.name, dial: preset.dial };
  return { name: (brew.grinder ?? "").trim(), dial: "number" };
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

const REST_RULES: { match: RegExp; from: number; to: number; label: string }[] = [
  { match: /anaerobic|carbonic|macerat|ferment/i, from: 14, to: 21, label: "Anaerobic" },
  { match: /natural|dry\s*process/i, from: 14, to: 21, label: "Natural" },
  { match: /honey|pulped/i, from: 12, to: 18, label: "Honey" },
  { match: /washed|wet/i, from: 10, to: 14, label: "Washed" },
];

/** Recommended resting days, derived from the process unless overridden. */
export function restWindow(label: CoffeeLabel): {
  from: number;
  to: number;
  auto: boolean;
  basis: string;
} {
  if (label.restFrom > 0 && label.restTo > 0) {
    return { from: label.restFrom, to: label.restTo, auto: false, basis: "Custom" };
  }
  const rule = REST_RULES.find((r) => r.match.test(label.process ?? ""));
  if (rule) return { from: rule.from, to: rule.to, auto: true, basis: rule.label };
  return { from: 10, to: 14, auto: true, basis: "Default" };
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

export const PROCESS_PRESETS = [
  "Washed",
  "Natural",
  "Honey",
  "Anaerobic",
  "Wet Hulled",
  "Carbonic Maceration",
] as const;

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
  return { id: uid(), text: "", at: "", waterG: "" };
}

export function emptyBrew(name = ""): BrewMethod {
  return {
    id: uid(),
    name,
    waterTempC: "",
    doseG: "",
    yieldG: "",
    grinderId: "",
    grinder: "",
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
export function normalizeLabel(raw: Partial<CoffeeLabel> & { id: string }): CoffeeLabel {
  const base = emptyLabel();
  const brews = Array.isArray(raw.brews) && raw.brews.length ? raw.brews : base.brews;
  return {
    ...base,
    ...raw,
    tastingNotes: Array.isArray(raw.tastingNotes) ? raw.tastingNotes : [],
    brews: brews.slice(0, MAX_BREWS).map((b) => ({
      ...emptyBrew(),
      ...b,
      steps: Array.isArray(b.steps) && b.steps.length ? b.steps : [emptyStep()],
    })),
  };
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
      at: s.at,
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
