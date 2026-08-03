"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  type CoffeeLabel,
  ROAST_LEVELS,
  SIZES,
  THEMES,
  bestBefore,
  formatDate,
  ratioOf,
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

function Spec({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <span className="cl-spec">
      {label ? `${label} ` : ""}
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
  const size = SIZES[label.size] ?? SIZES["100x70"];
  const roast = ROAST_LEVELS[label.roastLevel] ?? ROAST_LEVELS[3];
  const compact = label.layout === "compact";
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

    const measure = () => {
      const cs = getComputedStyle(frame);
      const avail =
        frame.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (avail <= 0) return;

      // Changing the scale also changes how the text wraps, so a single pass
      // always overshoots. Iterate to a fixed point for a tight fit. Later
      // passes are damped, otherwise a big swing can settle into a 2-cycle
      // and never converge (most visible on tall formats like A6).
      let s = 1;
      for (let i = 0; i < 8; i++) {
        apply(s);
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
      const finalNatural = fit.scrollHeight;
      if (finalNatural * s > avail) {
        apply(clamp(avail / finalNatural));
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

  const originBits = [label.variety, label.process, label.origin, label.altitude].filter(
    Boolean,
  );
  const brews = label.brews.filter(
    (b) => b.name || b.waterTempC || b.doseG || b.steps.some((s) => s.text),
  );
  const bb = bestBefore(label.roastDate, label.bestBeforeDays);

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
              <div className="cl-beans">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Bean key={n} filled={n <= label.roastLevel} color={theme.accent} />
                ))}
              </div>
              <span className="cl-roast-name">{roast.name}</span>
            </div>
          </div>
        )}

        <h1 className="cl-name">{ph(label.coffeeName, "Coffee name")}</h1>

        {!brewOnly && (originBits.length > 0 || preview) && (
          <div className="cl-origin">
            {originBits.length ? (
              originBits.map((bit, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  <b>{bit}</b>
                </span>
              ))
            ) : (
              <span className="cl-placeholder">Variety · Process · Origin</span>
            )}
          </div>
        )}

        {!brewOnly && label.tastingNotes.length > 0 && (
          <div className="cl-notes">{label.tastingNotes.join("  ·  ")}</div>
        )}

        {(brews.length > 0 || preview) && <div className="cl-rule" />}

        {brews.length > 0 && (
          <div className="cl-brews">
            <div className="cl-brews-label">Brew Guide</div>
            {brews.map((brew) => {
              const steps = brew.steps.filter((s) => s.text.trim());
              return (
                <div key={brew.id} className="cl-brew">
                  <div className="cl-brew-head">
                    <span className="cl-brew-name">{brew.name || "Method"}</span>
                    <span className="cl-specs">
                      <Spec label="" value={brew.waterTempC ? `${brew.waterTempC}°C` : ""} />
                      <Spec
                        label=""
                        value={
                          brew.doseG && brew.yieldG
                            ? `${brew.doseG}→${brew.yieldG} g`
                            : brew.doseG
                              ? `${brew.doseG} g`
                              : ""
                        }
                      />
                      <Spec label="" value={ratioOf(brew)} />
                      <Spec label="" value={brew.totalTime} />
                    </span>
                  </div>
                  {(brew.grinder || brew.grind) && (
                    <div className="cl-grind">
                      <span className="cl-grind-label">Grind</span>
                      <span>
                        {brew.grinder && <b>{brew.grinder}</b>}
                        {brew.grinder && brew.grind && " · "}
                        {brew.grind && <b>{brew.grind}</b>}
                      </span>
                    </div>
                  )}
                  {!compact && steps.length > 0 && (
                    <ol className="cl-steps">
                      {steps.map((step, i) => (
                        <li key={step.id} className="cl-step">
                          <span className="cl-step-n">{i + 1}.</span>
                          <span>{step.text}</span>
                          {step.at && <span className="cl-step-at">{step.at}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!brewOnly && (
          <>
            <div className="cl-rule" />

            <div className="cl-foot">
              <div className="cl-foot-meta">
                {label.roastDate && (
                  <span>
                    Roasted <b>{formatDate(label.roastDate)}</b>
                    {bb && <> · Best before <b>{formatDate(bb)}</b></>}
                  </span>
                )}
                {label.netWeight && (
                  <span>
                    Net <b>{label.netWeight}</b>
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
