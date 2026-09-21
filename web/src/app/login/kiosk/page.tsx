"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, MonitorSmartphone } from 'lucide-react';
import type { AuthResponse } from '@shared/index';
import { api } from '@/lib/api';
import { homeFor } from '@/lib/auth';
import { ErrorBanner } from '@/components/ui';

export default function KioskPairingPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<AuthResponse>('/api/auth/kiosk/redeem', {
        method: 'POST',
        body: { code },
        auth: false,
      });
      // router.push() only queues the navigation — it doesn't guarantee the
      // route change happens before this function returns, and the finally
      // below would otherwise flip the button back on mid-navigation. Leave
      // `busy` true on success; the page is about to unmount anyway.
      router.push(homeFor(result.user));
      return;
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="kiosk-shell flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm animate-fade-in text-center">
        <Link
          href="/login"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
          <MonitorSmartphone className="h-7 w-7 text-white" />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-white">Pair this screen</h1>
        <p className="mt-2 text-sm text-white/70">
          Ask the salon admin for a pairing code from their Staff &amp; kiosk screens page, then
          enter it below.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5 text-left">
          <ErrorBanner message={error} />
          <div>
            <label
              htmlFor="code"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/60"
            >
              Pairing code
            </label>
            <input
              id="code"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="ABC123"
              className="kiosk-input text-center text-2xl font-bold uppercase tracking-[0.3em]"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={6}
              required
            />
          </div>
          <button
            className="kiosk-btn-primary w-full text-base"
            type="submit"
            disabled={busy || code.length < 6}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Pairing…
              </>
            ) : (
              'Pair screen'
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
