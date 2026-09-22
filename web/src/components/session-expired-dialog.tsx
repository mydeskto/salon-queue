"use client";

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

const COUNTDOWN_SECONDS = 5;

/**
 * Shown once an authenticated request comes back 401 (the httpOnly session
 * cookie expired or was invalidated). Not built on top of the shared Dialog
 * primitive on purpose — that one allows Escape/overlay-click/X to dismiss,
 * and this dialog must not be dismissible; the session is already gone, so
 * the only thing to do is count down and log the user out.
 */
export function SessionExpiredDialog({ onExpire }: { onExpire: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpire();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, onExpire]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-description"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
    >
      <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-background p-6 text-center shadow-lg">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <h2 id="session-expired-title" className="mt-4 text-lg font-semibold tracking-tight">
          Session expired
        </h2>
        <p id="session-expired-description" className="mt-1 text-sm text-muted-foreground">
          You&rsquo;ve been signed out for your security. Redirecting to login in{' '}
          <span className="font-semibold text-foreground">{secondsLeft}</span>
          {secondsLeft === 1 ? ' second' : ' seconds'}…
        </p>
      </div>
    </div>
  );
}
