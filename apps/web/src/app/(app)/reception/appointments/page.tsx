"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Appointment, CheckInResult } from '@salon/shared';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { dateTime } from '@/lib/format';
import { Empty, ErrorBanner, StatusPill } from '@/components/ui';

export default function AppointmentsPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const appointments = useLoader<Appointment[]>(
    () => api<Appointment[]>('/api/appointments', { query: { status: 'scheduled' } }),
    [],
  );

  async function checkIn(appointment: Appointment) {
    setError(null);
    try {
      await api<CheckInResult>(`/api/appointments/${appointment.id}/check-in`, { method: 'POST' });
      appointments.reload();
      router.push('/reception');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function cancel(appointment: Appointment) {
    setError(null);
    try {
      await api(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        body: { status: 'cancelled' },
      });
      appointments.reload();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Appointments</h1>
      <ErrorBanner message={error ?? appointments.error} />
      {appointments.data?.length === 0 ? <Empty>No scheduled appointments.</Empty> : null}
      <div className="space-y-3">
        {(appointments.data ?? []).map((appointment) => (
          <div key={appointment.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                {appointment.customerName} · {dateTime(appointment.scheduledFor)}
              </p>
              <p className="text-sm text-slate-600">
                {appointment.customerPhone} ·{' '}
                {appointment.services.map((service) => service.name).join(', ')}
                {appointment.requestedEmployeeName ? ` · ${appointment.requestedEmployeeName}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={appointment.status} />
              <button className="btn-primary" type="button" onClick={() => checkIn(appointment)}>
                Check in now
              </button>
              <button className="btn-danger" type="button" onClick={() => cancel(appointment)}>
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
