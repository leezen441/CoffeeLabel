"use client";

import { useSyncExternalStore } from "react";

export type Lang = "en" | "th";

const KEY = "bean-label/lang";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Lang {
  return window.localStorage.getItem(KEY) === "th" ? "th" : "en";
}

/** English on the server so the first paint always matches the markup. */
function getServerSnapshot(): Lang {
  return "en";
}

/**
 * Language is read straight from localStorage through useSyncExternalStore —
 * no setState in an effect, no hydration mismatch, and every component updates
 * the moment it changes.
 */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setLang(lang: Lang): void {
  window.localStorage.setItem(KEY, lang);
  listeners.forEach((cb) => cb());
}

type Entry = { en: string; th: string };

/**
 * UI copy. The printed sticker deliberately stays English — coffee terms are
 * English on the bags themselves, and the label has no room for two scripts.
 */
const DICT = {
  /* library */
  appTagline: { en: "Coffee sticker studio", th: "สตูดิโอสติกเกอร์กาแฟ" },
  newLabel: { en: "+ New label", th: "+ เพิ่มกาแฟ" },
  newGroup: { en: "+ Group", th: "+ เพิ่มกลุ่ม" },
  searchPlaceholder: {
    en: "Search coffee, roaster, origin…",
    th: "ค้นหากาแฟ ร้านคั่ว แหล่งปลูก…",
  },
  searchAllGroups: { en: "Search all groups", th: "ค้นทุกกลุ่ม" },
  searchIn: { en: "Search in", th: "ค้นเฉพาะ" },
  ofLabels: { en: "of", th: "จาก" },
  labelsWord: { en: "labels", th: "รายการ" },
  all: { en: "All", th: "ทั้งหมด" },
  drinkingNow: { en: "Drinking now", th: "ดื่มได้เลย" },
  resting: { en: "Resting", th: "กำลังพัก" },
  pastPeak: { en: "Past peak", th: "เลยช่วงดีแล้ว" },
  ungrouped: { en: "Ungrouped", th: "ยังไม่จัดกลุ่ม" },
  clearFilter: { en: "Clear filter", th: "ล้างตัวกรอง" },
  noLabelsYet: { en: "No labels yet", th: "ยังไม่มีกาแฟ" },
  createFirst: { en: "Create your first label", th: "สร้างรายการแรก" },
  loadSample: { en: "Load a sample", th: "ใส่ตัวอย่าง" },
  daysToGoPre: { en: "", th: "อีก " },
  daysToGo: { en: "d to go", th: " วัน" },
  ready: { en: "Ready", th: "พร้อม" },
  backup: { en: "Backup", th: "สำรองข้อมูล" },
  backupBlurb: {
    en: "Saves every label and group as one JSON file. Restoring merges by id — nothing is deleted.",
    th: "บันทึกทุกรายการและทุกกลุ่มเป็นไฟล์ JSON ไฟล์เดียว การกู้คืนจะรวมข้อมูลตาม id — ไม่มีอะไรถูกลบ",
  },
  downloadCopy: { en: "Download a copy", th: "ดาวน์โหลดสำรอง" },
  restoreFile: { en: "Restore from file", th: "กู้จากไฟล์" },
  moveToGroup: { en: "Move to group", th: "ย้ายเข้ากลุ่ม" },
  noGroup: { en: "No group", th: "ไม่มีกลุ่ม" },

  /* actions */
  edit: { en: "Edit", th: "แก้ไข" },
  print: { en: "Print", th: "พิมพ์" },
  duplicate: { en: "Duplicate", th: "ทำซ้ำ" },
  del: { en: "Delete", th: "ลบ" },
  brewGuide: { en: "Brew guide", th: "วิธีชง" },
  brewTimer: { en: "Brew timer", th: "จับเวลาชง" },
  library: { en: "Library", th: "คลังกาแฟ" },
  saveImage: { en: "Save image", th: "บันทึกรูป" },
  printStickers: { en: "Print stickers", th: "พิมพ์สติกเกอร์" },

  /* brew guide */
  water: { en: "Water", th: "อุณหภูมิน้ำ" },
  doseYield: { en: "Dose → Yield", th: "ผง → น้ำหนักที่ได้" },
  ratio: { en: "Ratio", th: "อัตราส่วน" },
  time: { en: "Time", th: "เวลา" },
  grind: { en: "Grind", th: "เบอร์บด" },
  batch: { en: "Batch", th: "จำนวนเท่า" },
  batchNote: {
    en: "dose, yield and every pour scaled — the saved recipe is unchanged",
    th: "ปรับผง น้ำ และทุกขั้นตอนตามสัดส่วน — สูตรที่บันทึกไว้ไม่เปลี่ยน",
  },
  startTimer: { en: "▶ Start brew timer", th: "▶ เริ่มจับเวลาชง" },
  roasted: { en: "Roasted", th: "คั่ววันที่" },
  bestBefore: { en: "Best before", th: "ควรดื่มก่อน" },
  peak: { en: "Peak", th: "ช่วงดีที่สุด" },
  net: { en: "Net", th: "น้ำหนักสุทธิ" },
  daysAgo: { en: "days ago", th: "วันที่แล้ว" },

  /* timer */
  timerTitle: { en: "Brew timer", th: "จับเวลาชง" },
  start: { en: "Start", th: "เริ่ม" },
  resume: { en: "Resume", th: "ไปต่อ" },
  pause: { en: "Pause", th: "หยุดชั่วคราว" },
  reset: { en: "Reset", th: "เริ่มใหม่" },
  startNow: { en: "Start now", th: "เริ่มเลย" },
  startingIn: { en: "Starting in", th: "เริ่มใน" },
  countdownHint: {
    en: "Hands off the screen — the timer starts on its own.",
    th: "ไม่ต้องแตะจอ นาฬิกาจะเริ่มเอง",
  },
  briefingHint: {
    en: "Listen to the first step. The 3-2-1 countdown starts when it finishes.",
    th: "ฟังขั้นแรกให้จบ แล้วจะนับ 3 2 1",
  },
  ofTotal: { en: "of", th: "จาก" },
  noTotal: { en: "no total set", th: "ยังไม่ได้ตั้งเวลารวม" },
  brewComplete: { en: "Brew complete", th: "ชงเสร็จแล้ว" },
  readyWord: { en: "Ready", th: "พร้อมเริ่ม" },
  nextIn: { en: "next in", th: "อีก" },
  timerFooter: {
    en: "Voice names the next step 8s early, then beeps 3s before. Mute from the speaker. Vibration is Android only.",
    th: "โค้ชเสียงอ่านขั้นต่อไปล่วงหน้า 8 วินาที แล้วบี๊บก่อนถึง 3 วินาที ปิดเสียงพูดได้ที่ไอคอนลำโพง — การสั่นใช้ได้เฉพาะ Android",
  },
  pourRibbon: { en: "Pour", th: "เทน้ำ" },
  voiceOn: { en: "Voice coach on", th: "เปิดโค้ชเสียง" },
  voiceOff: { en: "Voice coach off", th: "ปิดโค้ชเสียง" },

  /* brew log */
  brewLog: { en: "Brew log", th: "บันทึกการชง" },
  logABrew: { en: "+ Log a brew", th: "+ บันทึกการชง" },
  nextTime: { en: "Next time", th: "ครั้งหน้า" },
  howTaste: { en: "How did it taste", th: "รสชาติเป็นยังไง" },
  howRun: { en: "How did it run", th: "การไหลเป็นยังไง" },
  saveBrew: { en: "Save brew", th: "บันทึก" },
  cancel: { en: "Cancel", th: "ยกเลิก" },
  noteOptional: { en: "Note (optional)", th: "โน้ต (ไม่บังคับ)" },
  nothingLogged: {
    en: "Nothing logged yet. Record a brew and the next-time advice appears here.",
    th: "ยังไม่มีบันทึก ลองบันทึกการชงสักครั้ง แล้วคำแนะนำสำหรับครั้งหน้าจะขึ้นตรงนี้",
  },
  nextBrew: { en: "Next brew", th: "สูตรครั้งหน้า" },
  startBrewNow: { en: "▶ Start brew", th: "▶ เริ่มชงเลย" },
  replaceRecipe: { en: "Replace recipe", th: "ใช้แทนสูตรเดิม" },
  replaceConfirm: {
    en: "Replace the saved recipe with these values? The brew steps are overwritten.",
    th: "แทนที่สูตรที่บันทึกไว้ด้วยค่าเหล่านี้ไหม ขั้นตอนการชงเดิมจะถูกเขียนทับ",
  },
  optionalTag: { en: "optional", th: "ทางเลือก" },
  noChangeNeeded: {
    en: "No numbers left to change — the fix is in how you brew it, not what you set.",
    th: "ไม่มีค่าตัวเลขที่ต้องเปลี่ยนแล้ว — ที่ต้องแก้คือวิธีการชง ไม่ใช่ค่าที่ตั้ง",
  },
  poursRescaled: {
    en: "Pours rescaled to the new water total",
    th: "ปรับปริมาณน้ำแต่ละขั้นตามน้ำรวมใหม่แล้ว",
  },
  unchangedWord: { en: "unchanged", th: "เท่าเดิม" },
  today: { en: "Today", th: "วันนี้" },
  yesterday: { en: "Yesterday", th: "เมื่อวาน" },
  dAgo: { en: "d ago", th: " วันที่แล้ว" },
  dose: { en: "Dose g", th: "ผง (กรัม)" },
  yieldLabel: { en: "Yield g", th: "ได้ (กรัม)" },
  deleteBrewQ: {
    en: "Delete this brew from the log?",
    th: "ลบการชงครั้งนี้ออกจากบันทึกไหม",
  },
  method: { en: "Method", th: "วิธีชง" },
  loading: { en: "Loading…", th: "กำลังโหลด…" },
  guideNotFound: { en: "Brew guide not found", th: "ไม่พบวิธีชงนี้" },
  guideNotFoundBody: {
    en: "This label is not in the database — it may only exist in the browser it was created in.",
    th: "รายการนี้ไม่ได้อยู่ในฐานข้อมูล — อาจถูกสร้างไว้ในเบราว์เซอร์เครื่องอื่นเท่านั้น",
  },
  goToLibrary: { en: "Go to library", th: "ไปที่คลังกาแฟ" },

  /* editor */
  labelNotFound: { en: "Label not found", th: "ไม่พบรายการนี้" },
  labelNotFoundBody: {
    en: "It may have been deleted, or saved in a different browser.",
    th: "อาจถูกลบไปแล้ว หรือถูกบันทึกไว้ในเบราว์เซอร์อื่น",
  },
  backToLibrary: { en: "Back to library", th: "กลับคลังกาแฟ" },
  saving: { en: "Saving…", th: "กำลังบันทึก…" },
  allSaved: { en: "All changes saved", th: "บันทึกครบแล้ว" },
  saveFailed: { en: "Save failed", th: "บันทึกไม่สำเร็จ" },
  secCoffee: { en: "The coffee", th: "ข้อมูลกาแฟ" },
  fRoaster: { en: "Roaster / shop name", th: "ร้านคั่ว / ชื่อร้าน" },
  fCoffeeName: { en: "Coffee name", th: "ชื่อกาแฟ" },
  fVariety: { en: "Variety", th: "สายพันธุ์" },
  fProcess: { en: "Process", th: "กระบวนการแปรรูป" },
  fOrigin: { en: "Origin", th: "แหล่งปลูก" },
  fAltitude: { en: "Altitude", th: "ความสูง" },
  fGroup: { en: "Group", th: "กลุ่ม" },
  noneDash: { en: "— None —", th: "— ไม่ระบุ —" },
  otherDots: { en: "Other…", th: "อื่น ๆ…" },
  typeProcess: { en: "Type the process", th: "พิมพ์กระบวนการเอง" },
  dRest: { en: "d rest", th: " วันพัก" },
  filterByThis: { en: "Filter by this in the library", th: "ใช้กรองในคลังกาแฟได้" },
  createGroupsHint: {
    en: "Create groups from the library with + Group",
    th: "สร้างกลุ่มได้จากคลังกาแฟ ด้วยปุ่ม + เพิ่มกลุ่ม",
  },
  secRoast: { en: "Roast", th: "การคั่ว" },
  fRoastLevel: { en: "Roast level", th: "ระดับคั่ว" },
  fRoastDate: { en: "Roast date", th: "วันที่คั่ว" },
  fBestBeforeDays: { en: "Best before (days)", th: "ควรดื่มก่อน (วัน)" },
  fNetWeight: { en: "Net weight", th: "น้ำหนักสุทธิ" },
  gAuto: { en: "is added automatically", th: "จะถูกเติมให้อัตโนมัติ" },
  fRoastIndicator: { en: "Roast indicator", th: "รูปแบบแสดงระดับคั่ว" },
  segScale: { en: "Segmented scale", th: "แถบระดับ" },
  coffeeBeans: { en: "Coffee beans", th: "รูปเมล็ดกาแฟ" },
  fRestWindow: { en: "Rest / degas window", th: "ช่วงพักเมล็ด" },
  showPeakBar: { en: "Show peak window bar", th: "แสดงแถบช่วงดีที่สุด" },
  dayWord: { en: "Day", th: "วันที่" },
  afterRoasting: { en: "after roasting", th: "หลังคั่ว" },
  fRestFrom: { en: "Rest from (days)", th: "พักตั้งแต่ (วัน)" },
  fRestTo: { en: "Rest to (days)", th: "พักถึง (วัน)" },
  autoWord: { en: "auto", th: "อัตโนมัติ" },
  restHelp: {
    en: "Leave both blank to calculate it: roast level sets the base (light rests longest), espresso adds about a week over filter, and the process shifts it further. A guide only — tasting beats any formula.",
    th: "เว้นว่างทั้งสองช่องเพื่อให้คำนวณให้: ระดับคั่วเป็นฐาน (คั่วอ่อนพักนานสุด) เอสเปรสโซบวกอีกราวหนึ่งสัปดาห์เมื่อเทียบกับดริป และกระบวนการแปรรูปขยับต่ออีก เป็นแค่แนวทาง — ชิมเองแม่นกว่าสูตรใด ๆ",
  },
  fDoseTracker: { en: "Single-dose tracker", th: "ช่องนับจำนวนช็อต" },
  printTickBoxes: { en: "Print tick boxes", th: "พิมพ์ช่องติ๊ก" },
  howMany: { en: "How many", th: "กี่ช่อง" },
  secNotes: { en: "Tasting notes", th: "โน้ตรสชาติ" },
  addWord: { en: "Add", th: "เพิ่ม" },
  quickPick: {
    en: "Quick pick — each family carries its SCA colour onto the label",
    th: "เลือกด่วน — แต่ละกลุ่มจะพาสี SCA ของตัวเองไปบนสติกเกอร์",
  },
  secBrews: { en: "Brew methods", th: "วิธีชง" },
  addMethod: { en: "+ Add method", th: "+ เพิ่มวิธีชง" },
  noBrewsYet: { en: "No brew methods yet — add up to", th: "ยังไม่มีวิธีชง — เพิ่มได้ถึง" },

  /* brew editor */
  methodPlaceholder: {
    en: "Brew method (e.g. Espresso)",
    th: "วิธีชง (เช่น Espresso)",
  },
  moveUp: { en: "Move up", th: "เลื่อนขึ้น" },
  moveDown: { en: "Move down", th: "เลื่อนลง" },
  removeMethod: { en: "Remove method", th: "ลบวิธีชงนี้" },
  removeStep: { en: "Remove step", th: "ลบขั้นตอนนี้" },
  fWaterC: { en: "Water °C", th: "อุณหภูมิน้ำ °C" },
  fDoseG: { en: "Dose g", th: "ผงกาแฟ (กรัม)" },
  fYieldG: { en: "Yield g", th: "น้ำหนักที่ได้ (กรัม)" },
  fTime: { en: "Time", th: "เวลา" },
  timeHint: {
    en: "Just the time — “min.” is added on the label automatically",
    th: "ใส่แค่เวลา — คำว่า “min.” จะถูกเติมบนสติกเกอร์ให้เอง",
  },
  fGrinderBrand: { en: "Grinder brand", th: "ยี่ห้อเครื่องบด" },
  fModel: { en: "Model", th: "รุ่น" },
  typeBrand: { en: "Type the brand", th: "พิมพ์ยี่ห้อเอง" },
  typeModel: { en: "Type the model", th: "พิมพ์รุ่นเอง" },
  dialClicks: { en: "Clicks", th: "จำนวนคลิก" },
  dialNumber: { en: "Dial number", th: "เบอร์บด" },
  dialMicrons: { en: "Microns (µm)", th: "ไมครอน (µm)" },
  dialSetting: { en: "Dial setting", th: "ค่าความละเอียด" },
  unitsHint: {
    en: "Units are added automatically —",
    th: "หน่วยจะถูกเติมให้เอง —",
  },
  unitsHintTail: {
    en: "on times, so type just",
    th: "ต่อท้ายเวลา ใส่แค่",
  },
  unitsHintWeights: { en: "on weights and", th: "ต่อท้ายน้ำหนัก และ" },
  unitsHintOverride: {
    en: "Typing your own unit",
    th: "ถ้าพิมพ์หน่วยเอง",
  },
  unitsHintOverrideTail: { en: "overrides it.", th: "จะใช้ตามที่พิมพ์" },
  brewSequence: { en: "Brew sequence", th: "ลำดับการชง" },
  seqHintA: { en: "step · start · end · water — leave", th: "ขั้นตอน · เริ่ม · จบ · น้ำ — เว้น" },
  seqHintB: {
    en: "blank to continue from the step above",
    th: "ว่างไว้ เพื่อชงต่อจากขั้นก่อนหน้า",
  },
  startWord: { en: "start", th: "เริ่ม" },
  endWord: { en: "end", th: "จบ" },
  waterG: { en: "water g", th: "น้ำ (g)" },
  addStep: { en: "+ Add step", th: "+ เพิ่มขั้นตอน" },
  stepFirstPlaceholder: {
    en: "Bloom 45 g, swirl gently",
    th: "บลูม 45 g แล้วหมุนเบา ๆ",
  },
  stepNextPlaceholder: { en: "Next pour / action…", th: "รินรอบถัดไป / สิ่งที่ทำ…" },
  startHint: {
    en: "Start of this step (mm:ss). Leave blank to continue from the step above.",
    th: "เวลาที่เริ่มขั้นนี้ (mm:ss) เว้นว่างเพื่อชงต่อจากขั้นก่อนหน้า",
  },
  endHint: { en: "End of this step (mm:ss)", th: "เวลาที่จบขั้นนี้ (mm:ss)" },
  waterHint: {
    en: "Total water in the brewer after this step — drives the pour ribbon",
    th: "น้ำรวมในดริปเปอร์หลังจบขั้นนี้ — ใช้วาดแถบการริน",
  },

  /* print */
  editorWord: { en: "Editor", th: "แก้ไข" },
  printTitle: { en: "Print", th: "พิมพ์" },
  rendering: { en: "Rendering…", th: "กำลังสร้างรูป…" },
  saveImageFailed: { en: "Could not save the image:", th: "บันทึกรูปไม่สำเร็จ:" },
  secSticker: { en: "Sticker", th: "สติกเกอร์" },
  fSize: { en: "Size", th: "ขนาด" },
  fLayout: { en: "Layout", th: "รูปแบบ" },
  layoutFull: { en: "Full — numbered steps", th: "เต็ม — ลำดับขั้นเป็นตัวเลข" },
  layoutRibbon: { en: "Ribbon — pour timeline", th: "แถบ — ไทม์ไลน์การริน" },
  layoutCompact: { en: "Compact — specs only", th: "กระชับ — เฉพาะค่าหลัก" },
  fColour: { en: "Colour", th: "โทนสี" },
  fQr: { en: "QR code", th: "คิวอาร์โค้ด" },
  printQr: { en: "Print a QR code", th: "พิมพ์คิวอาร์โค้ดด้วย" },
  fWidthMm: { en: "Width (mm)", th: "กว้าง (มม.)" },
  fHeightMm: { en: "Height (mm)", th: "สูง (มม.)" },
  customBetween: { en: "Custom — between", th: "กำหนดเอง — ระหว่าง" },
  mmEachSide: { en: "mm on each side", th: "มม. ต่อด้าน" },
  savedToLabel: { en: "Changes are saved to the label", th: "การตั้งค่านี้ถูกบันทึกไว้กับรายการ" },
  fContent: { en: "Content", th: "เนื้อหา" },
  fullLabel: { en: "Full label", th: "สติกเกอร์เต็ม" },
  brewOnly: { en: "Brew guide only", th: "เฉพาะวิธีชง" },
  fPaper: { en: "Paper", th: "กระดาษ" },
  sheetA4: { en: "A4 sheet (210 × 297 mm)", th: "กระดาษ A4 (210 × 297 มม.)" },
  sheetLetter: { en: "US Letter (216 × 279 mm)", th: "US Letter (216 × 279 มม.)" },
  sheetExact: {
    en: "Label printer — one per page",
    th: "เครื่องพิมพ์ฉลาก — หนึ่งดวงต่อหน้า",
  },
  fCopies: { en: "Copies", th: "จำนวนดวง" },
  fGapMm: { en: "Gap (mm)", th: "ระยะห่าง (มม.)" },
  fCutGuides: { en: "Cut guides", th: "เส้นตัด" },
  showDashed: { en: "Show dashed outline", th: "แสดงเส้นประรอบดวง" },
  stickerWord: { en: "Sticker", th: "สติกเกอร์" },
  perPage: { en: "per page", th: "ต่อหน้า" },
  pageWord: { en: "page", th: "หน้า" },
  pagesWord: { en: "pages", th: "หน้า" },
  printTipsTitle: {
    en: "In the browser print dialog → More settings:",
    th: "ในหน้าต่างพิมพ์ของเบราว์เซอร์ → More settings:",
  },
  tipHeaders: {
    en: "Untick Headers and footers — otherwise the browser prints the date and page URL in the corners",
    th: "เอาเครื่องหมายถูกออกจาก Headers and footers — ไม่งั้นเบราว์เซอร์จะพิมพ์วันที่และลิงก์ติดมาที่มุมกระดาษ",
  },
  tipMargins: { en: "Margins: None", th: "ตั้ง Margins เป็น None" },
  tipScale: {
    en: "Scale: 100% — not “Fit to page”, which breaks the millimetre sizing",
    th: "ตั้ง Scale เป็น 100% — ห้ามใช้ “Fit to page” เพราะขนาดมิลลิเมตรจะเพี้ยน",
  },
  tipBackground: {
    en: "Enable Background graphics so the colours print",
    th: "เปิด Background graphics เพื่อให้สีถูกพิมพ์ออกมาด้วย",
  },

  /* viewer */
  /* Thai puts the noun first, so the whole phrase lives in one key. */
  layoutWord: { en: "layout", th: "" },
  compactWord: { en: "Compact", th: "รูปแบบกระชับ" },
  fullWord: { en: "Full", th: "รูปแบบเต็ม" },
  zoomOut: { en: "Zoom out", th: "ย่อ" },
  zoomIn: { en: "Zoom in", th: "ขยาย" },
  fitWord: { en: "Fit", th: "พอดีจอ" },
  closePreview: { en: "Close preview", th: "ปิดหน้าตัวอย่าง" },
  viewerHint: {
    en: "Pinch or scroll to zoom · drag to move · double-tap to toggle · Esc to close",
    th: "จีบนิ้วหรือเลื่อนเพื่อซูม · ลากเพื่อเลื่อน · แตะสองครั้งเพื่อสลับ · Esc เพื่อปิด",
  },

  /* library dialogs */
  groupNamePrompt: { en: "Group name", th: "ชื่อกลุ่ม" },
  groupExists: { en: "already exists.", th: "มีอยู่แล้ว" },
  aGroupCalled: { en: "A group called", th: "กลุ่มชื่อ" },
  restoredWord: { en: "Restored", th: "กู้คืนแล้ว" },
  groupsWord: { en: "groups", th: "กลุ่ม" },
  restoreFailed: {
    en: "That file could not be restored:",
    th: "กู้คืนไฟล์นี้ไม่สำเร็จ:",
  },
  deleteGroupQ: { en: "Delete the group", th: "ลบกลุ่ม" },
  deleteGroupKeep: {
    en: "Its labels will be kept but become ungrouped.",
    th: "รายการในกลุ่มจะยังอยู่ แต่จะกลายเป็นไม่มีกลุ่ม",
  },
  deleteLabelQ: { en: "Delete", th: "ลบ" },
  cannotUndo: { en: "This cannot be undone.", th: "ย้อนกลับไม่ได้" },
  limitSearch: { en: "Limit the search to one group", th: "จำกัดการค้นหาไว้ที่กลุ่มเดียว" },
  emptyBlurb: {
    en: "Create a sticker with your roaster details, roast level and up to five brew recipes — then print it and stick it on the bag.",
    th: "สร้างสติกเกอร์ที่มีชื่อร้านคั่ว ระดับคั่ว และสูตรชงได้ถึงห้าวิธี — แล้วพิมพ์ออกมาติดบนถุงได้เลย",
  },
  groupColon: { en: "Group:", th: "กลุ่ม:" },
  storageCloud: {
    en: "Labels are saved to your Postgres database",
    th: "ข้อมูลถูกบันทึกไว้ในฐานข้อมูล Postgres ของคุณ",
  },
  storageLocal: {
    en: "No DATABASE_URL set — labels are saved in this browser only",
    th: "ยังไม่ได้ตั้ง DATABASE_URL — ข้อมูลถูกเก็บไว้ในเบราว์เซอร์นี้เท่านั้น",
  },
  databaseWord: { en: "Database", th: "ฐานข้อมูล" },
  thisBrowser: { en: "This browser", th: "เบราว์เซอร์นี้" },
} satisfies Record<string, Entry>;

