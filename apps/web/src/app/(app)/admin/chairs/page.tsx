"use client";

import { useState } from 'react';
import type { Chair } from '@salon/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLoader } from '@/lib/usePolling';
import { useSalonEvents } from '@/lib/socket';
import { ErrorBanner, StatusPill } from '@/components/ui';

export default function ChairsPage() {
  const { user } = useAuth();
  const chairs = useLoader<Chair[]>(() => api<Chair[]>('/api/chairs'), []);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  useSalonEvents(user?.salonId, chairs.reload);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/chairs', { method: 'POST', body: { label } });
      setLabel('');
      chairs.reload();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function setStatus(chair: Chair, status: 'free' | 'disabled') {
    setError(null);
    try {
      await api(`/api/chairs/${chair.id}`, { method: 'PATCH', body: { status } });
      chairs.reload();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Chairs</h1>
      <ErrorBanner message={error ?? chairs.error} />
      <form onSubmit={create} className="card flex gap-3">
        <input
          className="input"
          placeholder="Chair label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          required
        />
        <button className="btn-primary" type="submit">
          Add chair
        </button>
      </form>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {(chairs.data ?? []).map((chair) => (
          <div key={chair.id} className="card space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{chair.label}</p>
              <StatusPill status={chair.status} />
            </div>
            <p className="text-sm text-slate-600">
              {chair.currentTokenNumber ?? 'Empty'}
              {chair.currentEmployeeName ? ` · ${chair.currentEmployeeName}` : ''}
            </p>
            {chair.status === 'disabled' ? (
              <button className="btn-secondary w-full" type="button" onClick={() => setStatus(chair, 'free')}>
                Enable
              </button>
            ) : (
              <button className="btn-danger w-full" type="button" onClick={() => setStatus(chair, 'disabled')}>
                Disable
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
