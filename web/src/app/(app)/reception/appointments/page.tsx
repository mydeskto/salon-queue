"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Appointment, CheckInResult } from '@shared/index';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { dateTime } from '@/lib/format';
import { Empty, ErrorBanner, StatusPill } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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
      toast.success(`${appointment.customerName} checked in`);
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
      toast.success('Appointment cancelled');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
        <p className="text-sm text-muted-foreground">Upcoming bookings not yet checked in.</p>
      </div>
      <ErrorBanner message={error ?? appointments.error} />

      {appointments.loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : appointments.data?.length === 0 ? (
        <Empty>No scheduled appointments.</Empty>
      ) : (
        <div className="space-y-3">
          {(appointments.data ?? []).map((appointment) => (
            <Card key={appointment.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
                <div>
                  <p className="font-semibold">
                    {appointment.customerName} · {dateTime(appointment.scheduledFor)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {appointment.customerPhone} ·{' '}
                    {appointment.services.map((service) => service.name).join(', ')}
                    {appointment.requestedEmployeeName ? ` · ${appointment.requestedEmployeeName}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={appointment.status} />
                  <Button type="button" onClick={() => checkIn(appointment)}>
                    Check in now
                  </Button>
                  <Button variant="destructive" type="button" onClick={() => cancel(appointment)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
