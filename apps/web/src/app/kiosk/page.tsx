"use client";

import Link from 'next/link';
import type { Salon } from '@salon/shared';
import { publicApi } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { Empty, ErrorBanner } from '@/components/ui';

export default function KioskSalonPicker() {
  const { data, error, loading } = useLoader<Salon[]>(
    () => publicApi<Salon[]>('/api/kiosk/salons'),
    [],
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Welcome — choose your salon</h1>
      <div className="mt-8 space-y-3">
        <ErrorBanner message={error} />
        {loading ? <p className="text-slate-500">Loading salons…</p> : null}
        {data?.length === 0 ? <Empty>No active salons yet.</Empty> : null}
        {data?.map((salon) => (
          <Link key={salon.id} href={`/kiosk/${salon.id}`} className="card block hover:border-ink">
            <p className="text-xl font-semibold">{salon.name}</p>
            <p className="text-sm text-slate-500">{salon.address ?? 'Walk-ins welcome'}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
