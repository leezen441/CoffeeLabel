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
    netWeight: "250",
    roastDisplay: "scale",
    showRest: true,
    showDoseBoxes: true,
    doseBoxes: 5,
    theme: "espresso",
    size: "100x70",
    layout: "full",
    showQr: true,
    brews: [
      {
        id: uid(),
        name: "V60",
        waterTempC: "94",
        doseG: "15",
        yieldG: "250",
        grinderBrand: "Comandante",
        grinderModel: "C40 MK4",
        grind: "24",
        totalTime: "2:45",
        steps: [
          { id: uid(), text: "Bloom, swirl", at: "0:00", waterG: "45" },
          { id: uid(), text: "First pour", at: "0:45", waterG: "150" },
          { id: uid(), text: "Second pour", at: "1:20", waterG: "250" },
          { id: uid(), text: "Drawdown complete", at: "2:45", waterG: "250" },
        ],
      },
      {
        id: uid(),
        name: "Espresso",
        waterTempC: "93",
        doseG: "18",
        yieldG: "38",
        grinderBrand: "DF",
        grinderModel: "DF64",
        grind: "1.8",
        totalTime: "28s",
        steps: [
          { id: uid(), text: "Distribute and tamp level", at: "", waterG: "" },
          { id: uid(), text: "Pre-infuse at 3 bar", at: "0:05", waterG: "" },
          { id: uid(), text: "Full pressure to 38 g out", at: "0:28", waterG: "" },
        ],
      },
    ],
  };
}
