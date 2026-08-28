"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StickerScaler from "@/components/StickerScaler";
import StickerViewer from "@/components/StickerViewer";
import { sampleLabel } from "@/lib/sample";
import * as store from "@/lib/store";
import type { StorageMode } from "@/lib/store";
import LangToggle from "@/components/LangToggle";
import { type MsgKey, makeT, useLang } from "@/lib/i18n";
import { saveGroups, useSavedGroups } from "@/lib/groupFilter";
import { useOrigin } from "@/lib/useOrigin";
import { newLabel } from "@/lib/brewTemplates";
import {
  type CoffeeLabel,
  type LabelGroup,
  type RestStatus,
  REST_STATUS_META,
  emptyGroup,
  labelTitle,
  restStatus,
  uid,
} from "@/lib/types";

/** Sentinel for the "labels with no group" chip. */
const UNGROUPED = "__ungrouped__";

export default function LibraryPage() {
  const router = useRouter();
  const [labels, setLabels] = useState<CoffeeLabel[] | null>(null);
  const [groups, setGroups] = useState<LabelGroup[]>([]);
  const [mode, setMode] = useState<StorageMode | null>(null);
  const [query, setQuery] = useState("");
  /** "" = search everything, otherwise restrict the text search to one group */
  const [scope, setScope] = useState("");
  const savedGroups = useSavedGroups();
  const [ready, setReady] = useState<"all" | RestStatus>("all");
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<CoffeeLabel | null>(null);
  /** open "move to group" popover, anchored to the card's tag button */
  const [menu, setMenu] = useState<{ label: CoffeeLabel; x: number; y: number } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const origin = useOrigin();
  const tr = makeT(useLang());

  const refresh = useCallback(
    () =>
      Promise.all([
        store.listLabels(),
        store.listGroups(),
        store.storageMode(),
      ]).then(([list, gs, m]) => {
        setLabels(list);
        setGroups(gs);
        setMode(m);
      }),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  const groupOf = useCallback(
    (l: CoffeeLabel) => l.groupId || UNGROUPED,
    [],
  );

  /**
   * The remembered selection, minus any group that has since been deleted —
   * a stale id would silently filter the whole library down to nothing.
   */
  const active = useMemo(() => {
    const known = new Set([UNGROUPED, ...groups.map((g) => g.id)]);
    return new Set(savedGroups.filter((id) => known.has(id)));
  }, [savedGroups, groups]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    (labels ?? []).forEach((l) => m.set(groupOf(l), (m.get(groupOf(l)) ?? 0) + 1));
    return m;
  }, [labels, groupOf]);

  /**
   * Three independent filters, intersected:
   *   chips  — which groups are shown (none selected = all)
   *   scope  — restricts the text search to one group
   *   query  — the text itself
   */
  const filtered = useMemo(() => {
    if (!labels) return [];
    const q = query.trim().toLowerCase();
    return labels.filter((l) => {
      if (active.size > 0 && !active.has(groupOf(l))) return false;
      if (scope && l.groupId !== scope) return false;
      if (ready !== "all" && restStatus(l).status !== ready) return false;
      if (!q) return true;
      return [l.coffeeName, l.roaster, l.variety, l.origin, l.process, ...l.tastingNotes]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [labels, query, active, scope, ready, groupOf]);

  const readyCounts = useMemo(() => {
    const m = { peak: 0, resting: 0, past: 0 };
    (labels ?? []).forEach((l) => {
      const s = restStatus(l).status;
      if (s in m) m[s as keyof typeof m] += 1;
    });
    return m;
  }, [labels]);

  const toggleGroup = (id: string) => {
    const next = new Set(active);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saveGroups(next);
  };

  async function addGroup() {
    const name = prompt(tr("groupNamePrompt"))?.trim();
    if (!name) return;
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      alert(`${tr("aGroupCalled")} "${name}" ${tr("groupExists")}`);
      return;
    }
    setBusy(true);
    try {
      await store.saveGroup(emptyGroup(name, groups.length));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function exportBackup() {
    setBusy(true);
    try {
      const data = await store.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bean-label-backup-${data.exportedAt.slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setBusy(false);
    }
  }

  async function restoreBackup(file: File) {
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text());
      const { labels: l, groups: g } = await store.importBackup(parsed);
      await refresh();
      alert(
        `${tr("restoredWord")} ${l} ${tr("labelsWord")} · ${g} ${tr("groupsWord")}`,
      );
    } catch (err) {
      alert(`${tr("restoreFailed")} ${String(err)}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function moveToGroup(label: CoffeeLabel, groupId: string) {
    setMenu(null);
    if (label.groupId === groupId) return;
    setBusy(true);
    try {
      await store.saveLabel({ ...label, groupId });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeGroup(group: LabelGroup) {
    const n = counts.get(group.id) ?? 0;
    const msg = n
      ? `${tr("deleteGroupQ")} "${group.name}"? ${tr("deleteGroupKeep")} (${n})`
      : `${tr("deleteGroupQ")} "${group.name}"?`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await store.deleteGroup(group.id);
      const next = new Set(active);
      next.delete(group.id);
      saveGroups(next);
      if (scope === group.id) setScope("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createNew() {
    setBusy(true);
    try {
      const label = newLabel();
      await store.saveLabel(label);
      router.push(`/editor/${label.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function addSample() {
    setBusy(true);
    try {
      await store.saveLabel(sampleLabel());
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(label: CoffeeLabel) {
    setBusy(true);
    try {
      await store.saveLabel({
        ...label,
        id: uid(),
        coffeeName: `${labelTitle(label)} (copy)`,
        createdAt: new Date().toISOString(),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(label: CoffeeLabel) {
    if (!confirm(`${tr("deleteLabelQ")} "${labelTitle(label)}"? ${tr("cannotUndo")}`)) return;
    setBusy(true);
    try {
      await store.deleteLabel(label.id);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-4">
          <div className="mr-auto flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="font-serif text-xl leading-tight font-semibold">Bean Label</h1>
              <p className="text-xs text-muted">{tr("appTagline")}</p>
            </div>
          </div>
          <StorageBadge mode={mode} tr={tr} />
          <LangToggle />
          <button className="btn" onClick={addGroup} disabled={busy}>
            {tr("newGroup")}
          </button>
          <button className="btn btn-primary" onClick={createNew} disabled={busy}>
            {tr("newLabel")}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            className="input max-w-xs"
            placeholder={tr("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="select w-auto"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            title={tr("limitSearch")}
          >
            <option value="">{tr("searchAllGroups")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {tr("searchIn")} {g.name}
              </option>
            ))}
          </select>
          {labels && (
            <span className="text-xs text-muted">
              {filtered.length} {tr("ofLabels")} {labels.length} {tr("labelsWord")}
            </span>
          )}
        </div>

        {/* Which bags are actually drinkable today */}
        {labels && labels.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", tr("all"), labels.length],
                ["peak", tr("drinkingNow"), readyCounts.peak],
                ["resting", tr("resting"), readyCounts.resting],
                ["past", tr("pastPeak"), readyCounts.past],
              ] as const
            ).map(([key, text, count]) => {
              const on = ready === key;
              const color =
                key === "all" ? "var(--brand)" : REST_STATUS_META[key].color;
              return (
                <button
                  key={key}
                  onClick={() => setReady(key)}
                  aria-pressed={on}
                  className="rounded-full border px-3 py-1 text-xs font-semibold transition"
                  style={{
                    background: on ? color : "transparent",
                    borderColor: on ? color : "var(--line)",
                    color: on ? "#fff" : "var(--muted)",
                  }}
                >
                  {text} <span className="tabular-nums opacity-80">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {(groups.length > 0 || (counts.get(UNGROUPED) ?? 0) > 0) && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {groups.map((g) => (
              <GroupChip
                key={g.id}
                name={g.name}
                color={g.color}
                count={counts.get(g.id) ?? 0}
                on={active.has(g.id)}
                onToggle={() => toggleGroup(g.id)}
                onDelete={() => removeGroup(g)}
              />
            ))}
            {(counts.get(UNGROUPED) ?? 0) > 0 && (
              <GroupChip
                name={tr("ungrouped")}
                color="#8b7a68"
                count={counts.get(UNGROUPED) ?? 0}
                on={active.has(UNGROUPED)}
                onToggle={() => toggleGroup(UNGROUPED)}
              />
            )}
            {active.size > 0 && (
              <button
                className="btn btn-ghost text-xs"
                onClick={() => saveGroups([])}
              >
                {tr("clearFilter")}
              </button>
            )}
          </div>
        )}

        {labels === null && <p className="text-sm text-muted">{tr("loading")}</p>}

        {labels && labels.length === 0 && (
          <div className="panel flex flex-col items-center gap-4 px-6 py-16 text-center">
            <Logo big />
            <div>
              <h2 className="font-serif text-2xl font-semibold">{tr("noLabelsYet")}</h2>
              <p className="mt-1 max-w-md text-sm text-muted">
                {tr("emptyBlurb")}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={createNew} disabled={busy}>
                {tr("createFirst")}
              </button>
              <button className="btn" onClick={addSample} disabled={busy}>
                {tr("loadSample")}
              </button>
            </div>
          </div>
        )}

        {labels && labels.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((label) => (
              <article key={label.id} className="panel relative overflow-hidden">
                {/* The sticker already carries the name, roaster and dates, so the
                    card is just the sticker plus an action rail. */}
                <button
                  type="button"
                  className="block w-full cursor-zoom-in bg-card py-4 pl-4 pr-16 text-left"
                  onClick={() => setViewing(label)}
                  aria-label={`View ${labelTitle(label)}`}
                >
                  <StickerScaler
                    label={label}
                    preview
                    qrUrl={origin ? `${origin}/b/${label.id}` : undefined}
                  />
                </button>

                {(() => {
                  const r = restStatus(label);
                  if (r.status === "unknown") return null;
                  const meta = REST_STATUS_META[r.status];
                  return (
                    <span
                      className="absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.06em] text-white shadow-sm"
                      style={{ background: meta.color }}
                      title={`${meta.label} · day ${r.age} of ${r.from}–${r.to}`}
                    >
                      {r.status === "resting"
                        ? tr("daysToGoPre") + r.daysToPeak + tr("daysToGo")
                        : r.status === "peak"
                          ? tr("ready")
                          : tr("pastPeak")}
                    </span>
                  );
                })()}

                {/* Siblings of the thumbnail button — interactive elements cannot nest. */}
                <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
                  <Link
                    href={`/print/${label.id}`}
                    title={tr("printStickers")}
                    aria-label={`Print ${labelTitle(label)}`}
                    className={ACTION_CLS}
                  >
                    <PrinterIcon />
                  </Link>
                  <Link
                    href={`/b/${label.id}`}
                    title={tr("brewTimer")}
                    aria-label={`Brew timer for ${labelTitle(label)}`}
                    className={ACTION_CLS}
                  >
                    <TimerIcon />
                  </Link>
                  <Link
                    href={`/editor/${label.id}`}
                    title={tr("edit")}
                    aria-label={`Edit ${labelTitle(label)}`}
                    className={ACTION_CLS}
                  >
                    <PencilIcon />
                  </Link>
                  {(() => {
                    const g = groups.find((x) => x.id === label.groupId);
                    return (
                      <button
                        title={g ? `${tr("groupColon")} ${g.name}` : tr("moveToGroup")}
                        aria-label={`Move ${labelTitle(label)} to a group`}
                        className={ACTION_CLS}
                        style={g ? { color: g.color, borderColor: g.color } : undefined}
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setMenu({ label, x: r.right, y: r.bottom + 6 });
                        }}
                      >
                        <TagIcon />
                      </button>
                    );
                  })()}
                  <button
                    title={tr("duplicate")}
                    aria-label={`Duplicate ${labelTitle(label)}`}
                    className={ACTION_CLS}
                    onClick={() => duplicate(label)}
                    disabled={busy}
                  >
                    <CopyIcon />
                  </button>
                  <button
                    title={tr("del")}
                    aria-label={`Delete ${labelTitle(label)}`}
                    className={`${ACTION_CLS} hover:!border-[var(--danger)] hover:!text-[var(--danger)]`}
                    onClick={() => remove(label)}
                    disabled={busy}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Tucked at the foot of the page — needed, but not every day. */}
        {labels && (
          <footer className="mt-10 border-t border-line pt-4 text-xs text-muted">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-semibold uppercase tracking-[0.1em]">{tr("backup")}</span>
              <button
                className="underline underline-offset-2 hover:text-brand disabled:opacity-50"
                onClick={exportBackup}
                disabled={busy || !labels.length}
              >
                {tr("downloadCopy")}
              </button>
              <button
                className="underline underline-offset-2 hover:text-brand"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                {tr("restoreFile")}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void restoreBackup(f);
                }}
              />
              <span className="opacity-70">
                {tr("backupBlurb")}
              </span>
            </div>
          </footer>
        )}
      </main>

      {menu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenu(null)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="panel fixed z-50 w-52 overflow-hidden py-1 shadow-lg"
            style={{ left: menu.x, top: menu.y, transform: "translateX(-100%)" }}
          >
            <p className="truncate px-3 py-1.5 text-xs text-muted">
              {tr("moveToGroup")}
            </p>
            <GroupOption
              name={tr("noGroup")}
              color="#8b7a68"
              on={!menu.label.groupId}
              onSelect={() => moveToGroup(menu.label, "")}
            />
            {groups.map((g) => (
              <GroupOption
                key={g.id}
                name={g.name}
                color={g.color}
                on={menu.label.groupId === g.id}
                onSelect={() => moveToGroup(menu.label, g.id)}
              />
            ))}
            {groups.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted">
                No groups yet — create one with <b className="text-ink">+ Group</b>.
              </p>
            )}
          </div>
        </>
      )}

      {viewing && (
        <StickerViewer
          label={viewing}
          qrUrl={origin ? `${origin}/b/${viewing.id}` : undefined}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function StorageBadge({
  mode,
  tr,
}: {
  mode: StorageMode | null;
  tr: (key: MsgKey) => string;
}) {
  if (!mode) return null;
  const cloud = mode === "cloud";
  return (
    <span
      title={cloud ? tr("storageCloud") : tr("storageLocal")}
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-semibold"
      style={{ color: cloud ? "#2E6B4B" : "#8A5A2B" }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: cloud ? "#2E6B4B" : "#C89B4A" }}
      />
      {cloud ? tr("databaseWord") : tr("thisBrowser")}
    </span>
  );
}

/**
 * Pill-shaped group filter. Selected chips fill with the group colour; several
 * can be on at once and the library shows the union of them.
 */
function GroupChip({
  name,
  color,
  count,
  on,
  onToggle,
  onDelete,
}: {
  name: string;
  color: string;
  count: number;
  on: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  return (
    <span className="group/chip relative inline-flex">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        title={`${name} — ${count} label${count === 1 ? "" : "s"}`}
        className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition"
        style={{
          background: on ? color : "transparent",
          borderColor: on ? color : "var(--line)",
          color: on ? "#fff" : "var(--muted)",
        }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full border"
          style={{
            background: on ? "rgb(255 255 255 / 0.9)" : color,
            borderColor: on ? "rgb(255 255 255 / 0.9)" : color,
          }}
        />
        {name}
        <span
          className="rounded-full px-1.5 text-xs tabular-nums"
          style={{
            background: on ? "rgb(255 255 255 / 0.22)" : "var(--brand-soft)",
            color: on ? "#fff" : "var(--muted)",
          }}
        >
          {count}
        </span>
      </button>
      {onDelete && (
        /* Always visible — a hover-only control is unreachable on a phone. */
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete group ${name}`}
          title={`Delete group ${name}`}
          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-card text-xs leading-none text-muted shadow-sm transition hover:border-[var(--danger)] hover:bg-[var(--danger)] hover:text-white"
        >
          ✕
        </button>
      )}
    </span>
  );
}

const ACTION_CLS =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card text-muted shadow-sm transition hover:border-brand hover:text-brand disabled:opacity-40";

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function GroupOption({
  name,
  color,
  on,
  onSelect,
}: {
  name: string;
  color: string;
  on: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onSelect}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-soft"
      style={{ fontWeight: on ? 700 : 400 }}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <span className="truncate">{name}</span>
      {on && <span className="ml-auto text-brand">✓</span>}
    </button>
  );
}

function TagIcon() {
  return (
    <Svg>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2.6 12.6A2 2 0 0 1 2 11.2V4a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l8 8a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </Svg>
  );
}

function TimerIcon() {
  return (
    <Svg>
      <circle cx="12" cy="13.5" r="8" />
      <path d="M12 9.5v4l2.5 1.8" />
      <path d="M9.5 2.5h5" />
    </Svg>
  );
}

function PrinterIcon() {
  return (
    <Svg>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </Svg>
  );
}

function PencilIcon() {
  return (
    <Svg>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Svg>
  );
}

function CopyIcon() {
  return (
    <Svg>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

function TrashIcon() {
  return (
    <Svg>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}

function Logo({ big = false }: { big?: boolean }) {
  const s = big ? 44 : 32;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <g transform="rotate(-32 12 12)">
        <ellipse cx="12" cy="12" rx="6.6" ry="9.8" fill="#6f4423" />
        <path
          d="M12 3.2c-3 4.2-3 13.4 0 17.6"
          fill="none"
          stroke="#f6f2ec"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
