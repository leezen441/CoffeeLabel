"use client";

import { useState } from "react";
import { makeT, useLang } from "@/lib/i18n";
import {
  type BrewMethod,
  GRINDER_BRANDS,
  METHOD_PRESETS,
  emptyStep,
  grinderModelOf,
  grinderModels,
  ratioOf,
} from "@/lib/types";
import { brewFromTemplate, isBrewBlank, templateFor } from "@/lib/brewTemplates";

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
  const tr = makeT(useLang());

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
    ? {
        clicks: tr("dialClicks"),
        number: tr("dialNumber"),
        microns: tr("dialMicrons"),
      }[model.dial]
    : tr("dialSetting");

  return (
    <div className="rounded-xl border border-line bg-paper/50 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
          {index + 1}
        </span>
        <input
          className="input min-w-0 flex-1 font-semibold"
          list="method-presets"
          placeholder={tr("methodPlaceholder")}
          value={brew.name}
          onChange={(e) => {
            const name = e.target.value;
            if (templateFor(name) && isBrewBlank(brew)) {
              onChange(brewFromTemplate(name, brew));
            } else {
              set("name", name);
            }
          }}
        />
        <button
          className="btn btn-ghost px-2"
          title={tr("moveUp")}
          onClick={() => onMove(-1)}
          disabled={index === 0}
        >
          ↑
        </button>
        <button
          className="btn btn-ghost px-2"
          title={tr("moveDown")}
          onClick={() => onMove(1)}
          disabled={index === total - 1}
        >
          ↓
        </button>
        <button
          className="btn btn-ghost btn-danger px-2"
          title={tr("removeMethod")}
          onClick={onRemove}
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="field">
          <span>{tr("fWaterC")}</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="93"
            value={brew.waterTempC}
            onChange={(e) => set("waterTempC", e.target.value)}
          />
        </label>
        <label className="field">
          <span>{tr("fDoseG")}</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="18"
            value={brew.doseG}
            onChange={(e) => set("doseG", e.target.value)}
          />
        </label>
        <label className="field">
          <span>{tr("fYieldG")}</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="36"
            value={brew.yieldG}
            onChange={(e) => set("yieldG", e.target.value)}
          />
        </label>
        <label className="field">
          <span>{tr("fTime")}</span>
          <input
            className="input"
            placeholder="2:15"
            title={tr("timeHint")}
            value={brew.totalTime}
            onChange={(e) => set("totalTime", e.target.value)}
          />
        </label>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="field">
          <span>{tr("fGrinderBrand")}</span>
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
            <option value="">{tr("noneDash")}</option>
            {GRINDER_BRANDS.map((b) => (
              <option key={b.brand} value={b.brand}>
                {b.brand}
              </option>
            ))}
            <option value="__custom">{tr("otherDots")}</option>
          </select>
          {showBrandInput && (
            <input
              className="input mt-2"
              placeholder={tr("typeBrand")}
              value={brew.grinderBrand}
              onChange={(e) => set("grinderBrand", e.target.value)}
            />
          )}
        </label>

        <label className="field">
          <span>{tr("fModel")}</span>
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
              <option value="">{tr("noneDash")}</option>
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
              <option value="__custom">{tr("otherDots")}</option>
            </select>
          )}
          {showModelInput && (
            <input
              className={`input ${knownBrand ? "mt-2" : ""}`}
              placeholder={tr("typeModel")}
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
          {tr("ratio")} <b className="text-ink">{ratio}</b>
        </p>
      )}

      <p className="mt-2 text-xs text-muted">
        {tr("unitsHint")} <b className="text-ink">g.</b> {tr("unitsHintWeights")}{" "}
        <b className="text-ink">min.</b> {tr("unitsHintTail")}{" "}
        <span className="font-mono">18.2</span> / <span className="font-mono">2:15</span>.{" "}
        {tr("unitsHintOverride")} (<span className="font-mono">28s</span>){" "}
        {tr("unitsHintOverrideTail")}
      </p>

      <div className="mt-3">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="section-title">{tr("brewSequence")}</span>
          <span className="text-xs font-normal normal-case tracking-normal text-muted">
            {tr("seqHintA")} <b className="text-ink">{tr("startWord")}</b>{" "}
            {tr("seqHintB")}
          </span>
          <button className="btn btn-ghost text-xs" onClick={addStep}>
            {tr("addStep")}
          </button>
          {templateFor(brew.name) && (
            <button
              className="btn btn-ghost text-xs"
              onClick={() => {
                if (!isBrewBlank(brew) && !confirm(tr("useTemplateConfirm"))) return;
                onChange(brewFromTemplate(brew.name, brew));
              }}
            >
              {tr("useTemplate")}
            </button>
          )}
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
                    i === 0 ? tr("stepFirstPlaceholder") : tr("stepNextPlaceholder")
                  }
                  value={step.text}
                  onChange={(e) => setStep(step.id, { text: e.target.value })}
                />
              </div>
              <input
                className="input w-14 shrink-0 text-center font-mono sm:w-16"
                placeholder={tr("startWord")}
                title={tr("startHint")}
                value={step.startAt}
                onChange={(e) => setStep(step.id, { startAt: e.target.value })}
              />
              <input
                className="input w-14 shrink-0 text-center font-mono sm:w-16"
                placeholder={tr("endWord")}
                title={tr("endHint")}
                value={step.endAt}
                onChange={(e) => setStep(step.id, { endAt: e.target.value })}
              />
              <input
                className="input w-16 shrink-0 text-center font-mono sm:w-20"
                inputMode="decimal"
                placeholder={tr("waterG")}
                title={tr("waterHint")}
                value={step.waterG}
                onChange={(e) => setStep(step.id, { waterG: e.target.value })}
              />
              <button
                className="btn btn-ghost ml-auto px-1 sm:ml-0 sm:px-1.5"
                title={tr("moveUp")}
                onClick={() => moveStep(i, -1)}
                disabled={i === 0}
              >
                ↑
              </button>
              <button
                className="btn btn-ghost px-1 sm:px-1.5"
                title={tr("moveDown")}
                onClick={() => moveStep(i, 1)}
                disabled={i === brew.steps.length - 1}
              >
                ↓
              </button>
              <button
                className="btn btn-ghost btn-danger px-1 sm:px-1.5"
                title={tr("removeStep")}
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
