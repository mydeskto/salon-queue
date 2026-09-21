"use client";

import { useState } from 'react';
import Link from 'next/link';
import type { Chair, KioskSalonInfo, TokenStatus, TokenSummary } from '@salon/shared';
import { api, publicApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLoader } from '@/lib/usePolling';
import { useSalonEvents } from '@/lib/socket';
import { clockTime, minutesSince, money } from '@/lib/format';
import { Empty, ErrorBanner, Section, StatusPill } from '@/components/ui';

interface ShiftSummary {
  billCount: number;
  revenue: string;
  tokensToday: number;
}

export default function ReceptionPage() {
  const { user } = useAuth();
  const salonId = user?.salonId ?? null;
  const [error, setError] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const tokens = useLoader<TokenSummary[]>(
    () => api<TokenSummary[]>('/api/tokens', { query: { salonId: salonId ?? undefined } }),
    [salonId],
    30000,
  );
  const chairs = useLoader<Chair[]>(
    () => api<Chair[]>('/api/chairs', { query: { salonId: salonId ?? undefined } }),
    [salonId],
  );
  const shift = useLoader<ShiftSummary>(() => api<ShiftSummary>('/api/reports/my-shift'), []);

  useSalonEvents(salonId, () => {
    tokens.reload();
    chairs.reload();
    shift.reload();
  });

  async function move(token: TokenSummary, status: TokenStatus) {
    setError(null);
    try {
      await api(`/api/tokens/${token.id}/status`, { method: 'PATCH', body: { status } });
      tokens.reload();
      chairs.reload();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function assign(token: TokenSummary, chairId: string) {
    setError(null);
    try {
      await api(`/api/tokens/${token.id}/assign`, { method: 'POST', body: { chairId } });
      tokens.reload();
      chairs.reload();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function freeChair(chairId: string) {
    setError(null);
    try {
      await api(`/api/chairs/${chairId}/free`, { method: 'POST' });
      tokens.reload();
      chairs.reload();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  const list = tokens.data ?? [];
  const waiting = list.filter((token) => token.status === 'waiting');
  const inService = list.filter((token) => token.status === 'in_service');
  const awaiting = list.filter((token) => token.status === 'awaiting_payment');
  const freeChairs = (chairs.data ?? []).filter((chair) => chair.status === 'free');

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Live queue</h1>
        <button className="btn-primary" type="button" onClick={() => setWalkInOpen((v) => !v)}>
          {walkInOpen ? 'Close walk-in' : 'New walk-in'}
        </button>
      </div>
      <ErrorBanner message={error ?? tokens.error} />

      {walkInOpen && salonId ? (
        <WalkInForm
          salonId={salonId}
          onCreated={() => {
            setWalkInOpen(false);
            tokens.reload();
            chairs.reload();
          }}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Waiting" value={String(waiting.length)} />
        <SummaryCard label="In service" value={String(inService.length)} />
        <SummaryCard label="Free chairs" value={String(freeChairs.length)} />
        <SummaryCard
          label="Billed this shift"
          value={money(shift.data?.revenue ?? '0')}
          hint={`${shift.data?.billCount ?? 0} bill(s)`}
        />
      </div>

      <Section title="Chairs">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(chairs.data ?? []).map((chair) => (
            <div key={chair.id} className="card">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{chair.label}</p>
                <StatusPill status={chair.status} />
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {chair.currentTokenNumber
                  ? `${chair.currentTokenNumber} · ${chair.currentEmployeeName ?? 'unassigned'}`
                  : 'Empty'}
              </p>
              {chair.status === 'occupied' ? (
                <button
                  className="btn-secondary mt-2 w-full"
                  type="button"
                  onClick={() => freeChair(chair.id)}
                >
                  Force free
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Awaiting payment (${awaiting.length})`}>
        {awaiting.length === 0 ? <Empty>Nothing to bill right now.</Empty> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {awaiting.map((token) => (
            <div key={token.id} className="card flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">{token.tokenNumber}</p>
                <p className="text-sm text-slate-600">
                  {token.customerName ?? 'Walk-in'} · {money(token.totalPrice)}
                </p>
              </div>
              <Link className="btn-primary" href={`/reception/checkout/${token.id}`}>
                Checkout
              </Link>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`In service (${inService.length})`}>
        {inService.length === 0 ? <Empty>No one in a chair.</Empty> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {inService.map((token) => (
            <div key={token.id} className="card space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">{token.tokenNumber}</p>
                <StatusPill status={token.status} />
              </div>
              <p className="text-sm text-slate-600">
                {token.chairLabel} · {token.employeeName ?? 'unassigned'} · started{' '}
                {clockTime(token.serviceStartedAt)} ({minutesSince(token.serviceStartedAt)} min)
              </p>
              <button
                className="btn-primary w-full"
                type="button"
                onClick={() => move(token, 'awaiting_payment')}
              >
                Finish service
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Waiting (${waiting.length})`}>
        {waiting.length === 0 ? <Empty>Queue is empty.</Empty> : null}
        <div className="space-y-3">
          {waiting.map((token, index) => (
            <div key={token.id} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">
                    #{index + 1} · {token.tokenNumber}
                  </p>
                  <p className="text-sm text-slate-600">
                    {token.customerName ?? 'Walk-in'} ·{' '}
                    {token.services.map((service) => service.name).join(', ')} · waiting{' '}
                    {minutesSince(token.createdAt)} min
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {token.chairId ? (
                    <button
                      className="btn-primary"
                      type="button"
                      onClick={() => move(token, 'in_service')}
                    >
                      Start service ({token.chairLabel})
                    </button>
                  ) : (
                    <select
                      className="input w-48"
                      defaultValue=""
                      onChange={(event) => event.target.value && assign(token, event.target.value)}
                    >
                      <option value="">Assign chair…</option>
                      {freeChairs.map((chair) => (
                        <option key={chair.id} value={chair.id}>
                          {chair.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    className="btn-danger"
                    type="button"
                    onClick={() => move(token, 'cancelled')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function WalkInForm({ salonId, onCreated }: { salonId: string; onCreated: () => void }) {
  const info = useLoader<KioskSalonInfo>(
    () => publicApi<KioskSalonInfo>(`/api/kiosk/${salonId}`),
    [salonId],
  );
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/tokens', {
        method: 'POST',
        body: {
          salonId,
          serviceIds,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
        },
      });
      onCreated();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <ErrorBanner message={error} />
      <div className="grid gap-2 sm:grid-cols-3">
        {(info.data?.services ?? []).map((service) => (
          <label key={service.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={serviceIds.includes(service.id)}
              onChange={() =>
                setServiceIds((current) =>
                  current.includes(service.id)
                    ? current.filter((id) => id !== service.id)
                    : [...current, service.id],
                )
              }
            />
            {service.name} · {money(service.price)}
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="input"
          placeholder="Customer name"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
        />
        <input
          className="input"
          placeholder="Phone"
          value={customerPhone}
          onChange={(event) => setCustomerPhone(event.target.value)}
        />
      </div>
      <button className="btn-primary" type="submit" disabled={busy || serviceIds.length === 0}>
        {busy ? 'Creating…' : 'Create token'}
      </button>
    </form>
  );
}
