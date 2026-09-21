"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { TokenSummary } from '@shared/index';
import { publicApi } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { useSalonEvents } from '@/lib/socket';
import { money, statusLabel } from '@/lib/format';
import { ErrorBanner, StatusPill } from '@/components/ui';
import { Skeleton } from '@/components/ui/skeleton';

interface TokenView {
  token: TokenSummary;
  queuePosition: number | null;
  estimatedWaitMinutes: number;
}

export default function KioskTokenPage() {
  const params = useParams<{ tokenId: string }>();
  const { data, error, reload } = useLoader<TokenView>(
    () => publicApi<TokenView>(`/api/kiosk/tokens/${params.tokenId}`),
    [params.tokenId],
    15000,
  );
  useSalonEvents(data?.token.salonId, reload);

  const token = data?.token;

  return (
    <main className="kiosk-shell flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-lg animate-fade-in">
        <ErrorBanner message={error} />
        {token ? (
          <>
            <div className="kiosk-card print-area text-center animate-pop">
              <p className="kiosk-badge mx-auto">Your token</p>
              <p className="my-4 text-7xl font-extrabold tracking-tight text-brand-900">
                {token.tokenNumber}
              </p>
              <div className="flex justify-center">
                <StatusPill status={token.status} />
              </div>
              <dl className="mt-6 space-y-1 text-sm text-slate-600">
                {token.chairLabel ? (
                  <p className="text-base">
                    Chair <strong className="text-brand-700">{token.chairLabel}</strong>
                    {token.employeeName ? ` · ${token.employeeName}` : ''}
                  </p>
                ) : (
                  <p className="text-base">
                    Queue position{' '}
                    <strong className="text-accent-600">{data.queuePosition ?? '—'}</strong> ·
                    approx <strong className="text-accent-600">{data.estimatedWaitMinutes} min</strong>{' '}
                    wait
                  </p>
                )}
                <div className="mt-3 space-y-1 rounded-xl bg-brand-50 p-3">
                  {token.services.map((service) => (
                    <p key={service.serviceId} className="flex justify-between text-slate-600">
                      <span>{service.name}</span>
                      <span>{money(service.price)}</span>
                    </p>
                  ))}
                </div>
                <p className="pt-2 text-xl font-bold text-brand-900">
                  Total {money(token.totalPrice)}
                </p>
              </dl>
              <p className="mt-4 text-xs text-slate-500">
                Status: {statusLabel(token.status)} · keep this ticket until you pay at reception.
              </p>
            </div>

            <div className="no-print mt-6 flex gap-3">
              <button
                className="kiosk-btn-outline flex-1 !bg-white"
                onClick={() => window.print()}
                type="button"
              >
                Print ticket
              </button>
              <Link className="kiosk-btn-primary flex-1" href={`/kiosk/${token.salonId}`}>
                Done
              </Link>
            </div>
          </>
        ) : (
          <div className="kiosk-card animate-pulse space-y-4 text-center">
            <Skeleton className="mx-auto h-6 w-24" />
            <Skeleton className="mx-auto h-16 w-40" />
            <Skeleton className="mx-auto h-6 w-32" />
          </div>
        )}
      </div>
    </main>
  );
}
