import {
  type BrewEntry,
  type BrewMethod,
  type DialKind,
  type TasteFlag,
  grinderOf,
  parseClock,
} from "./types";

/**
 * Dial-in advice grounded in how extraction actually behaves, rather than
 * summing thumbs-up and thumbs-down.
 *
 * Three ideas do most of the work here:
 *
 *  1. Strength and extraction are different axes. "Watery" is usually a ratio
 *     problem; "sour" is an extraction problem. Treating both as one number is
 *     what made the old version give up and say "keep the same grind".
 *
 *  2. Under- and over-extraction tasted *at the same time* is not a
 *     contradiction — it is the signature of channelling. Water finds an easy
 *     path, so part of the bed is stripped while the rest is barely touched.
 *     Grinding finer without fixing the bed usually makes it worse.
 *
 *  3. Time is a symptom, not a lever. You change grind, dose and prep; the time
 *     follows. So flow is read as evidence, never prescribed directly.
 */

export type BrewFamily = "espresso" | "pourover" | "immersion";

export function methodFamily(name: string): BrewFamily {
  if (/espresso|moka|lever|piston|flair|robot/i.test(name)) return "espresso";
  if (/aeropress|french|press|clever|immersion|steep|cupping|siphon/i.test(name)) {
    return "immersion";
  }
  return "pourover";
}

/** How each flag reads. Ids stay stable so older log entries keep working. */
const FLAG_MEANING: Record<
  TasteFlag,
  { under: number; over: number; strength: number; uneven: number }
> = {
  sour: { under: 2, over: 0, strength: 0, uneven: 0 },
  salty: { under: 2, over: 0, strength: 0, uneven: 0 },
  fast: { under: 1, over: 0, strength: 0, uneven: 0 },
  weak: { under: 0, over: 0, strength: 2, uneven: 0 },
  bitter: { under: 0, over: 2, strength: 0, uneven: 0 },
  ashy: { under: 0, over: 2, strength: 0, uneven: 0 },
  hollow: { under: 0, over: 1, strength: 0, uneven: 1 },
  // Astringency is the classic channelling tell — it leans over-extracted but
  // very often appears when the bed is simply uneven.
  harsh: { under: 0, over: 1, strength: 0, uneven: 1 },
  slow: { under: 0, over: 1, strength: 0, uneven: 0 },
  uneven: { under: 0, over: 0, strength: 0, uneven: 3 },
  good: { under: 0, over: 0, strength: 0, uneven: 0 },
};

/** Typical windows, used only to comment on what was logged. */
const TARGETS: Record<
  BrewFamily,
  { time: [number, number]; ratio: [number, number]; timeLabel: string }
> = {
  espresso: { time: [22, 36], ratio: [1.5, 2.6], timeLabel: "25–32 s" },
  pourover: { time: [150, 240], ratio: [14, 18], timeLabel: "2:30–3:30" },
  immersion: { time: [0, 0], ratio: [13, 18], timeLabel: "" },
};

function dialStep(dial: DialKind): { step: number; unit: string; decimals: number } {
  if (dial === "clicks") return { step: 1, unit: "clicks", decimals: 0 };
  if (dial === "microns") return { step: 25, unit: "µm", decimals: 0 };
  return { step: 0.2, unit: "", decimals: 1 };
}

export type AdviceAction = { text: string; why?: string };

export type Advice = {
  headline: string;
  because: string;
  actions: AdviceAction[];
  suggestedGrind: string | null;
  grindDirection: "finer" | "coarser" | "hold";
  /** observations about the numbers logged, independent of taste */
  numbers: string[];
};

