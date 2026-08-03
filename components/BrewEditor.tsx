"use client";

import {
  type BrewMethod,
  METHOD_PRESETS,
  emptyStep,
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
  const set = <K extends keyof BrewMethod>(key: K, value: BrewMethod[K]) =>
    onChange({ ...brew, [key]: value });

  const setStep = (id: string, patch: Partial<{ text: string; at: string }>) =>
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
            placeholder="28s"
            value={brew.totalTime}
            onChange={(e) => set("totalTime", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Grind</span>
          <input
            className="input"
            placeholder="Fine"
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

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="section-title">Brew sequence</span>
          <button className="btn btn-ghost text-xs" onClick={addStep}>
            + Add step
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {brew.steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1.5">
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
              <input
                className="input w-20 shrink-0 text-center font-mono"
                placeholder="0:45"
                title="Timestamp (optional)"
                value={step.at}
                onChange={(e) => setStep(step.id, { at: e.target.value })}
              />
              <button
                className="btn btn-ghost px-1.5"
                title="Move up"
                onClick={() => moveStep(i, -1)}
                disabled={i === 0}
              >
                ↑
              </button>
              <button
                className="btn btn-ghost px-1.5"
                title="Move down"
                onClick={() => moveStep(i, 1)}
                disabled={i === brew.steps.length - 1}
              >
                ↓
              </button>
              <button
                className="btn btn-ghost btn-danger px-1.5"
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
