"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Makes the device Back button return to the library from anywhere in the app.
 *
 * Without this, Back walks the history stack — library → editor → print → brew
 * guide means several presses to get home.
 *
 * Two parts:
 *  - a spare history entry per page, so Back has something to pop even when the
 *    page was opened directly from a QR scan and there is nothing behind it;
 *  - a popstate handler that sends you home instead of wherever Back aimed.
 *
 * The "already pushed" guard is a ref rather than a flag on history.state,
 * because Next replaces that state for its own bookkeeping and the flag does
 * not survive. A full navigation is used rather than router.push so it cannot
 * race the router's own popstate handling.
 */
/** Where Back goes instead of the library, while a page asks for it. */
let backTarget: string | null = null;

/**
 * Sends the device Back button to `href` instead of the library for as long as
 * the calling page is mounted — the editor uses it to return to the brew guide
 * it was opened from. `null` leaves Back going home.
 */
export function useBackTarget(href: string | null) {
  useEffect(() => {
    backTarget = href;
    return () => {
      if (backTarget === href) backTarget = null;
    };
  }, [href]);
}

export default function BackToHome() {
  const pathname = usePathname();
  const pushedFor = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === "/") {
      pushedFor.current = null;
      return;
    }

    if (pushedFor.current !== pathname) {
      pushedFor.current = pathname;
      window.history.pushState(null, "");
    }

    const onPop = () => {
      window.location.href = backTarget ?? "/";
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [pathname]);

  return null;
}
