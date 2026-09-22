"use client";

import { createContext, useContext, useEffect } from 'react';

/**
 * By default the (app) shell centers page content at max-w-7xl. A page that
 * needs the full window width (e.g. a wide data table) calls useFullWidth()
 * to opt out for as long as it's mounted — no need to touch every other
 * page's layout to support the one that's different.
 */
const FullWidthContext = createContext<((value: boolean) => void) | null>(null);

export function FullWidthProvider({
  children,
  setFullWidth,
}: {
  children: React.ReactNode;
  setFullWidth: (value: boolean) => void;
}) {
  return <FullWidthContext.Provider value={setFullWidth}>{children}</FullWidthContext.Provider>;
}

export function useFullWidthPage(): void {
  const setFullWidth = useContext(FullWidthContext);
  useEffect(() => {
    setFullWidth?.(true);
    // Page components remount on navigation (they're keyed by route), so
    // this cleanup reliably flips it back off before the next page mounts
    // — no dependency on effect ordering between layout and page.
    return () => setFullWidth?.(false);
  }, [setFullWidth]);
}
