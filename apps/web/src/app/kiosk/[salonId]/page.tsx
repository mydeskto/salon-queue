"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { CheckInResult, KioskSalonInfo } from '@salon/shared';
import { publicApi } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { useSalonEvents } from '@/lib/socket';
import { money } from '@/lib/format';
import { ErrorBanner } from '@/components/ui';

export default function KioskCheckInPage() {
  const params = useParams<{ salonId: string }>();
  const salonId = params.salonId;
  const router = useRouter();

  const { data, error, reload } = useLoader<KioskSalonInfo>(
    () => publicApi<KioskSalonInfo>(`/api/kiosk/${salonId}`),
    [salonId],
  );
  useSalonEvents(salonId, reload);

  const [selected, setSelected] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const services = useMemo(() => data?.services ?? [], [data]);
  const chosen = useMemo(
    () => services.filter((service) => selected.includes(service.id)),
    [services, selected],
  );
  const total = chosen.reduce((sum, service) => sum + Number(service.price), 0);
  const duration = chosen.reduce((sum, service) => sum + service.durationMinutes, 0);

  const eligibleEmployees = (data?.employees ?? []).filter(
    (employee) =>
      selected.length === 0 || selected.every((serviceId) => employee.serviceIds.includes(serviceId)),
  );

  function toggle(serviceId: string) {
    setSelected((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setSubmitError(null);
    try {
      const result = await publicApi<CheckInResult>('/api/kiosk/check-in', {
        method: 'POST',
        body: {
          salonId,
          serviceIds: selected,
          customerName: name || undefined,
          customerPhone: phone || undefined,
          requestedEmployeeId: employeeId || undefined,
        },
      });
      router.push(`/kiosk/token/${result.token.id}`);
    } catch (cause) {
      setSubmitError((cause as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-semibold">{data?.salon.name ?? 'Check in'}</h1>
        <Link className="btn-secondary" href={`/kiosk/${salonId}/book`}>
          Book for later
        </Link>
      </div>
      <p className="mt-1 text-slate-600">
        {data ? `${data.freeChairs} chair(s) free · ${data.waitingCount} waiting` : 'Loading…'}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-8">
        <ErrorBanner message={error ?? submitError} />

        <section>
          <h2 className="mb-3 text-lg font-semibold">1. Pick your services</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => {
              const active = selected.includes(service.id);
              return (
                <button
                  type="button"
                  key={service.id}
                  onClick={() => toggle(service.id)}
                  className={`card text-left ${active ? 'border-ink ring-2 ring-ink' : ''}`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{service.name}</span>
                    <span>{money(service.price)}</span>
                  </div>
                  <p className="text-sm text-slate-500">{service.durationMinutes} min</p>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">2. Stylist (optional)</h2>
          <select
            className="input"
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
          >
            <option value="">No preference — first available</option>
            {eligibleEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
                {employee.onShift ? '' : ' (off shift)'}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Requesting a specific stylist may mean waiting for them to be free.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Your name (optional)
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone (optional)
            </label>
            <input
              id="phone"
              className="input"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
        </section>

        <div className="sticky bottom-0 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <div>
            <p className="text-sm text-slate-500">
              {chosen.length} service(s) · ~{duration} min
            </p>
            <p className="text-2xl font-semibold">{money(total)}</p>
          </div>
          <button
            className="btn-primary btn-xl"
            type="submit"
            disabled={busy || selected.length === 0}
          >
            {busy ? 'Getting your token…' : 'Get my token'}
          </button>
        </div>
      </form>
    </main>
  );
}
