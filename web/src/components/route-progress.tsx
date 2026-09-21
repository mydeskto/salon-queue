"use client";

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Top-of-page navigation progress bar (à la YouTube/GitHub). Next.js App
 * Router has no "navigation started" event, so this listens for clicks on
 * same-origin, non-modified left-clicks on <a> tags (what next/link
 * renders) to start the bar immediately, and treats a pathname/search
 * change as "navigation finished" to complete and hide it.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const growTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigatingRef = useRef(false);

  // Start the bar on link clicks.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return; // left click only
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement)?.closest('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const samePage =
        url.pathname === window.location.pathname && url.search === window.location.search;
      if (samePage) return;

      start();
    }

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Consider navigation finished whenever the route actually changes.
  useEffect(() => {
    if (navigatingRef.current) {
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  function start() {
    navigatingRef.current = true;
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    if (growTimer.current) clearInterval(growTimer.current);

    setVisible(true);
    setProgress(12);

    // Creep toward ~85% while waiting on the actual navigation, so slow
    // routes still show forward motion instead of sitting still.
    growTimer.current = setInterval(() => {
      setProgress((current) => (current < 85 ? current + (85 - current) * 0.1 : current));
    }, 200);
  }

  function finish() {
    navigatingRef.current = false;
    if (growTimer.current) clearInterval(growTimer.current);
    setProgress(100);
    hideTimeout.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 200);
  }

  useEffect(() => {
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
      if (growTimer.current) clearInterval(growTimer.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[100] h-1 bg-transparent"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }}
    >
      <div
        className="h-full bg-gradient-to-r from-brand-600 to-accent-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]"
        style={{
          width: `${progress}%`,
          transition: 'width 200ms ease-out',
        }}
      />
    </div>
  );
}
