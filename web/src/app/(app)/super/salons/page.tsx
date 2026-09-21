"use client";

import { useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { SalonWithStats } from '@shared/index';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { money } from '@/lib/format';
import { ErrorBanner, Section, StatusPill } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface CreatedSalon {
  salon: SalonWithStats;
  adminCredentials: { email: string; password: string };
}

export default function SalonsPage() {
  const salons = useLoader<SalonWithStats[]>(() => api<SalonWithStats[]>('/api/salons'), []);
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [created, setCreated] = useState<CreatedSalon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await api<CreatedSalon>('/api/salons', {
        method: 'POST',
        body: {
          name: form.name,
          address: form.address || undefined,
          phone: form.phone || undefined,
          adminName: form.adminName,
          adminEmail: form.adminEmail,
          adminPassword: form.adminPassword || undefined,
        },
      });
      setCreated(result);
      setForm({ name: '', address: '', phone: '', adminName: '', adminEmail: '', adminPassword: '' });
      salons.reload();
      toast.success(`${result.salon.name} provisioned`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(salon: SalonWithStats, status: 'active' | 'suspended') {
    setError(null);
    try {
      await api(`/api/salons/${salon.id}`, { method: 'PATCH', body: { status } });
      salons.reload();
      toast.success(status === 'active' ? `${salon.name} reactivated` : `${salon.name} suspended`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Salons</h1>
        <p className="text-sm text-muted-foreground">
          Provision a new salon and its first admin account. The salon admin can then set up
          branding, services, staff, and kiosk screens.
        </p>
      </div>
      <ErrorBanner message={error ?? salons.error} />

      {created ? (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="flex items-start gap-3 pt-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="text-sm">
              <p className="font-semibold text-emerald-900">{created.salon.name} created</p>
              <p className="mt-1 text-emerald-800">
                Admin login: <strong>{created.adminCredentials.email}</strong> / password{' '}
                <strong>{created.adminCredentials.password}</strong> — share this once, then have
                them change it.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="salon-name">Salon name</Label>
              <Input id="salon-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="salon-address">Address</Label>
              <Input id="salon-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="salon-phone">Phone</Label>
              <Input id="salon-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="admin-name">Admin name</Label>
              <Input id="admin-name" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="admin-email">Admin email</Label>
              <Input id="admin-email" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="admin-password">Admin password (optional)</Label>
              <Input
                id="admin-password"
                placeholder="Auto-generated if left blank"
                value={form.adminPassword}
                onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              />
            </div>
            <Button className="sm:col-span-3" type="submit" disabled={saving}>
              <Plus className="h-4 w-4" /> {saving ? 'Provisioning…' : 'Provision salon'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Section title="Directory">
        {salons.loading ? (
          <Card>
            <CardContent className="space-y-2 pt-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salon</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chairs</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Revenue today</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(salons.data ?? []).map((salon) => (
                  <TableRow key={salon.id}>
                    <TableCell className="font-medium">{salon.name}</TableCell>
                    <TableCell>
                      <StatusPill status={salon.status} />
                    </TableCell>
                    <TableCell>{salon.chairCount}</TableCell>
                    <TableCell>{salon.employeeCount}</TableCell>
                    <TableCell>{money(salon.revenueToday)}</TableCell>
                    <TableCell className="text-right">
                      {salon.status === 'active' ? (
                        <Button variant="destructive" size="sm" type="button" onClick={() => setStatus(salon, 'suspended')}>
                          Suspend
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" type="button" onClick={() => setStatus(salon, 'active')}>
                          Reactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </Section>
    </div>
  );
}
