export type RoastLevel = 1 | 2 | 3 | 4 | 5;

export type BrewStep = {
  id: string;
  /** e.g. "Bloom 40g, swirl" */
  text: string;
  /** optional cumulative timestamp, e.g. "0:45" */
  at: string;
};

export type BrewMethod = {
  id: string;
  /** Espresso, V60, Aeropress, ... */
  name: string;
  waterTempC: string;
  doseG: string;
  yieldG: string;
  /** grinder model, e.g. "Comandante C40" */
  grinder: string;
  /** grind setting on that grinder, e.g. "18 clicks" or "2.5" */
  grind: string;
  /** total brew time, e.g. "2:45" */
  totalTime: string;
  steps: BrewStep[];
};

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
export type LayoutId = "full" | "compact";

export const MAX_BREWS = 5;
export const DEFAULT_BREWS = 3;
export const MAX_NOTES = 4;

export const ROAST_LEVELS: Record<RoastLevel, { name: string; blurb: string }> = {
  1: { name: "Light", blurb: "Bright, floral, high acidity" },
  2: { name: "Medium-Light", blurb: "Fruit-forward, clean finish" },
  3: { name: "Medium", blurb: "Balanced sweetness and body" },
  4: { name: "Medium-Dark", blurb: "Chocolate, low acidity" },
  5: { name: "Dark", blurb: "Bold, smoky, full body" },
};

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

export const GRINDER_PRESETS = [
  "Comandante C40",
  "1Zpresso J-Max",
  "1Zpresso JX-Pro",
  "1Zpresso K-Ultra",
  "Timemore C3",
  "Kingrinder K6",
  "Baratza Encore",
  "Fellow Ode Gen 2",
  "Niche Zero",
  "DF64",
  "Eureka Mignon",
  "Mazzer Mini",
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
  return { id: uid(), text: "", at: "" };
}

export function emptyBrew(name = ""): BrewMethod {
  return {
    id: uid(),
    name,
    waterTempC: "",
    doseG: "",
    yieldG: "",
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

export function ratioOf(brew: BrewMethod): string {
  const dose = parseFloat(brew.doseG);
  const out = parseFloat(brew.yieldG);
  if (!dose || !out) return "";
  return `1:${(out / dose).toFixed(1).replace(/\.0$/, "")}`;
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function bestBefore(iso: string, days: number): string {
  if (!iso || !days) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
