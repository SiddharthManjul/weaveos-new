"use client";

// Client-side route transition loader. Next.js's App Router doesn't expose
// `routeChangeStart`/`routeChangeComplete` events (the way the Pages Router
// did), so we approximate it: intercept every same-origin <a> click that
// looks like a real navigation, show the logo overlay, and hide once the
// pathname actually changes (or after a short safety timeout).
//
// This is purely UX polish — the navigation itself uses native <Link> or
// router.push() as before; we just paint a brief loading state on top.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { LogoLoader } from "@/components/LogoLoader";

const SAFETY_TIMEOUT_MS = 2000;
const MIN_VISIBLE_MS = 280; // avoid flashes on instant navs

export function RouteTransitionLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const safetyRef = useRef<number | null>(null);
  const lastPathRef = useRef(pathname);

  // Show loader when a click looks like internal nav to a different path.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Walk up to find the anchor (Link renders an <a>).
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      // Skip external, hash-only, mailto, tel, javascript:, downloads.
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("//") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        href.startsWith("#") ||
        anchor.hasAttribute("download") ||
        anchor.target === "_blank"
      ) {
        return;
      }
      // Skip navigation to the same path.
      const url = new URL(href, window.location.origin);
      if (url.pathname === window.location.pathname) return;

      startedAtRef.current = performance.now();
      setVisible(true);
      // Safety timeout in case the pathname never updates (e.g. nav cancelled).
      if (safetyRef.current) window.clearTimeout(safetyRef.current);
      safetyRef.current = window.setTimeout(() => {
        setVisible(false);
        startedAtRef.current = null;
      }, SAFETY_TIMEOUT_MS);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Hide loader when pathname actually changes (i.e. the nav completed).
  useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    if (!visible) return;
    const started = startedAtRef.current ?? performance.now();
    const elapsed = performance.now() - started;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const t = window.setTimeout(() => {
      setVisible(false);
      startedAtRef.current = null;
      if (safetyRef.current) {
        window.clearTimeout(safetyRef.current);
        safetyRef.current = null;
      }
    }, remaining);
    return () => window.clearTimeout(t);
  }, [pathname, visible]);

  if (!visible) return null;
  return <LogoLoader fullscreen size={56} label="Loading" />;
}
