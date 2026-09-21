"use client";

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Chair } from '@shared/index';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLoader } from '@/lib/usePolling';
import { useSalonEvents } from '@/lib/socket';
import { Empty, ErrorBanner, StatusPill } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ChairsPage() {
  const { user } = useAuth();
  const chairs = useLoader<Chair[]>(() => api<Chair[]>('/api/chairs'), []);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useSalonEvents(user?.salonId, chairs.reload);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api('/api/chairs', { method: 'POST', body: { label } });
      setLabel('');
      chairs.reload();
      toast.success(`Chair "${label}" added`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(chair: Chair, status: 'free' | 'disabled') {
    setError(null);
    try {
      await api(`/api/chairs/${chair.id}`, { method: 'PATCH', body: { status } });
      chairs.reload();
      toast.success(status === 'free' ? `${chair.label} enabled` : `${chair.label} disabled`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chairs</h1>
        <p className="text-sm text-muted-foreground">
          Stations available for staff to work from.
        </p>
      </div>
      <ErrorBanner message={error ?? chairs.error} />

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={create} className="flex gap-3">
            <Input
              placeholder="Chair label (e.g. Chair 3)"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              required
            />
            <Button type="submit" disabled={saving}>
              <Plus className="h-4 w-4" /> Add chair
            </Button>
          </form>
        </CardContent>
      </Card>

      {chairs.loading ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : chairs.data?.length === 0 ? (
        <Empty>No chairs yet — add one above.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(chairs.data ?? []).map((chair) => (
            <Card key={chair.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{chair.label}</CardTitle>
                <StatusPill status={chair.status} />
              </CardHeader>
              <CardContent className="pb-2">
                <p className="text-sm text-muted-foreground">
                  {chair.currentTokenNumber ?? 'Empty'}
                  {chair.currentEmployeeName ? ` · ${chair.currentEmployeeName}` : ''}
                </p>
              </CardContent>
              <CardFooter>
                {chair.status === 'disabled' ? (
                  <Button variant="outline" className="w-full" type="button" onClick={() => setStatus(chair, 'free')}>
                    Enable
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    className="w-full"
                    type="button"
                    onClick={() => setStatus(chair, 'disabled')}
                  >
                    Disable
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