export function dialIn(brew: BrewMethod, last: BrewEntry | undefined): Advice | null {
  if (!last || last.taste.length === 0) return null;

  const family = methodFamily(brew.name || "");
  const { dial } = grinderOf(brew);
  const { step, unit, decimals } = dialStep(dial);

  let under = 0;
  let over = 0;
  let strength = 0;
  let uneven = 0;
  for (const id of last.taste) {
    const m = FLAG_MEANING[id];
    if (!m) continue;
    under += m.under;
    over += m.over;
    strength += m.strength;
    uneven += m.uneven;
  }

  /* ---------- what the numbers say, regardless of taste ---------- */
  const numbers: string[] = [];
  const dose = parseFloat(last.doseG || brew.doseG);
  const yieldG = parseFloat(last.yieldG || brew.yieldG);
  const seconds = parseClock((last.timeText || brew.totalTime || "").split(/[-–]/)[0]);
  const ratio = Number.isFinite(dose) && Number.isFinite(yieldG) && dose > 0
    ? yieldG / dose
    : null;
  const t = TARGETS[family];

  if (ratio !== null) {
    if (ratio < t.ratio[0]) {
      numbers.push(
        `1:${ratio.toFixed(1)} is tight for ${family} — expect heavy body and less clarity.`,
      );
    } else if (ratio > t.ratio[1]) {
      numbers.push(
        `1:${ratio.toFixed(1)} is a long ratio for ${family} — thin body comes from here, not from the grind.`,
      );
    }
  }
  if (seconds !== null && family !== "immersion") {
    if (seconds < t.time[0]) {
      numbers.push(`${last.timeText || "That"} is fast — normal is around ${t.timeLabel}.`);
    } else if (seconds > t.time[1]) {
      numbers.push(`${last.timeText || "That"} is slow — normal is around ${t.timeLabel}.`);
    }
  }

  /* ---------- prep advice, by method ---------- */
  const prep: AdviceAction[] =
    family === "espresso"
      ? [
          {
            text: "Stir the dry grounds with a needle (WDT), then level and tamp flat",
            why: "clumps and a sloped puck are what create the easy path",
          },
          {
            text: "Check the dose actually fits the basket",
            why: "too little coffee leaves headspace the water pushes through",
          },
        ]
      : family === "pourover"
        ? [
            {
              text: "Flatten the bed after the bloom and pour gently into the centre",
              why: "pouring hard or down the wall drives fines into the paper and opens channels",
            },
            {
              text: "Give the bloom a proper swirl so every ground is wet",
              why: "dry pockets never extract, and the rest over-extracts to compensate",
            },
          ]
        : [
            {
              text: "Stir once at the start so nothing floats dry",
              why: "immersion only works if all the grounds are actually wetted",
            },
          ];

  /* ---------- 1. uneven extraction wins over everything ---------- */
  const contradictory = under > 0 && over > 0;
  if (uneven >= 2 || contradictory) {
    const actions = [...prep];
    let direction: Advice["grindDirection"] = "hold";
    let suggested: string | null = last.grind || null;

    // Flow is the honest read on bed resistance — taste alone can't tell you
    // whether the bed was too open, because channelling muddles both ends.
    const ranFast = last.taste.includes("fast");
    const ranSlow = last.taste.includes("slow");
    if (ranFast || ranSlow) {
      direction = ranFast ? "finer" : "coarser";
      const base = parseFloat((last.grind || "").replace(",", "."));
      suggested = Number.isFinite(base)
        ? (ranFast ? base - step : base + step).toFixed(decimals)
        : null;
      actions.push({
        text: `Then go one step ${direction}${suggested ? ` — about ${suggested}${unit ? ` ${unit}` : ""}` : ""}`,
        why: `it ran ${ranFast ? "fast" : "slow"}, so the bed is also too ${ranFast ? "open" : "tight"} — but fix the prep first, or you won't know which change did what`,
      });
    } else {
      actions.push({
        text: "Leave the grind where it is this round",
        why: "fix the bed first — changing two things at once tells you nothing",
      });
    }

    return {
      headline: "Even out the extraction first",
      because:
        "Tasting weak or sour *and* bitter or drying in the same cup is not a contradiction — it is channelling. Water is racing through part of the bed and barely touching the rest, so you get both faults at once.",
      actions,
      suggestedGrind: suggested,
      grindDirection: direction,
      numbers,
    };
  }

  /* ---------- 2. strength only ---------- */
  if (strength > 0 && under === 0 && over === 0) {
    return {
      headline: "Tighten the ratio, not the grind",
      because:
        "Watery with no sourness or bitterness means the extraction is fine — there is simply too much water for the coffee. Strength and extraction are separate dials.",
      actions: [
        {
          text: ratio !== null
            ? `Pull the ratio in from 1:${ratio.toFixed(1)} toward 1:${(t.ratio[0] + 0.5).toFixed(1)}`
            : "Use more coffee, or less water",
          why: "same extraction, more dissolved solids in the cup",
        },
        { text: "Leave the grind alone", why: "it is not the cause here" },
      ],
      suggestedGrind: last.grind || null,
      grindDirection: "hold",
      numbers,
    };
  }

  /* ---------- 3. clean under / over extraction ---------- */
  if (under > 0 || over > 0) {
    const finer = under > over;
    const magnitude = Math.min(2, Math.max(1, Math.round(Math.abs(under - over) / 2)));
    const delta = step * magnitude;
    const base = parseFloat((last.grind || "").replace(",", "."));
    const suggested = Number.isFinite(base)
      ? (finer ? base - delta : base + delta).toFixed(decimals)
      : null;
    const amount = `${delta.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;

    const actions: AdviceAction[] = [
      {
        text: `Grind ${finer ? "finer" : "coarser"} by about ${amount}${suggested ? ` — try ${suggested}${unit ? ` ${unit}` : ""}` : ""}`,
        why: finer
          ? "more surface area and slower flow, so more is dissolved"
          : "less surface area and faster flow, so less is dissolved",
      },
    ];
    if (finer) {
      actions.push({
        text: "If it is already fine, raise the water by 2–3 °C instead",
        why: "temperature raises extraction without choking the flow",
      });
    } else {
      actions.push({
        text: "Or pour more gently and skip the late stir",
        why: "agitation raises extraction as surely as a finer grind",
      });
    }
    actions.push({
      text: "Change one thing, then taste again",
      why: "two changes at once and you cannot tell which one worked",
    });

    return {
      headline: `Go ${finer ? "finer" : "coarser"} by about ${amount}`,
      because: finer
        ? "Sour, salty and a fast run all point the same way: the water left before it took enough out. That is under-extraction."
        : "Bitter, ashy and a slow run point the other way: the water stayed too long and pulled out the harsh end. That is over-extraction.",
      actions,
      suggestedGrind: suggested,
      grindDirection: finer ? "finer" : "coarser",
      numbers,
    };
  }

  /* ---------- 4. it was good ---------- */
  return {
    headline: "Keep this one",
    because:
      "Nothing is pulling the cup off balance, so this is your reference point for the bag.",
    actions: [
      {
        text: "Log the same numbers next time and compare",
        why: "the coffee keeps ageing, so the same grind will drift over a week or two",
      },
      {
        text: "As the bag gets older, expect to grind slightly finer",
        why: "beans lose CO2 and extract more slowly as they degas",
      },
    ],
    suggestedGrind: last.grind || null,
    grindDirection: "hold",
    numbers,
  };
}
