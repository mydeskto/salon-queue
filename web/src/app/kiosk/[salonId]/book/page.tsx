"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import type { Appointment, KioskSalonInfo } from '@shared/index';
import { publicApi } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { dateTime, money } from '@/lib/format';
import { ErrorBanner } from '@/components/ui';

export default function KioskBookingPage() {
  const params = useParams<{ salonId: string }>();
  const salonId = params.salonId;
  const { data } = useLoader<KioskSalonInfo>(
    () => publicApi<KioskSalonInfo>(`/api/kiosk/${salonId}`),
    [salonId],
  );

  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [requestedEmployeeId, setRequestedEmployeeId] = useState('');
  const [notes, setNotes] = useState('');
  const [created, setCreated] = useState<Appointment | null>(null);
  const [lookup, setLookup] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const appointment = await publicApi<Appointment>('/api/kiosk/appointments', {
        method: 'POST',
        body: {
          salonId,
          serviceIds,
          customerName,
          customerPhone,
          scheduledFor: new Date(scheduledFor).toISOString(),
          requestedEmployeeId: requestedEmployeeId || undefined,
          notes: notes || undefined,
        },
      });
      setCreated(appointment);
      toast.success('Appointment booked');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function findBookings() {
    setError(null);
    try {
      const results = await publicApi<Appointment[]>(`/api/kiosk/${salonId}/appointments`, {
        query: { phone: customerPhone },
      });
      setLookup(results);
      if (results.length === 0) {
        toast.info('No upcoming bookings for that number');
      }
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <main className="kiosk-shell px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="kiosk-badge">Book ahead</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">Book an appointment</h1>
          </div>
          <Link className="kiosk-btn-ghost" href={`/kiosk/${salonId}`}>
            Walk in instead
          </Link>
        </div>

        {created ? (
          <div className="kiosk-card mt-8 animate-pop space-y-2">
            <p className="kiosk-badge">Confirmed</p>
            <p className="text-2xl font-bold text-brand-900">
              {dateTime(created.scheduledFor)}
            </p>
            <p className="text-sm text-slate-600">
              {created.customerName} · {created.customerPhone}
            </p>
            <p className="text-sm text-slate-600">
              {created.services.map((service) => service.name).join(', ')}
            </p>
            <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
              Show this phone number at reception on the day and they will put you straight in
              the queue.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <ErrorBanner message={error} />
            <div className="kiosk-card">
              <span className="label">Services</span>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {(data?.services ?? []).map((service) => {
                  const active = serviceIds.includes(service.id);
                  return (
                    <button
                      type="button"
                      key={service.id}
                      onClick={() =>
                        setServiceIds((current) =>
                          current.includes(service.id)
                            ? current.filter((id) => id !== service.id)
                            : [...current, service.id],
                        )
                      }
                      className={`kiosk-tile !p-4 ${active ? 'kiosk-tile-active' : ''}`}
                    >
                      <span className="text-sm font-semibold text-ink">
                        {service.name}
                      </span>
                      <span className="text-sm font-bold text-brand-700">
                        {money(service.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="kiosk-card grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="booking-name">
                  Name
                </label>
                <input
                  id="booking-name"
                  className="kiosk-input"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="booking-phone">
                  Phone
                </label>
                <input
                  id="booking-phone"
                  className="kiosk-input"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="booking-when">
                  Date &amp; time
                </label>
                <input
                  id="booking-when"
                  className="kiosk-input"
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="booking-stylist">
                  Stylist (optional)
                </label>
                <select
                  id="booking-stylist"
                  className="kiosk-input"
                  value={requestedEmployeeId}
                  onChange={(event) => setRequestedEmployeeId(event.target.value)}
                >
                  <option value="">No preference</option>
                  {(data?.employees ?? []).map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="booking-notes">
                  Notes (optional)
                </label>
                <input
                  id="booking-notes"
                  className="kiosk-input"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </div>
            <button
              className="kiosk-btn-primary w-full text-lg"
              type="submit"
              disabled={busy || serviceIds.length === 0}
            >
              {busy ? 'Booking…' : 'Confirm booking →'}
            </button>
          </form>
        )}

        <section className="mt-12 space-y-3">
          <h2 className="text-xl font-bold text-white">Find my booking</h2>
          <div className="flex gap-2">
            <input
              className="kiosk-input bg-white"
              placeholder="Phone number"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
            />
            <button className="kiosk-btn-ghost" type="button" onClick={findBookings}>
              Search
            </button>
          </div>
          {lookup?.length === 0 ? (
            <div className="kiosk-panel text-center text-white/70">
              No upcoming bookings for that number.
            </div>
          ) : null}
          {lookup?.map((appointment) => (
            <div key={appointment.id} className="kiosk-card">
              <p className="font-bold text-brand-900">{dateTime(appointment.scheduledFor)}</p>
              <p className="text-sm text-slate-600">
                {appointment.services.map((service) => service.name).join(', ')}
              </p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
