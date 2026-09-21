"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Chair, KioskSalonInfo, TokenStatus, TokenSummary } from '@shared/index';
import { api, publicApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLoader } from '@/lib/usePolling';
import { useSalonEvents } from '@/lib/socket';
import { clockTime, minutesSince, money } from '@/lib/format';
import { Empty, ErrorBanner, Section, Stat, StatusPill } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
      toast.success('Chair freed');
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live queue</h1>
          <p className="text-sm text-muted-foreground">Real-time chairs, waitlist, and payments.</p>
        </div>
        <Button type="button" onClick={() => setWalkInOpen((v) => !v)}>
          {walkInOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {walkInOpen ? 'Close walk-in' : 'New walk-in'}
        </Button>
      </div>
      <ErrorBanner message={error ?? tokens.error} />

      {walkInOpen && salonId ? (
        <WalkInForm
          salonId={salonId}
          onCreated={() => {
            setWalkInOpen(false);
            tokens.reload();
            chairs.reload();
            toast.success('Walk-in added to the queue');
          }}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Waiting" value={String(waiting.length)} />
        <Stat label="In service" value={String(inService.length)} />
        <Stat label="Free chairs" value={String(freeChairs.length)} />
        <Stat
          label="Billed this shift"
          value={money(shift.data?.revenue ?? '0')}
          hint={`${shift.data?.billCount ?? 0} bill(s)`}
        />
      </div>

      <Section title="Chairs">
        {chairs.loading ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(chairs.data ?? []).map((chair) => (
              <Card key={chair.id}>
                <CardContent className="space-y-2 pt-5">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{chair.label}</p>
                    <StatusPill status={chair.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {chair.currentTokenNumber
                      ? `${chair.currentTokenNumber} · ${chair.currentEmployeeName ?? 'unassigned'}`
                      : 'Empty'}
                  </p>
                  {chair.status === 'occupied' ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      size="sm"
                      type="button"
                      onClick={() => freeChair(chair.id)}
                    >
                      Force free
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Awaiting payment" description={`${awaiting.length} token(s)`}>
        {awaiting.length === 0 ? (
          <Empty>Nothing to bill right now.</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {awaiting.map((token) => (
              <Card key={token.id}>
                <CardContent className="flex items-center justify-between gap-4 pt-5">
                  <div>
                    <p className="text-lg font-semibold">{token.tokenNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {token.customerName ?? 'Walk-in'} · {money(token.totalPrice)}
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={`/reception/checkout/${token.id}`}>Checkout</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="In service" description={`${inService.length} chair(s) occupied`}>
        {inService.length === 0 ? (
          <Empty>No one in a chair.</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {inService.map((token) => (
              <Card key={token.id}>
                <CardContent className="space-y-2 pt-5">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold">{token.tokenNumber}</p>
                    <StatusPill status={token.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {token.chairLabel} · {token.employeeName ?? 'unassigned'} · started{' '}
                    {clockTime(token.serviceStartedAt)} ({minutesSince(token.serviceStartedAt)} min)
                  </p>
                  <Button className="w-full" type="button" onClick={() => move(token, 'awaiting_payment')}>
                    Finish service
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Waiting" description={`${waiting.length} in the queue`}>
        {waiting.length === 0 ? (
          <Empty>Queue is empty.</Empty>
        ) : (
          <div className="space-y-3">
            {waiting.map((token, index) => (
              <Card key={token.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
                  <div>
                    <p className="text-lg font-semibold">
                      #{index + 1} · {token.tokenNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {token.customerName ?? 'Walk-in'} ·{' '}
                      {token.services.map((service) => service.name).join(', ')} · waiting{' '}
                      {minutesSince(token.createdAt)} min
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {token.chairId ? (
                      <Button type="button" onClick={() => move(token, 'in_service')}>
                        Start service ({token.chairLabel})
                      </Button>
                    ) : (
                      <Select onValueChange={(chairId) => assign(token, chairId)}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Assign chair…" />
                        </SelectTrigger>
                        <SelectContent>
                          {freeChairs.map((chair) => (
                            <SelectItem key={chair.id} value={chair.id}>
                              {chair.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button variant="destructive" type="button" onClick={() => move(token, 'cancelled')}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>
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
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={submit} className="space-y-4">
          <ErrorBanner message={error} />
          <div className="grid gap-2 sm:grid-cols-3">
            {(info.data?.services ?? []).map((service) => (
              <label key={service.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-brand-600"
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
            <Input
              placeholder="Customer name"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
            />
            <Input
              placeholder="Phone"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy || serviceIds.length === 0}>
            {busy ? 'Creating…' : 'Create token'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
