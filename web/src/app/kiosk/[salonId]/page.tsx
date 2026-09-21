"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { CheckInResult, KioskSalonInfo } from '@shared/index';
import { api, mediaUrl, publicApi } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { useSalonEvents } from '@/lib/socket';
import { money } from '@/lib/format';
import { ErrorBanner } from '@/components/ui';
import { Skeleton } from '@/components/ui/skeleton';

const HEARTBEAT_INTERVAL_MS = 60_000;

export default function KioskCheckInPage() {
  const params = useParams<{ salonId: string }>();
  const salonId = params.salonId;
  const router = useRouter();

  const { data, error, reload } = useLoader<KioskSalonInfo>(
    () => publicApi<KioskSalonInfo>(`/api/kiosk/${salonId}`),
    [salonId],
  );
  useSalonEvents(salonId, reload);

  // Lets the admin's staff page show "online now" for this screen. A no-op
  // (silently ignored) if this browser was never paired as a kiosk device —
  // e.g. someone just previewing the check-in screen without a session.
  useEffect(() => {
    const ping = () => {
      api('/api/auth/heartbeat', { method: 'POST' }).catch(() => undefined);
    };
    ping();
    const timer = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const [started, setStarted] = useState(false);
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

  const step = selected.length === 0 ? 1 : 2;

  if (!started) {
    return (
      <main className="kiosk-shell flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md animate-fade-in text-center">
          <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-white/20 bg-white/10 shadow-kiosk">
            {data?.salon.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl(data.salon.logoUrl) ?? undefined}
                alt={data.salon.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-4xl font-bold text-white/70">
                {(data?.salon.name ?? 'S').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {data ? (
            <>
              <h1 className="mt-6 text-4xl font-bold tracking-tight text-white">{data.salon.name}</h1>
              <p className="mt-2 text-white/70">
                {data.freeChairs} chair{data.freeChairs === 1 ? '' : 's'} free · {data.waitingCount}{' '}
                waiting now
              </p>
            </>
          ) : (
            <div className="mt-6 flex flex-col items-center gap-2">
              <Skeleton className="h-9 w-56 bg-white/10" />
              <Skeleton className="h-5 w-64 bg-white/10" />
            </div>
          )}
          <button
            className="kiosk-btn-primary mt-10 w-full text-lg"
            type="button"
            onClick={() => setStarted(true)}
            disabled={!data}
          >
            Get started →
          </button>
          <Link className="mt-3 block text-sm text-white/60 hover:text-white" href={`/kiosk/${salonId}/book`}>
            Or book for later
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="kiosk-shell pb-40">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/20 bg-white/10">
              {data?.salon.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(data.salon.logoUrl) ?? undefined}
                  alt={data.salon.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-white/70">
                  {(data?.salon.name ?? 'S').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="kiosk-badge">Walk-in check-in</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                {data?.salon.name ?? 'Welcome'}
              </h1>
            </div>
          </div>
          <Link className="kiosk-btn-ghost" href={`/kiosk/${salonId}/book`}>
            Book for later →
          </Link>
        </div>
        <p className="mt-3 text-white/70">
          {data
            ? `${data.freeChairs} chair${data.freeChairs === 1 ? '' : 's'} free · ${data.waitingCount} waiting now`
            : 'Loading…'}
        </p>

        {/* Step indicator */}
        <div className="mt-8 flex items-center gap-3 text-sm font-medium text-white/70">
          <span className={`kiosk-step ${step >= 1 ? 'kiosk-step-active' : 'kiosk-step-pending'}`}>
            1
          </span>
          <span className={step >= 1 ? 'text-white' : ''}>Choose services</span>
          <span className="h-px flex-1 bg-white/20" />
          <span className={`kiosk-step ${step >= 2 ? 'kiosk-step-active' : 'kiosk-step-pending'}`}>
            2
          </span>
          <span className={step >= 2 ? 'text-white' : ''}>Your details</span>
        </div>

        <form id="checkin-form" onSubmit={submit} className="mt-8 space-y-8">
          <ErrorBanner message={error ?? submitError} />

          <section className="kiosk-card">
            <h2 className="mb-4 text-xl font-bold text-brand-900">Pick your services</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {services.map((service) => {
                const active = selected.includes(service.id);
                return (
                  <button
                    type="button"
                    key={service.id}
                    onClick={() => toggle(service.id)}
                    className={`kiosk-tile ${active ? 'kiosk-tile-active' : ''}`}
                  >
                    {active ? (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white">
                        ✓
                      </span>
                    ) : null}
                    <div>
                      <p className="text-lg font-semibold text-ink">{service.name}</p>
                      <p className="text-sm text-slate-500">{service.durationMinutes} min</p>
                    </div>
                    <p className="text-xl font-bold text-brand-700">{money(service.price)}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="kiosk-card">
            <h2 className="mb-3 text-xl font-bold text-brand-900">Stylist (optional)</h2>
            <select
              className="kiosk-input"
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
            <p className="mt-2 text-sm text-slate-500">
              Requesting a specific stylist may mean waiting for them to be free.
            </p>
          </section>

          <section className="kiosk-card grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">
                Your name (optional)
              </label>
              <input
                id="name"
                className="kiosk-input"
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
                className="kiosk-input"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
          </section>
        </form>
      </div>

      {/* Sticky order summary + submit */}
      <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-brand-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm text-white/60">
              {chosen.length} service{chosen.length === 1 ? '' : 's'} · ~{duration} min
            </p>
            <p className="text-3xl font-bold text-accent-400">{money(total)}</p>
          </div>
          <button
            className="kiosk-btn-primary text-lg"
            type="submit"
            form="checkin-form"
            disabled={busy || selected.length === 0}
          >
            {busy ? 'Getting your token…' : 'Get my token →'}
          </button>
        </div>
      </div>
    </main>
  );
}
