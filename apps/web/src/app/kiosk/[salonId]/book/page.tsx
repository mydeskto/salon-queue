"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Appointment, KioskSalonInfo } from '@salon/shared';
import { publicApi } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { dateTime, money } from '@/lib/format';
import { Empty, ErrorBanner } from '@/components/ui';

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
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function findBookings() {
    setError(null);
    try {
      setLookup(
        await publicApi<Appointment[]>(`/api/kiosk/${salonId}/appointments`, {
          query: { phone: customerPhone },
        }),
      );
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold">Book an appointment</h1>
        <Link className="btn-secondary" href={`/kiosk/${salonId}`}>
          Walk in instead
        </Link>
      </div>

      {created ? (
        <div className="card mt-8 space-y-2">
          <p className="text-lg font-semibold">Booked for {dateTime(created.scheduledFor)}</p>
          <p className="text-sm text-slate-600">
            {created.customerName} · {created.customerPhone}
          </p>
          <p className="text-sm text-slate-600">
            {created.services.map((service) => service.name).join(', ')}
          </p>
          <p className="text-sm">
            Show this phone number at reception on the day and they will put you straight in the
            queue.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-5">
          <ErrorBanner message={error} />
          <div>
            <span className="label">Services</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {(data?.services ?? []).map((service) => (
                <label key={service.id} className="card flex items-center gap-3 py-3">
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
                  <span className="text-sm">
                    {service.name} · {money(service.price)}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="booking-name">
                Name
              </label>
              <input
                id="booking-name"
                className="input"
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
                className="input"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="booking-when">
                Date &amp; time
              </label>
              <input
                id="booking-when"
                className="input"
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
                className="input"
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
          </div>
          <div>
            <label className="label" htmlFor="booking-notes">
              Notes (optional)
            </label>
            <input
              id="booking-notes"
              className="input"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <button className="btn-primary" type="submit" disabled={busy || serviceIds.length === 0}>
            {busy ? 'Booking…' : 'Confirm booking'}
          </button>
        </form>
      )}

      <section className="mt-12 space-y-3">
        <h2 className="text-lg font-semibold">Find my booking</h2>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Phone number"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
          />
          <button className="btn-secondary" type="button" onClick={findBookings}>
            Search
          </button>
        </div>
        {lookup?.length === 0 ? <Empty>No upcoming bookings for that number.</Empty> : null}
        {lookup?.map((appointment) => (
          <div key={appointment.id} className="card">
            <p className="font-semibold">{dateTime(appointment.scheduledFor)}</p>
            <p className="text-sm text-slate-600">
              {appointment.services.map((service) => service.name).join(', ')}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}
