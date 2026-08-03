import { type CoffeeLabel, emptyLabel, todayISO, uid } from "./types";

/** A filled-in example so a fresh install shows what a finished label looks like. */
export function sampleLabel(): CoffeeLabel {
  const base = emptyLabel();
  return {
    ...base,
    id: uid(),
    roaster: "Roots Coffee Roasters",
    coffeeName: "Ethiopia Guji Uraga",
    variety: "Heirloom",
    origin: "Guji, Ethiopia",
    process: "Washed",
    altitude: "2,050 masl",
    roastLevel: 2,
    roastDate: todayISO(),
    bestBeforeDays: 90,
    tastingNotes: ["Jasmine", "Peach", "Black Tea"],
    netWeight: "250 g",
    theme: "espresso",
    size: "100x70",
    layout: "full",
    showQr: true,
    brews: [
      {
        id: uid(),
        name: "Espresso",
        waterTempC: "93",
        doseG: "18",
        yieldG: "38",
        grind: "Fine",
        totalTime: "28s",
        steps: [
          { id: uid(), text: "Distribute and tamp level", at: "" },
          { id: uid(), text: "Pre-infuse at 3 bar", at: "0:05" },
          { id: uid(), text: "Full pressure to 38 g out", at: "0:28" },
        ],
      },
      {
        id: uid(),
        name: "V60",
        waterTempC: "94",
        doseG: "15",
        yieldG: "250",
        grind: "Medium",
        totalTime: "2:45",
        steps: [
          { id: uid(), text: "Bloom 45 g, swirl", at: "0:00" },
          { id: uid(), text: "Pour to 150 g", at: "0:45" },
          { id: uid(), text: "Pour to 250 g", at: "1:20" },
          { id: uid(), text: "Drawdown complete", at: "2:45" },
        ],
      },
      {
        id: uid(),
        name: "Aeropress",
        waterTempC: "88",
        doseG: "14",
        yieldG: "220",
        grind: "Medium-fine",
        totalTime: "1:45",
        steps: [
          { id: uid(), text: "Inverted, add all water", at: "0:00" },
          { id: uid(), text: "Stir 3x, cap and steep", at: "0:15" },
          { id: uid(), text: "Flip and press slowly", at: "1:15" },
        ],
      },
    ],
  };
}
