import {
  type BrewMethod,
  type CoffeeLabel,
  emptyBrew,
  emptyLabel,
  emptyStep,
} from "./types";

export type BrewTemplate = {
  waterTempC: string;
  doseG: string;
  yieldG: string;
  totalTime: string;
  steps: { text: string; startAt: string; endAt: string; waterG: string }[];
};

/**
 * Starter recipes so a new label has something the brew timer can actually
 * coach. Times and grams are a starting point — edit after the first cup.
 */
export const BREW_TEMPLATES: Record<string, BrewTemplate> = {
  Espresso: {
    waterTempC: "93",
    doseG: "18",
    yieldG: "36",
    totalTime: "30s",
    steps: [
      { text: "Distribute and tamp", startAt: "", endAt: "", waterG: "" },
      { text: "Pre-infuse", startAt: "0:00", endAt: "0:08", waterG: "" },
      { text: "Full pressure to 36 g", startAt: "0:08", endAt: "0:30", waterG: "36" },
    ],
  },
  V60: {
    waterTempC: "94",
    doseG: "15",
    yieldG: "250",
    totalTime: "2:45",
    steps: [
      { text: "Bloom, swirl", startAt: "0:00", endAt: "0:45", waterG: "45" },
      { text: "First pour", startAt: "0:45", endAt: "1:20", waterG: "150" },
      { text: "Second pour", startAt: "1:20", endAt: "2:00", waterG: "250" },
      { text: "Drawdown", startAt: "2:00", endAt: "2:45", waterG: "250" },
    ],
  },
  Filter: {
    waterTempC: "94",
    doseG: "20",
    yieldG: "320",
    totalTime: "3:00",
    steps: [
      { text: "Bloom", startAt: "0:00", endAt: "0:45", waterG: "60" },
      { text: "Fill", startAt: "0:45", endAt: "2:00", waterG: "320" },
      { text: "Drawdown", startAt: "2:00", endAt: "3:00", waterG: "320" },
    ],
  },
  Aeropress: {
    waterTempC: "85",
    doseG: "15",
    yieldG: "220",
    totalTime: "2:15",
    steps: [
      { text: "Add water, stir", startAt: "0:00", endAt: "0:20", waterG: "220" },
      { text: "Steep", startAt: "0:20", endAt: "1:30", waterG: "220" },
      { text: "Cap and flip", startAt: "1:30", endAt: "1:45", waterG: "220" },
      { text: "Press", startAt: "1:45", endAt: "2:15", waterG: "220" },
    ],
  },
  "French Press": {
    waterTempC: "94",
    doseG: "22",
    yieldG: "350",
    totalTime: "4:30",
    steps: [
      { text: "Add water, stir", startAt: "0:00", endAt: "0:30", waterG: "350" },
      { text: "Steep", startAt: "0:30", endAt: "4:00", waterG: "350" },
      { text: "Plunge", startAt: "4:00", endAt: "4:30", waterG: "350" },
    ],
  },
  "Moka Pot": {
    waterTempC: "100",
    doseG: "18",
    yieldG: "90",
    totalTime: "2:15",
    steps: [
      { text: "Heat until brew starts", startAt: "0:00", endAt: "0:45", waterG: "" },
      { text: "Brew", startAt: "0:45", endAt: "2:00", waterG: "90" },
      { text: "Stop at first sputter", startAt: "2:00", endAt: "2:15", waterG: "90" },
    ],
  },
  Chemex: {
    waterTempC: "94",
    doseG: "30",
    yieldG: "500",
    totalTime: "4:00",
    steps: [
      { text: "Bloom", startAt: "0:00", endAt: "0:45", waterG: "60" },
      { text: "First pour", startAt: "0:45", endAt: "1:45", waterG: "250" },
      { text: "Second pour", startAt: "1:45", endAt: "2:45", waterG: "400" },
      { text: "Third pour", startAt: "2:45", endAt: "3:30", waterG: "500" },
      { text: "Drawdown", startAt: "3:30", endAt: "4:00", waterG: "500" },
    ],
  },
  "Cold Brew": {
    waterTempC: "20",
    doseG: "80",
    yieldG: "640",
    totalTime: "",
    steps: [
      { text: "Combine coffee and cold water", startAt: "", endAt: "", waterG: "640" },
      { text: "Steep 12 hours, then filter", startAt: "", endAt: "", waterG: "640" },
    ],
  },
  "Kalita Wave": {
    waterTempC: "94",
    doseG: "20",
    yieldG: "300",
    totalTime: "3:00",
    steps: [
      { text: "Bloom", startAt: "0:00", endAt: "0:45", waterG: "60" },
      { text: "Pulse 1", startAt: "0:45", endAt: "1:20", waterG: "150" },
      { text: "Pulse 2", startAt: "1:20", endAt: "2:00", waterG: "230" },
      { text: "Pulse 3", startAt: "2:00", endAt: "2:30", waterG: "300" },
      { text: "Drawdown", startAt: "2:30", endAt: "3:00", waterG: "300" },
    ],
  },
  Siphon: {
    waterTempC: "92",
    doseG: "20",
    yieldG: "300",
    totalTime: "1:45",
    steps: [
      { text: "Attach and stir", startAt: "0:00", endAt: "0:45", waterG: "300" },
      { text: "Steep", startAt: "0:45", endAt: "1:15", waterG: "300" },
      { text: "Draw down", startAt: "1:15", endAt: "1:45", waterG: "300" },
    ],
  },
};

export function templateFor(name: string): BrewTemplate | undefined {
  return BREW_TEMPLATES[name.trim()];
}

/** True when nothing that would be overwritten by a template has been typed. */
export function isBrewBlank(brew: BrewMethod): boolean {
  if (
    brew.waterTempC.trim() ||
    brew.doseG.trim() ||
    brew.yieldG.trim() ||
    brew.totalTime.trim()
  ) {
    return false;
  }
  return brew.steps.every(
    (s) => !s.text.trim() && !s.startAt.trim() && !s.endAt.trim() && !s.waterG.trim(),
  );
}

export function brewFromTemplate(
  name: string,
  keep?: Partial<BrewMethod>,
): BrewMethod {
  const t = templateFor(name);
  const base = emptyBrew(name);
  if (!t) {
    return { ...base, ...keep, id: keep?.id ?? base.id, name };
  }
  return {
    ...base,
    id: keep?.id ?? base.id,
    name,
    waterTempC: t.waterTempC,
    doseG: t.doseG,
    yieldG: t.yieldG,
    totalTime: t.totalTime,
    grinderBrand: keep?.grinderBrand ?? "",
    grinderModel: keep?.grinderModel ?? "",
    grind: keep?.grind ?? "",
    steps: t.steps.map((s) => ({ ...emptyStep(), ...s })),
  };
}

/** New label with Espresso, V60 and Aeropress already filled in. */
export function newLabel(): CoffeeLabel {
  const label = emptyLabel();
  return {
    ...label,
    brews: [
      brewFromTemplate("Espresso"),
      brewFromTemplate("V60"),
      brewFromTemplate("Aeropress"),
    ],
  };
}
