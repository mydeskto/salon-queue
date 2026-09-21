"use client";

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Service } from '@shared/index';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { money } from '@/lib/format';
import { ErrorBanner, Section } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ServicesPage() {
  const services = useLoader<Service[]>(() => api<Service[]>('/api/services'), []);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [durationMinutes, setDuration] = useState('30');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api('/api/services', {
        method: 'POST',
        body: {
          name,
          price: Number(price || 0).toFixed(2),
          durationMinutes: Number(durationMinutes),
          category: category || undefined,
        },
      });
      setName('');
      setPrice('');
      setCategory('');
      services.reload();
      toast.success(`${name} added to the catalogue`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(service: Service) {
    setError(null);
    try {
      await api(`/api/services/${service.id}`, {
        method: 'PATCH',
        body: { isActive: !service.isActive },
      });
      services.reload();
      toast.success(service.isActive ? `${service.name} hidden` : `${service.name} restored`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <p className="text-sm text-muted-foreground">
          The price list customers see on the kiosk check-in screen.
        </p>
      </div>
      <ErrorBanner message={error ?? services.error} />

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-5">
            <div className="sm:col-span-2">
              <Label htmlFor="svc-name">Name</Label>
              <Input id="svc-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="svc-category">Category</Label>
              <Input id="svc-category" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="svc-price">Price (PKR)</Label>
              <Input
                id="svc-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="svc-duration">Minutes</Label>
              <Input
                id="svc-duration"
                inputMode="numeric"
                value={durationMinutes}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </div>
            <Button className="sm:col-span-5" type="submit" disabled={saving}>
              <Plus className="h-4 w-4" /> {saving ? 'Adding…' : 'Add service'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Section title="Catalogue" description={`${services.data?.length ?? 0} service(s)`}>
        <Card>
          {services.loading ? (
            <CardContent className="space-y-2 pt-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(services.data ?? []).map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="text-muted-foreground">{service.category ?? '—'}</TableCell>
                    <TableCell>{money(service.price)}</TableCell>
                    <TableCell>{service.durationMinutes} min</TableCell>
                    <TableCell>
                      <Badge variant={service.isActive ? 'success' : 'muted'}>
                        {service.isActive ? 'Active' : 'Hidden'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" type="button" onClick={() => toggle(service)}>
                        {service.isActive ? 'Hide' : 'Restore'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </Section>
    </div>
  );
}
