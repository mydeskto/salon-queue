"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { TokenSummary } from '@salon/shared';
import { publicApi } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { useSalonEvents } from '@/lib/socket';
import { money, statusLabel } from '@/lib/format';
import { ErrorBanner, StatusPill } from '@/components/ui';

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
    <main className="mx-auto max-w-lg px-6 py-10">
      <ErrorBanner message={error} />
      {token ? (
        <>
          <div className="card print-area text-center">
            <p className="text-sm uppercase tracking-widest text-slate-500">Your token</p>
            <p className="my-3 text-6xl font-bold tracking-tight">{token.tokenNumber}</p>
            <div className="flex justify-center">
              <StatusPill status={token.status} />
            </div>
            <dl className="mt-6 space-y-1 text-sm">
              {token.chairLabel ? (
                <p>
                  Chair <strong>{token.chairLabel}</strong>
                  {token.employeeName ? ` · ${token.employeeName}` : ''}
                </p>
              ) : (
                <p>
                  Queue position <strong>{data.queuePosition ?? '—'}</strong> · approx{' '}
                  <strong>{data.estimatedWaitMinutes} min</strong> wait
                </p>
              )}
              {token.services.map((service) => (
                <p key={service.serviceId} className="text-slate-600">
                  {service.name} — {money(service.price)}
                </p>
              ))}
              <p className="pt-2 text-base font-semibold">Total {money(token.totalPrice)}</p>
            </dl>
            <p className="mt-4 text-xs text-slate-500">
              Status: {statusLabel(token.status)} · keep this ticket until you pay at reception.
            </p>
          </div>

          <div className="no-print mt-6 flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => window.print()} type="button">
              Print ticket
            </button>
            <Link className="btn-primary flex-1" href={`/kiosk/${token.salonId}`}>
              Done
            </Link>
          </div>
        </>
      ) : (
        <p className="text-slate-500">Loading token…</p>
      )}
    </main>
  );
}
