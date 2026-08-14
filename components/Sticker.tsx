"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  type CoffeeLabel,
  ROAST_LEVELS,
  THEMES,
  bestBefore,
  daysSince,
  dialLabel,
  flavorColor,
  formatDate,
  formatDoseYield,
  formatTime,
  formatWeight,
  grinderOf,
  labelSize,
  ratioOf,
  restWindow,
  ribbonBlocks,
} from "@/lib/types";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Bounds for the auto-fit scale. The upper bound stops a nearly-empty label
 * from blowing its few words up to fill the whole sticker.
 */
const MIN_FIT = 0.3;
const MAX_FIT = 1.9;

function Bean({ filled, color }: { filled: boolean; color: string }) {
  return (
    <svg className="cl-bean" viewBox="0 0 24 24" aria-hidden="true">
      <g transform="rotate(-32 12 12)">
        <ellipse
          cx="12"
          cy="12"
          rx="6.6"
          ry="9.8"
          fill={filled ? color : "none"}
          stroke={color}
          strokeWidth="1.6"
        />
        <path
          d="M12 3.2c-3 4.2-3 13.4 0 17.6"
          fill="none"
          stroke={filled ? "rgba(255,255,255,0.85)" : color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * Tiny markers so the specs row reads as labelled values rather than a run of
 * numbers. Deliberately bold and simple — they have to survive printing at ~2 mm.
 */
function SpecIcon({ kind }: { kind: "temp" | "weight" | "ratio" | "time" }) {
  const common = {
    className: "cl-spec-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "temp") {
    return (
      <svg {...common}>
        <path d="M13.5 13.8V5.2a1.6 1.6 0 0 0-3.2 0v8.6a3.8 3.8 0 1 0 3.2 0Z" />
        <circle cx="11.9" cy="17.4" r="1.7" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === "weight") {
    return (
      <svg {...common}>
        <path d="M9.6 8.2a2.4 2.4 0 0 1 4.8 0" />
        <path d="M7 8.2h10l2 11.6H5L7 8.2Z" />
      </svg>
    );
  }
  if (kind === "ratio") {
    return (
      <svg {...common}>
        <rect x="3.5" y="12" width="6" height="8" rx="1.2" />
        <rect x="14.5" y="4.5" width="6" height="15.5" rx="1.2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12.5" r="8.2" />
      <path d="M12 7.6v5l3.1 2" />
    </svg>
  );
}

/** Burr icon marking the grinder badge. */
function BurrIcon() {
  return (
    <svg
      className="cl-grind-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.6v3M12 17.4v3M3.6 12h3M17.4 12h3" />
    </svg>
  );
}

/** Segmented roast scale with a marker on the selected level. */
function RoastScale({ level, accent, rule }: { level: number; accent: string; rule: string }) {
  return (
    <div className="cl-roast-scale" aria-label={`Roast level ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="cl-roast-seg"
          style={{
            background: n <= level ? accent : rule,
            opacity: n <= level ? 0.35 + n * 0.13 : 1,
          }}
        />
      ))}
      <span className="cl-roast-marker" style={{ left: `${(level - 0.5) * 20}%`, background: accent }} />
    </div>
  );
}

function Spec({
  icon,
  value,
}: {
  icon: "temp" | "weight" | "ratio" | "time";
  value: string;
}) {
  if (!value) return null;
  return (
    <span className="cl-spec">
      <SpecIcon kind={icon} />
      <b>{value}</b>
    </span>
  );
}

export default function Sticker({
  label,
  preview = false,
  qrUrl,
  className = "",
  style,
  variant = "full",
}: {
  label: CoffeeLabel;
  /** show greyed placeholders for empty fields */
  preview?: boolean;
  /** absolute URL the QR code should point at */
  qrUrl?: string;
  className?: string;
  style?: React.CSSProperties;
  /** "brew" drops the origin/notes/roast/footer blocks and prints only the recipes */
  variant?: "full" | "brew";
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string>("");

  const theme = THEMES[label.theme] ?? THEMES.espresso;
  const size = labelSize(label);
  const roast = ROAST_LEVELS[label.roastLevel] ?? ROAST_LEVELS[3];
  const layout = label.layout;
  const brewOnly = variant === "brew";

  useEffect(() => {
    if (!label.showQr || !qrUrl) return;
    let cancelled = false;
    QRCode.toDataURL(qrUrl, {
      margin: 0,
      width: 320,
      errorCorrectionLevel: "M",
      color: { dark: theme.ink, light: "#0000" },
    })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [label.showQr, qrUrl, theme.ink]);

  /**
   * Scale the content block so it exactly fills the sticker — shrinking when
   * there is too much, and enlarging when a short label would otherwise leave
   * the bottom half blank. Runs after every render (purely imperative and
   * idempotent) plus on resize and once fonts have loaded.
   */
  useIsoLayoutEffect(() => {
    const frame = frameRef.current;
    const fit = fitRef.current;
    if (!frame || !fit) return;

    const apply = (s: number) => {
      // Width is compensated so `width * scale` always equals the frame width.
      const untouched = Math.abs(s - 1) < 0.002;
      fit.style.transform = untouched ? "none" : `scale(${s})`;
      fit.style.width = untouched ? "100%" : `${100 / s}%`;
    };

    const clamp = (s: number) => Math.max(MIN_FIT, Math.min(MAX_FIT, s));

    /**
     * The specs row must never wrap. Rather than shrinking the whole sticker to
     * make it fit — which would leave the label half empty — only that row is
     * scaled down, and only when it is actually too wide.
     */
    const fitSpecsRows = () => {
      fit.querySelectorAll<HTMLElement>(".cl-specs").forEach((row) => {
        row.style.setProperty("--specs-fit", "1");
        const available = row.clientWidth;
        const needed = row.scrollWidth;
        if (available > 0 && needed > available + 0.5) {
          row.style.setProperty(
            "--specs-fit",
            String(Math.max(0.4, available / needed)),
          );
        }
      });
    };

    /**
     * The roast beans and their label can't wrap either. Shrink that group by
     * exactly the overflow rather than the whole sticker.
     */
    const fitRoastGroup = () => {
      const head = fit.querySelector<HTMLElement>(".cl-head");
      const roast = head?.querySelector<HTMLElement>(".cl-roast");
      if (!head || !roast) return;
      roast.style.setProperty("--roast-fit", "1");
      const over = head.scrollWidth - head.clientWidth;
      const width = roast.getBoundingClientRect().width;
      if (over > 0.5 && width > 0) {
        roast.style.setProperty(
          "--roast-fit",
          String(Math.max(0.4, (width - over) / width)),
        );
      }
    };

    const fitRows = () => {
      fitSpecsRows();
      fitRoastGroup();
    };

    const measure = () => {
      const cs = getComputedStyle(frame);
      const avail =
        frame.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (avail <= 0) return;

      // Changing the scale also changes how the text wraps, so a single pass
      // always overshoots. Iterate to a fixed point for a tight fit. Later
      // passes are damped, otherwise a big swing can settle into a 2-cycle
      // and never converge (most visible on tall formats like A6).
      // The global scale is driven purely by height, so the content always
      // fills the label however many brew methods it has.
      let s = 1;
      for (let i = 0; i < 8; i++) {
        apply(s);
        fitRows();
        const natural = fit.scrollHeight;
        if (natural <= 0) break;
        const target = clamp(avail / natural);
        if (Math.abs(target - s) < 0.004) {
          s = target;
          break;
        }
        s = i < 2 ? target : clamp((s + target) / 2);
      }

      // Guarantee the final state fits, whatever the iteration converged on.
      apply(s);
      fitRows();
      const finalNatural = fit.scrollHeight;
      if (finalNatural * s > avail) {
        s = clamp(avail / finalNatural);
        apply(s);
        fitRows();
      }

      // Backstop: if some row still can't be squeezed, shrink the whole block
      // rather than let anything be clipped at the edge.
      if (fit.scrollWidth > fit.clientWidth + 0.5) {
        apply(clamp(s * (fit.clientWidth / fit.scrollWidth)));
        fitRows();
      }
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    return () => ro.disconnect();
  });

  const ph = (value: string, placeholder: string) =>
    value ? (
      <>{value}</>
    ) : preview ? (
      <span className="cl-placeholder">{placeholder}</span>
    ) : null;

  // Altitude is kept out of the joined line — it gets a line of its own.
  const originBits = [label.variety, label.process, label.origin].filter(Boolean);
  const altitude = (label.altitude ?? "").trim();
  const brews = label.brews.filter(
    (b) => b.name || b.waterTempC || b.doseG || b.steps.some((s) => s.text),
  );
  const bb = bestBefore(label.roastDate, label.bestBeforeDays);
  const rest = restWindow(label);
  const age = daysSince(label.roastDate);

  // The rest track spans 0 → (window end + 50%), so the peak block sits in the
  // middle third and there is visible room after it.
  const restSpan = Math.max(rest.to * 1.5, rest.to + 7);
  const restBar = {
    startPct: (rest.from / restSpan) * 100,
    widthPct: ((rest.to - rest.from) / restSpan) * 100,
    markerPct:
      age !== null && age >= 0 ? Math.min(100, (age / restSpan) * 100) : null,
  };

  return (
    <div
      ref={frameRef}
      className={`cl-frame ${className}`}
      style={
        {
          "--lw": `${size.w}mm`,
          "--lh": `${size.h}mm`,
          "--cl-ink": theme.ink,
          "--cl-accent": theme.accent,
          "--cl-paper": theme.paper,
          "--cl-muted": theme.muted,
          "--cl-rule": theme.rule,
          ...style,
        } as React.CSSProperties
      }
    >
      <div ref={fitRef} className="cl-fit">
        {!brewOnly && (
          <div className="cl-head">
            <div className="cl-roaster">{ph(label.roaster, "Roaster name")}</div>
            <div className="cl-roast">
              {label.roastDisplay === "scale" ? (
                <RoastScale level={label.roastLevel} accent={theme.accent} rule={theme.rule} />
              ) : (
                <div className="cl-beans">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Bean key={n} filled={n <= label.roastLevel} color={theme.accent} />
                  ))}
                </div>
              )}
              <span className="cl-roast-name">{roast.name}</span>
            </div>
          </div>
        )}

        <h1 className="cl-name">{ph(label.coffeeName, "Coffee name")}</h1>

        {!brewOnly && (originBits.length > 0 || altitude || preview) && (
          <div className="cl-origin">
            {originBits.length
              ? originBits.map((bit, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    <b>{bit}</b>
                  </span>
                ))
              : !altitude && (
                  <span className="cl-placeholder">Variety · Process · Origin</span>
                )}
            {altitude && (
              <span className="cl-altitude">
                <b>{altitude}</b>
              </span>
            )}
          </div>
        )}

        {!brewOnly && label.tastingNotes.length > 0 && (
          <div className="cl-notes">
            {label.tastingNotes.map((note) => (
              <span key={note} className="cl-note">
                <span className="cl-note-dot" style={{ background: flavorColor(note) }} />
                {note}
              </span>
            ))}
          </div>
        )}

        {(brews.length > 0 || preview) && <div className="cl-rule" />}

        {brews.length > 0 && (
          <div className="cl-brews">
            <div className="cl-brews-label">Brew Guide</div>
            {brews.map((brew) => {
              const steps = brew.steps.filter((s) => s.text.trim());
              const grinder = grinderOf(brew);
              const dial = dialLabel(brew);
              const ribbon = layout === "ribbon" ? ribbonBlocks(brew) : [];
              return (
                <div key={brew.id} className="cl-brew">
                  <div className="cl-brew-head">
                    <span className="cl-brew-name">{brew.name || "Method"}</span>
                    <span className="cl-specs">
                      <Spec
                        icon="temp"
                        value={brew.waterTempC ? `${brew.waterTempC}°C` : ""}
                      />
                      <Spec
                        icon="weight"
                        value={formatDoseYield(brew.doseG, brew.yieldG)}
                      />
                      <Spec icon="ratio" value={ratioOf(brew)} />
                      <Spec icon="time" value={formatTime(brew.totalTime)} />
                    </span>
                  </div>
                  {(grinder.name || dial) && (
                    <div className="cl-grind">
                      <span className="cl-grind-label">
                        <BurrIcon />
                        Grind
                      </span>
                      <span>
                        {grinder.name && <b>{grinder.name}</b>}
                        {grinder.name && dial && " · "}
                        {dial && <b>{dial}</b>}
                      </span>
                    </div>
                  )}

                  {ribbon.length > 0 && (
                    <div className="cl-ribbon" aria-label="Pour timeline">
                      <div className="cl-ribbon-track">
                        {ribbon.map((b, i) => (
                          <div
                            key={b.id}
                            className="cl-ribbon-block"
                            style={{
                              width: `${b.share * 100}%`,
                              background: theme.accent,
                              // each pour a shade lighter than the last
                              opacity: 0.45 + (i / Math.max(1, ribbon.length - 1)) * 0.55,
                            }}
                          >
                            <span className="cl-ribbon-total">{b.totalG}</span>
                          </div>
                        ))}
                      </div>
                      <div className="cl-ribbon-track cl-ribbon-times">
                        {ribbon.map((b) => (
                          <span key={b.id} style={{ width: `${b.share * 100}%` }}>
                            {b.at}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ribbon mode falls back to the numbered list for any method
                      that has no cumulative water to plot. */}
                  {(layout === "full" || (layout === "ribbon" && ribbon.length === 0)) &&
                    steps.length > 0 && (
                    <ol className="cl-steps">
                      {steps.map((step, i) => (
                        <li key={step.id} className="cl-step">
                          <span className="cl-step-n">{i + 1}.</span>
                          <span>{step.text}</span>
                          {step.at && (
                            <span className="cl-step-at">{formatTime(step.at)}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!brewOnly && label.showRest && label.roastDate && (
          <>
            <div className="cl-rule" />
            <div className="cl-rest">
              <div className="cl-rest-head">
                <span className="cl-rest-label">Peak window</span>
                <span className="cl-rest-value">
                  Day <b>{rest.from}</b>–<b>{rest.to}</b>
                  {age !== null && age >= 0 && (
                    <>
                      {" · "}
                      <b>{age}d</b> rested
                    </>
                  )}
                </span>
              </div>
              <div className="cl-rest-track">
                <span
                  className="cl-rest-window"
                  style={{
                    left: `${restBar.startPct}%`,
                    width: `${restBar.widthPct}%`,
                    background: theme.accent,
                  }}
                />
                {restBar.markerPct !== null && (
                  <span
                    className="cl-rest-marker"
                    style={{ left: `${restBar.markerPct}%`, background: theme.ink }}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {!brewOnly && label.showDoseBoxes && label.doseBoxes > 0 && (
          <div className="cl-doses">
            <span className="cl-doses-label">Doses</span>
            <span className="cl-doses-row">
              {Array.from({ length: Math.min(12, label.doseBoxes) }, (_, i) => (
                <span key={i} className="cl-dose-box" style={{ borderColor: theme.muted }} />
              ))}
            </span>
          </div>
        )}

        {!brewOnly && (
          <>
            <div className="cl-rule" />

            <div className="cl-foot">
              {/* Separate spans, each nowrap: a line break can only fall
                  between facts, never inside "Best before" or a date. */}
              <div className="cl-foot-meta">
                {label.roastDate && (
                  <span>
                    Roasted <b>{formatDate(label.roastDate)}</b>
                  </span>
                )}
                {bb && (
                  <span>
                    Best before <b>{formatDate(bb)}</b>
                  </span>
                )}
                {label.netWeight && (
                  <span>
                    Net <b>{formatWeight(label.netWeight)}</b>
                  </span>
                )}
              </div>
              {label.showQr && qr && (
                // A locally-generated data URL — next/image would only add overhead.
                // eslint-disable-next-line @next/next/no-img-element
                <img className="cl-qr" src={qr} alt="Brew guide QR code" />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
