"use client";

import { useEffect, useState } from "react";

/**
 * The list of brew methods to add. A native select would do for picking, but
 * it has nowhere to hang a cross on each saved method, and forgetting one
 * belongs in the same list it was saved into.
 */
export default function MethodPicker({
  starters,
  saved,
  disabled,
  placeholder,
  startersLabel,
  savedLabel,
  forgetLabel,
  onPick,
  onForget,
}: {
  starters: readonly string[];
  saved: string[];
  disabled: boolean;
  placeholder: string;
  startersLabel: string;
  savedLabel: string;
  forgetLabel: string;
  onPick: (name: string) => void;
  onForget: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = (name: string) => {
    setOpen(false);
    onPick(name);
  };

  return (
    <div className="relative w-full sm:max-w-xs">
      <button
        type="button"
        className="select text-left disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {placeholder}
      </button>

      {open && !disabled && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="panel absolute inset-x-0 top-full z-50 mt-1 max-h-80 overflow-y-auto py-1 shadow-lg"
          >
            <GroupLabel>{startersLabel}</GroupLabel>
            {starters.map((name) => (
              <button
                key={name}
                type="button"
                role="menuitem"
                className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-brand-soft"
                onClick={() => pick(name)}
              >
                {name}
              </button>
            ))}

            {saved.length > 0 && (
              <>
                <GroupLabel>{savedLabel}</GroupLabel>
                {saved.map((name) => (
                  <div key={name} className="flex items-center hover:bg-brand-soft">
                    <button
                      type="button"
                      role="menuitem"
                      className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
                      onClick={() => pick(name)}
                    >
                      {name}
                    </button>
                    {/* Stays open: forgetting is tidying the list, not leaving it. */}
                    <button
                      type="button"
                      className="shrink-0 px-3 py-2 text-sm text-muted hover:text-[var(--danger)]"
                      aria-label={`${forgetLabel} ${name}`}
                      title={`${forgetLabel} ${name}`}
                      onClick={() => onForget(name)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-2 pb-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">
      {children}
    </p>
  );
}
