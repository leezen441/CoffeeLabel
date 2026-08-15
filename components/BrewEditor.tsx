"use client";

import { useState } from "react";
import {
  type BrewMethod,
  GRINDER_BRANDS,
  METHOD_PRESETS,
  emptyStep,
  grinderModelOf,
  grinderModels,
  ratioOf,
} from "@/lib/types";

export default function BrewEditor({
  brew,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  brew: BrewMethod;
  index: number;
  total: number;
  onChange: (next: BrewMethod) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [customBrand, setCustomBrand] = useState(false);
  const [customModel, setCustomModel] = useState(false);

  const set = <K extends keyof BrewMethod>(key: K, value: BrewMethod[K]) =>
    onChange({ ...brew, [key]: value });

  const setStep = (
    id: string,
    patch: Partial<{ text: string; startAt: string; endAt: string; waterG: string }>,
  ) =>
    onChange({
      ...brew,
      steps: brew.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  const addStep = () => onChange({ ...brew, steps: [...brew.steps, emptyStep()] });

  const removeStep = (id: string) =>
    onChange({
      ...brew,
      steps: brew.steps.length > 1 ? brew.steps.filter((s) => s.id !== id) : brew.steps,
    });

  const moveStep = (i: number, dir: -1 | 1) => {
    const next = [...brew.steps];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...brew, steps: next });
  };

  const ratio = ratioOf(brew);
  const knownBrand = GRINDER_BRANDS.some((b) => b.brand === brew.grinderBrand);
  const models = grinderModels(brew.grinderBrand);
  const model = grinderModelOf(brew);
  const knownModel = models.some((m) => m.name === brew.grinderModel);
  // a custom brand has no model list, so its model is always free text
  const showBrandInput = customBrand || (!!brew.grinderBrand && !knownBrand);
  const showModelInput =
    customModel || !knownBrand || (!!brew.grinderModel && !knownModel);
  const dialWord = model
    ? { clicks: "Clicks", number: "Dial number", microns: "Microns (µm)" }[model.dial]
    : "Dial setting";

  return (
    <div className="rounded-xl border border-line bg-paper/50 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
          {index + 1}
        </span>
        <input
          className="input min-w-0 flex-1 font-semibold"
          list="method-presets"
          placeholder="Brew method (e.g. Espresso)"
          value={brew.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <button
          className="btn btn-ghost px-2"
          title="Move up"
          onClick={() => onMove(-1)}
          disabled={index === 0}
        >
          ↑
        </button>
        <button
          className="btn btn-ghost px-2"
          title="Move down"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
        >
          ↓
        </button>
        <button
          className="btn btn-ghost btn-danger px-2"
          title="Remove method"
          onClick={onRemove}
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="field">
          <span>Water °C</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="93"
            value={brew.waterTempC}
            onChange={(e) => set("waterTempC", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Dose g</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="18"
            value={brew.doseG}
            onChange={(e) => set("doseG", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Yield g</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="36"
            value={brew.yieldG}
            onChange={(e) => set("yieldG", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Time</span>
          <input
            className="input"
            placeholder="2:15"
            title="Just the time — “min.” is added on the label automatically"
            value={brew.totalTime}
            onChange={(e) => set("totalTime", e.target.value)}
          />
        </label>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="field">
          <span>Grinder brand</span>
          <select
            className="select"
            value={knownBrand ? brew.grinderBrand : brew.grinderBrand ? "__custom" : ""}
            onChange={(e) => {
              const v = e.target.value;
              // switching brand clears the model — the old one won't exist here
              if (v === "__custom") {
                setCustomBrand(true);
                onChange({ ...brew, grinderBrand: "", grinderModel: "" });
              } else {
                setCustomBrand(false);
                onChange({ ...brew, grinderBrand: v, grinderModel: "" });
              }
            }}
          >
            <option value="">— None —</option>
            {GRINDER_BRANDS.map((b) => (
              <option key={b.brand} value={b.brand}>
                {b.brand}
              </option>
            ))}
            <option value="__custom">Other…</option>
          </select>
          {showBrandInput && (
            <input
              className="input mt-2"
              placeholder="Type the brand"
              value={brew.grinderBrand}
              onChange={(e) => set("grinderBrand", e.target.value)}
            />
          )}
        </label>

        <label className="field">
          <span>Model</span>
          {/* Only a known brand has a model list; otherwise it is free text. */}
          {knownBrand && (
            <select
              className="select"
              value={knownModel ? brew.grinderModel : brew.grinderModel ? "__custom" : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__custom") {
                  setCustomModel(true);
                  set("grinderModel", "");
                } else {
                  setCustomModel(false);
                  set("grinderModel", v);
                }
              }}
            >
              <option value="">— None —</option>
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
              <option value="__custom">Other…</option>
            </select>
          )}
          {showModelInput && (
            <input
              className={`input ${knownBrand ? "mt-2" : ""}`}
              placeholder="Type the model"
              value={brew.grinderModel}
              onChange={(e) => set("grinderModel", e.target.value)}
            />
          )}
        </label>

        <label className="field">
          <span>{dialWord}</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder={model ? model.placeholder : "6.2"}
            value={brew.grind}
            onChange={(e) => set("grind", e.target.value)}
          />
        </label>
      </div>

      {ratio && (
        <p className="mt-2 font-mono text-xs text-muted">
          Ratio <b className="text-ink">{ratio}</b>
        </p>
      )}

      <p className="mt-2 text-xs text-muted">
        Units are added automatically — <b className="text-ink">g.</b> on weights and{" "}
        <b className="text-ink">min.</b> on times, so type just{" "}
        <span className="font-mono">18.2</span> or <span className="font-mono">2:15</span>.
        Typing your own unit (<span className="font-mono">28s</span>) overrides it.
      </p>

      <div className="mt-3">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="section-title">Brew sequence</span>
          <span className="text-xs font-normal normal-case tracking-normal text-muted">
            step · start · end · water — leave <b className="text-ink">start</b> blank to
            continue from the step above
          </span>
          <button className="btn btn-ghost text-xs" onClick={addStep}>
            + Add step
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {brew.steps.map((step, i) => (
            /* Wraps on a phone: the step text takes its own line and the
               numbers sit on the next, otherwise everything is squeezed to
               nothing and the text box becomes untypable. */
            <div
              key={step.id}
              className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line p-1.5 sm:border-0 sm:p-0"
            >
              <div className="flex min-w-0 basis-full items-center gap-1.5 sm:flex-1 sm:basis-0">
                <span className="w-5 shrink-0 text-center font-mono text-xs text-muted">
                  {i + 1}.
                </span>
                <input
                  className="input min-w-0 flex-1"
                  placeholder={
                    i === 0 ? "Bloom 45 g, swirl gently" : "Next pour / action…"
                  }
                  value={step.text}
                  onChange={(e) => setStep(step.id, { text: e.target.value })}
                />
              </div>
              <input
                className="input w-14 shrink-0 text-center font-mono sm:w-16"
                placeholder="start"
                title="Start of this step (mm:ss). Leave blank to continue from the step above."
                value={step.startAt}
                onChange={(e) => setStep(step.id, { startAt: e.target.value })}
              />
              <input
                className="input w-14 shrink-0 text-center font-mono sm:w-16"
                placeholder="end"
                title="End of this step (mm:ss)"
                value={step.endAt}
                onChange={(e) => setStep(step.id, { endAt: e.target.value })}
              />
              <input
                className="input w-16 shrink-0 text-center font-mono sm:w-20"
                inputMode="decimal"
                placeholder="water g"
                title="Total water in the brewer after this step — drives the pour ribbon"
                value={step.waterG}
                onChange={(e) => setStep(step.id, { waterG: e.target.value })}
              />
              <button
                className="btn btn-ghost ml-auto px-1 sm:ml-0 sm:px-1.5"
                title="Move up"
                onClick={() => moveStep(i, -1)}
                disabled={i === 0}
              >
                ↑
              </button>
              <button
                className="btn btn-ghost px-1 sm:px-1.5"
                title="Move down"
                onClick={() => moveStep(i, 1)}
                disabled={i === brew.steps.length - 1}
              >
                ↓
              </button>
              <button
                className="btn btn-ghost btn-danger px-1 sm:px-1.5"
                title="Remove step"
                onClick={() => removeStep(step.id)}
                disabled={brew.steps.length <= 1}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <datalist id="method-presets">
        {METHOD_PRESETS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

    </div>
  );
}
