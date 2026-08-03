"use client";

import { useState } from "react";

/**
 * The absolute site origin, for building QR-code targets.
 * Empty during SSR — rendered output never depends on it directly, so this
 * cannot cause a hydration mismatch.
 */
export function useOrigin(): string {
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin,
  );
  return origin;
}
