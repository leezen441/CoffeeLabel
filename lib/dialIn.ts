import type { Lang } from "./i18n";
import {
  type BrewEntry,
  type BrewMethod,
  type DialKind,
  type TasteFlag,
  grinderOf,
  parseClock,
  scaleAmount,
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

/** Water temperature nudged by a few degrees, capped at boiling. */
function tempPlus(value: string, degrees: number): string | null {
  const n = parseFloat((value ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return String(Math.min(100, Math.round(n + degrees)));
}

function dialStep(dial: DialKind): { step: number; unit: string; decimals: number } {
  if (dial === "clicks") return { step: 1, unit: "clicks", decimals: 0 };
  if (dial === "microns") return { step: 25, unit: "µm", decimals: 0 };
  return { step: 0.2, unit: "", decimals: 1 };
}

export type AdviceAction = { text: string; why?: string };

/** A single value the advice would change, ready to be written into the recipe. */
export type AdviceChange = {
  field: "grind" | "waterTempC" | "doseG" | "yieldG";
  label: string;
  from: string;
  to: string;
  why?: string;
  /** an alternative rather than the main move — off until the user picks it */
  optional?: boolean;
};

export type Advice = {
  headline: string;
  because: string;
  actions: AdviceAction[];
  suggestedGrind: string | null;
  grindDirection: "finer" | "coarser" | "hold";
  /** observations about the numbers logged, independent of taste */
  numbers: string[];
  /** the concrete edits behind the advice — empty when nothing should change */
  changes: AdviceChange[];
};

function change(
  field: AdviceChange["field"],
  label: string,
  from: string,
  to: string | null,
  why?: string,
  optional = false,
): AdviceChange | null {
  const a = (from ?? "").trim();
  const b = (to ?? "").trim();
  if (!b || a === b) return null;
  return { field, label, from: a, to: b, why, optional };
}

/**
 * Rescales only the weights written into a step's text ("Bloom 45 g") and
 * leaves every other number alone — "for 30 seconds" is not a weight, and
 * silently scaling it would corrupt the recipe.
 */
function scaleGramsInText(text: string, factor: number): string {
  return text.replace(
    /(\d+(?:[.,]\d+)?)(\s*)(g\.|g\b|กรัม)/gi,
    (_m, num: string, gap: string, unit: string) =>
      `${scaleAmount(num, factor)}${gap}${unit}`,
  );
}

/**
 * Writes the picked changes into a copy of the recipe. When the water total
 * moves, every pour moves with it — otherwise the steps would still add up to
 * the old yield and the new ratio would never actually happen in the cup.
 */
export function applyChanges(brew: BrewMethod, changes: AdviceChange[]): BrewMethod {
  if (changes.length === 0) return brew;
  const next: BrewMethod = { ...brew, steps: brew.steps.map((s) => ({ ...s })) };
  for (const c of changes) {
    (next as unknown as Record<string, string>)[c.field] = c.to;
  }
  const before = parseFloat(brew.yieldG);
  const after = parseFloat(next.yieldG);
  if (Number.isFinite(before) && Number.isFinite(after) && before > 0 && after !== before) {
    const factor = after / before;
    next.steps = next.steps.map((s) => ({
      ...s,
      waterG: scaleAmount(s.waterG, factor),
      text: scaleGramsInText(s.text, factor),
    }));
  }
  return next;
}

/** Picks the right language for a phrase pair. */
const L = (lang: Lang, en: string, th: string) => (lang === "th" ? th : en);

export function dialIn(
  brew: BrewMethod,
  last: BrewEntry | undefined,
  lang: Lang = "en",
): Advice | null {
  if (!last || last.taste.length === 0) return null;

  const family = methodFamily(brew.name || "");
  const { dial } = grinderOf(brew);
  const { step, unit, decimals } = dialStep(dial);
  const FIELD = {
    grind: L(lang, "Grind", "เบอร์บด"),
    temp: L(lang, "Water °C", "อุณหภูมิน้ำ °C"),
    dose: L(lang, "Dose", "ผงกาแฟ"),
    yield: L(lang, "Yield", "น้ำหนักที่ได้"),
  };

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
        L(
          lang,
          `1:${ratio.toFixed(1)} is tight for ${family} — expect heavy body and less clarity.`,
          `1:${ratio.toFixed(1)} ถือว่าเข้มสำหรับ ${family} — บอดี้จะหนักและความใสของรสจะลดลง`,
        ),
      );
    } else if (ratio > t.ratio[1]) {
      numbers.push(
        L(
          lang,
          `1:${ratio.toFixed(1)} is a long ratio for ${family} — thin body comes from here, not from the grind.`,
          `1:${ratio.toFixed(1)} ถือว่าเจือจางสำหรับ ${family} — รสบางมาจากตรงนี้ ไม่ใช่จากเบอร์บด`,
        ),
      );
    }
  }
  if (seconds !== null && family !== "immersion") {
    const shown = last.timeText || (lang === "th" ? "เวลานี้" : "That");
    if (seconds < t.time[0]) {
      numbers.push(
        L(
          lang,
          `${shown} is fast — normal is around ${t.timeLabel}.`,
          `${shown} ถือว่าเร็ว — ปกติอยู่ราว ${t.timeLabel}`,
        ),
      );
    } else if (seconds > t.time[1]) {
      numbers.push(
        L(
          lang,
          `${shown} is slow — normal is around ${t.timeLabel}.`,
          `${shown} ถือว่าช้า — ปกติอยู่ราว ${t.timeLabel}`,
        ),
      );
    }
  }

  /* ---------- prep advice, by method ---------- */
  const prep: AdviceAction[] =
    family === "espresso"
      ? [
          {
            text: L(
              lang,
              "Stir the dry grounds with a needle (WDT), then level and tamp flat",
              "เขี่ยผงแห้งด้วยเข็ม (WDT) แล้วเกลี่ยให้เรียบก่อนแทมป์ให้ได้ระนาบ",
            ),
            why: L(
              lang,
              "clumps and a sloped puck are what create the easy path",
              "ผงจับตัวเป็นก้อนและหน้าเค้กที่เอียง คือต้นเหตุที่ทำให้น้ำหาทางลัดได้",
            ),
          },
          {
            text: L(
              lang,
              "Check the dose actually fits the basket",
              "เช็คว่าปริมาณผงพอดีกับตะกร้า",
            ),
            why: L(
              lang,
              "too little coffee leaves headspace the water pushes through",
              "ผงน้อยไปจะเหลือช่องว่างด้านบนให้น้ำดันทะลุ",
            ),
          },
        ]
      : family === "pourover"
        ? [
            {
              text: L(
                lang,
                "Flatten the bed after the bloom and pour gently into the centre",
                "เกลี่ยผิวหน้าให้เรียบหลัง bloom แล้วเทเบาๆ ลงตรงกลาง",
              ),
              why: L(
                lang,
                "pouring hard or down the wall drives fines into the paper and opens channels",
                "เทแรงหรือเทชิดขอบจะดันผงละเอียดไปอุดกระดาษ และเปิดทางให้น้ำลัด",
              ),
            },
            {
              text: L(
                lang,
                "Give the bloom a proper swirl so every ground is wet",
                "สวิร์ลตอน bloom ให้ผงเปียกทั่วถึงจริงๆ",
              ),
              why: L(
                lang,
                "dry pockets never extract, and the rest over-extracts to compensate",
                "จุดที่ยังแห้งจะไม่ถูกสกัดเลย ส่วนที่เหลือเลยถูกสกัดเกินไปชดเชย",
              ),
            },
          ]
        : [
            {
              text: L(
                lang,
                "Stir once at the start so nothing floats dry",
                "คนหนึ่งครั้งตอนเริ่ม อย่าให้มีผงลอยแห้ง",
              ),
              why: L(
                lang,
                "immersion only works if all the grounds are actually wetted",
                "การแช่จะได้ผลก็ต่อเมื่อผงทุกส่วนเปียกน้ำจริง",
              ),
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
      const amount = suggested ? `${suggested}${unit ? ` ${unit}` : ""}` : "";
      actions.push({
        text: L(
          lang,
          `Then go one step ${direction}${amount ? ` — about ${amount}` : ""}`,
          `จากนั้นค่อยปรับ${ranFast ? "ละเอียด" : "หยาบ"}ขึ้น 1 ขั้น${amount ? ` — ราว ${amount}` : ""}`,
        ),
        why: L(
          lang,
          `it ran ${ranFast ? "fast" : "slow"}, so the bed is also too ${ranFast ? "open" : "tight"} — but fix the prep first, or you won't know which change did what`,
          `ไหล${ranFast ? "เร็ว" : "ช้า"} แปลว่าชั้นกาแฟ${ranFast ? "โปร่ง" : "แน่น"}ไปด้วย — แต่แก้การเตรียมก่อน ไม่งั้นจะไม่รู้ว่าอะไรได้ผล`,
        ),
      });
    } else {
      actions.push({
        text: L(
          lang,
          "Leave the grind where it is this round",
          "รอบนี้อย่าเพิ่งแตะเบอร์บด",
        ),
        why: L(
          lang,
          "fix the bed first — changing two things at once tells you nothing",
          "แก้ชั้นกาแฟก่อน — เปลี่ยนสองอย่างพร้อมกันจะสรุปอะไรไม่ได้เลย",
        ),
      });
    }

    return {
      headline: L(lang, "Even out the extraction first", "แก้ให้สกัดสม่ำเสมอก่อน"),
      because: L(
        lang,
        "Tasting weak or sour *and* bitter or drying in the same cup is not a contradiction — it is channelling. Water is racing through part of the bed and barely touching the rest, so you get both faults at once.",
        "รสอ่อนหรือเปรี้ยว พร้อมกับ ขมหรือฝาด ในแก้วเดียวกัน ไม่ใช่เรื่องขัดแย้งกัน — มันคือ channelling น้ำวิ่งลัดผ่านผงบางส่วนจนสกัดเกิน ขณะที่ส่วนที่เหลือแทบไม่โดนน้ำ จึงได้ข้อบกพร่องทั้งสองแบบพร้อมกัน",
      ),
      actions,
      suggestedGrind: suggested,
      grindDirection: direction,
      numbers,
      // Prep is the fix here; the grind only moves when the flow proved it should.
      changes:
        direction === "hold"
          ? []
          : [
              change(
                "grind",
                FIELD.grind,
                brew.grind,
                suggested,
                L(
                  lang,
                  `it ran ${ranFast ? "fast" : "slow"} — one step ${direction}`,
                  `ไหล${ranFast ? "เร็ว" : "ช้า"} — ขยับ 1 ขั้น`,
                ),
              ),
            ].filter((c): c is AdviceChange => c !== null),
    };
  }

  /* ---------- 2. strength only ---------- */
  if (strength > 0 && under === 0 && over === 0) {
    // Cut the water, keep the coffee: same extraction, more of it per sip.
    const targetRatio = t.ratio[0] + 0.5;
    const newYield =
      ratio !== null && ratio > targetRatio && Number.isFinite(dose)
        ? String(Math.round(dose * targetRatio))
        : null;
    return {
      headline: L(lang, "Tighten the ratio, not the grind", "ปรับอัตราส่วน ไม่ใช่เบอร์บด"),
      because: L(
        lang,
        "Watery with no sourness or bitterness means the extraction is fine — there is simply too much water for the coffee. Strength and extraction are separate dials.",
        "จืดโดยไม่เปรี้ยวไม่ขม แปลว่าการสกัดปกติดี แค่น้ำมากเกินไปเมื่อเทียบกับผง — ความเข้มกับการสกัดเป็นคนละเรื่องกัน",
      ),
      actions: [
        {
          text:
            ratio !== null
              ? L(
                  lang,
                  `Pull the ratio in from 1:${ratio.toFixed(1)} toward 1:${(t.ratio[0] + 0.5).toFixed(1)}`,
                  `ลดอัตราส่วนจาก 1:${ratio.toFixed(1)} มาทาง 1:${(t.ratio[0] + 0.5).toFixed(1)}`,
                )
              : L(lang, "Use more coffee, or less water", "เพิ่มผงกาแฟ หรือลดน้ำ"),
          why: L(
            lang,
            "same extraction, more dissolved solids in the cup",
            "สกัดเท่าเดิม แต่ได้สารละลายในแก้วเข้มขึ้น",
          ),
        },
        {
          text: L(lang, "Leave the grind alone", "อย่าแตะเบอร์บด"),
          why: L(lang, "it is not the cause here", "ไม่ใช่ต้นเหตุของเคสนี้"),
        },
      ],
      suggestedGrind: last.grind || null,
      grindDirection: "hold",
      numbers,
      changes: [
        change(
          "yieldG",
          FIELD.yield,
          brew.yieldG,
          newYield,
          L(
            lang,
            `same dose, ${brew.doseG ? `1:${targetRatio.toFixed(1)}` : "a tighter ratio"} instead`,
            `ผงเท่าเดิม แต่เปลี่ยนเป็น 1:${targetRatio.toFixed(1)}`,
          ),
        ),
      ].filter((c): c is AdviceChange => c !== null),
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

    const tryText = suggested ? `${suggested}${unit ? ` ${unit}` : ""}` : "";
    const actions: AdviceAction[] = [
      {
        text: L(
          lang,
          `Grind ${finer ? "finer" : "coarser"} by about ${amount}${tryText ? ` — try ${tryText}` : ""}`,
          `บด${finer ? "ละเอียด" : "หยาบ"}ขึ้นราว ${amount}${tryText ? ` — ลอง ${tryText}` : ""}`,
        ),
        why: finer
          ? L(
              lang,
              "more surface area and slower flow, so more is dissolved",
              "พื้นที่ผิวมากขึ้นและน้ำไหลช้าลง จึงละลายสารออกมาได้มากขึ้น",
            )
          : L(
              lang,
              "less surface area and faster flow, so less is dissolved",
              "พื้นที่ผิวน้อยลงและน้ำไหลเร็วขึ้น จึงละลายสารออกมาน้อยลง",
            ),
      },
    ];
    if (finer) {
      actions.push({
        text: L(
          lang,
          "If it is already fine, raise the water by 2–3 °C instead",
          "ถ้าบดละเอียดสุดแล้ว ให้เพิ่มอุณหภูมิน้ำ 2–3 °C แทน",
        ),
        why: L(
          lang,
          "temperature raises extraction without choking the flow",
          "อุณหภูมิเพิ่มการสกัดได้โดยไม่ทำให้น้ำตัน",
        ),
      });
    } else {
      actions.push({
        text: L(
          lang,
          "Or pour more gently and skip the late stir",
          "หรือเทเบาลง และงดคนตอนท้าย",
        ),
        why: L(
          lang,
          "agitation raises extraction as surely as a finer grind",
          "การกวนเพิ่มการสกัดได้พอๆ กับการบดละเอียดขึ้น",
        ),
      });
    }
    actions.push({
      text: L(
        lang,
        "Change one thing, then taste again",
        "เปลี่ยนทีละอย่าง แล้วชิมใหม่",
      ),
      why: L(
        lang,
        "two changes at once and you cannot tell which one worked",
        "เปลี่ยนสองอย่างพร้อมกันจะแยกไม่ออกว่าอันไหนได้ผล",
      ),
    });

    return {
      headline: L(
        lang,
        `Go ${finer ? "finer" : "coarser"} by about ${amount}`,
        `ปรับ${finer ? "ละเอียด" : "หยาบ"}ขึ้นราว ${amount}`,
      ),
      because: finer
        ? L(
            lang,
            "Sour, salty and a fast run all point the same way: the water left before it took enough out. That is under-extraction.",
            "เปรี้ยว เค็ม และไหลเร็ว ล้วนชี้ไปทางเดียวกัน คือน้ำผ่านไปก่อนจะดึงสารออกมาพอ นี่คือการสกัดไม่ถึง (under-extraction)",
          )
        : L(
            lang,
            "Bitter, ashy and a slow run point the other way: the water stayed too long and pulled out the harsh end. That is over-extraction.",
            "ขม ไหม้ และไหลช้า ชี้ไปอีกทาง คือน้ำอยู่นานเกินจนดึงสารส่วนที่ขมฝาดออกมา นี่คือการสกัดเกิน (over-extraction)",
          ),
      actions,
      suggestedGrind: suggested,
      grindDirection: finer ? "finer" : "coarser",
      numbers,
      changes: [
        change(
          "grind",
          FIELD.grind,
          brew.grind,
          suggested,
          L(
            lang,
            `${finer ? "finer" : "coarser"} by ${amount}`,
            `${finer ? "ละเอียด" : "หยาบ"}ขึ้น ${amount}`,
          ),
        ),
        // Only offered when grinding finer: heat lifts extraction without
        // choking the flow. Off by default — it is the plan B, not the plan.
        finer
          ? change(
              "waterTempC",
              FIELD.temp,
              brew.waterTempC,
              tempPlus(brew.waterTempC, 2),
              L(
                lang,
                "only if the grinder is already at its finest",
                "ใช้เมื่อบดละเอียดสุดแล้วเท่านั้น",
              ),
              true,
            )
          : null,
      ].filter((c): c is AdviceChange => c !== null),
    };
  }

  /* ---------- 4. it was good ---------- */
  return {
    headline: L(lang, "Keep this one", "เก็บสูตรนี้ไว้"),
    because: L(
      lang,
      "Nothing is pulling the cup off balance, so this is your reference point for the bag.",
      "ไม่มีอะไรดึงให้แก้วเสียสมดุล ใช้ครั้งนี้เป็นจุดอ้างอิงของถุงนี้ได้เลย",
    ),
    actions: [
      {
        text: L(
          lang,
          "Log the same numbers next time and compare",
          "ครั้งหน้าบันทึกตัวเลขเดิมแล้วเทียบดู",
        ),
        why: L(
          lang,
          "the coffee keeps ageing, so the same grind will drift over a week or two",
          "กาแฟยังเปลี่ยนไปเรื่อยๆ เบอร์บดเดิมจะเริ่มเพี้ยนภายในหนึ่งถึงสองสัปดาห์",
        ),
      },
      {
        text: L(
          lang,
          "As the bag gets older, expect to grind slightly finer",
          "ถุงยิ่งเก่า ให้เตรียมบดละเอียดขึ้นเล็กน้อย",
        ),
        why: L(
          lang,
          "beans lose CO2 and extract more slowly as they degas",
          "เมล็ดคาย CO2 ออกไปเรื่อยๆ ทำให้สกัดได้ช้าลง",
        ),
      },
    ],
    suggestedGrind: last.grind || null,
    grindDirection: "hold",
    numbers,
    changes: [],
  };
}
