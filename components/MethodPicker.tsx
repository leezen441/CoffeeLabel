"use client";

import { useEffect, useState } from "react";

/**
 * The "+ Add method" button and the list it opens. A native select would do
 * for picking, but it has nowhere to hang a cross on each saved method, and
 * forgetting one belongs in the same list it was saved into.
 */
export default function MethodPicker({
  label,
  blankLabel,
  starters,
  saved,
  disabled,
  startersLabel,
  savedLabel,
  forgetLabel,
  onBlank,
  onPick,
  onForget,
}: {
  label: string;
  blankLabel: string;
  starters: readonly string[];
  saved: string[];
  disabled: boolean;
  startersLabel: string;
  savedLabel: string;
  forgetLabel: string;
  onBlank: () => void;
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

  const choose = (add: () => void) => {
    setOpen(false);
    add();
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="btn"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
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
            className="panel absolute right-0 top-full z-50 mt-1 max-h-80 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto py-1 shadow-lg"
          >
            {/* What the button did on its own before it opened a list. */}
            <MenuRow onClick={() => choose(onBlank)}>{blankLabel}</MenuRow>

            <GroupLabel>{startersLabel}</GroupLabel>
            {starters.map((name) => (
              <MenuRow key={name} onClick={() => choose(() => onPick(name))}>
                {name}
              </MenuRow>
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
                      onClick={() => choose(() => onPick(name))}
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

function MenuRow({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-brand-soft"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-2 pb-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">
      {children}
    </p>
  );
}
