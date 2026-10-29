"use client";

import { useCallback, useEffect, useRef } from "react";
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

/** Sheets open on top of a page; while any is, Back closes it instead. */
let sheetsOpen = 0;

/**
 * Lets the device Back button close a sheet laid over a page, instead of
 * leaving the page. A spare history entry gives Back something to pop; the
 * returned function closes the sheet the same way, so no dead entry is left
 * behind for the next Back to swallow.
 */
export function useBackClosesSheet(onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const pushed = useRef(false);
  useEffect(() => {
    // A ref, for the same reason as below: in development the effect runs
    // twice on one instance, and two entries would take two presses of Back.
    if (!pushed.current) {
      pushed.current = true;
      window.history.pushState(null, "");
    }
    sheetsOpen += 1;
    const onPop = () => closeRef.current();
    window.addEventListener("popstate", onPop);
    return () => {
      sheetsOpen -= 1;
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  return useCallback(() => window.history.back(), []);
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
      // That Back was for the sheet on top, which closes itself.
      if (sheetsOpen > 0) return;
      window.location.href = backTarget ?? "/";
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [pathname]);

  return null;
}
