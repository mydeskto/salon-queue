"use client";

import Link from 'next/link';
import type { Salon } from '@shared/index';
import { publicApi } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { ErrorBanner } from '@/components/ui';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Salon picker — only used to preview/demo salons. A real kiosk tablet is
 * signed in with a "kiosk screen" login (see Admin → Staff & kiosk screens)
 * which sends staff straight to /kiosk/[salonId] and never shows this page.
 */
export default function KioskSalonPicker() {
  const { data, error, loading } = useLoader<Salon[]>(
    () => publicApi<Salon[]>('/api/kiosk/salons'),
    [],
  );

  return (
    <main className="kiosk-shell flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-3xl animate-fade-in">
        <p className="kiosk-badge">Preview mode</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Choose a salon to preview</h1>
        <p className="mt-2 max-w-xl text-white/70">
          This picker is for demos only. Each salon&apos;s own kiosk tablet signs in once with its
          screen login and opens straight to check-in — no picker, no distractions.
        </p>

        <div className="mt-10 space-y-3">
          <ErrorBanner message={error} />
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full bg-white/10" />
              <Skeleton className="h-20 w-full bg-white/10" />
            </div>
          ) : null}
          {data?.length === 0 ? (
            <div className="kiosk-panel text-center text-white/70">No active salons yet.</div>
          ) : null}
          {data?.map((salon) => (
            <Link
              key={salon.id}
              href={`/kiosk/${salon.id}`}
              className="kiosk-card group flex items-center justify-between gap-4 hover:shadow-2xl"
            >
              <div>
                <p className="text-xl font-bold text-brand-900">{salon.name}</p>
                <p className="text-sm text-slate-500">{salon.address ?? 'Walk-ins welcome'}</p>
              </div>
              <span className="kiosk-btn-outline shrink-0 !py-2 !px-4 text-sm group-hover:bg-brand-600 group-hover:text-white">
                Open →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