/**
 * Size hints live in types.ts as data; this keeps their Thai next to the rest
 * of the copy instead of widening the shared model.
 */
const SIZE_HINT_TH: Record<string, string> = {
  "100x150": "ม้วนฉลากความร้อน 4×6 นิ้ว — ใหญ่สุด อ่านง่ายสุด",
  "100x100": "ม้วนฉลากความร้อนแบบสี่เหลี่ยมจัตุรัส",
  "100x70": "ฉลากติดถุง — ใส่ขั้นตอนการชงได้ครบ",
  "90x60": "แผ่นสติกเกอร์มาตรฐาน",
  "80x50": "เครื่องพิมพ์ฉลากความร้อน",
  "70x40": "เล็ก — ควรใช้รูปแบบกระชับ",
  "60x60": "สี่เหลี่ยมจัตุรัส — ควรใช้รูปแบบกระชับ",
  a6: "การ์ดวิธีชงวางข้างเครื่อง",
  custom: "พิมพ์ความกว้างและความสูงเอง",
};

export function sizeHint(id: string, fallback: string, lang: Lang): string {
  return lang === "th" ? (SIZE_HINT_TH[id] ?? fallback) : fallback;
}

/** Only the two names that carry words rather than millimetres. */
const SIZE_NAME_TH: Record<string, string> = {
  a6: "การ์ด A6 (105 × 148 มม.)",
  custom: "กำหนดขนาดเอง…",
};

export function sizeName(id: string, fallback: string, lang: Lang): string {
  return lang === "th" ? (SIZE_NAME_TH[id] ?? fallback) : fallback;
}

export type MsgKey = keyof typeof DICT;

export function t(lang: Lang, key: MsgKey): string {
  return DICT[key][lang];
}

/** Convenience for components that already hold the language. */
export function makeT(lang: Lang) {
  return (key: MsgKey) => t(lang, key);
}
