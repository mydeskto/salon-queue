"use client";

import { useMemo, useState } from 'react';
import { Monitor, Plus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { StaffUser } from '@shared/index';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { ErrorBanner, Section } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type StaffRole = 'receptionist' | 'salon_admin' | 'kiosk';

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'screen'
  );
}

export default function StaffPage() {
  const staff = useLoader<StaffUser[]>(() => api<StaffUser[]>('/api/staff'), []);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'receptionist' as StaffRole,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const people = useMemo(
    () => (staff.data ?? []).filter((member) => member.role !== 'kiosk'),
    [staff.data],
  );
  const screens = useMemo(
    () => (staff.data ?? []).filter((member) => member.role === 'kiosk'),
    [staff.data],
  );

  const isKiosk = form.role === 'kiosk';

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const email = isKiosk ? `${slugify(form.name)}.kiosk@screens.local` : form.email;
      await api('/api/staff', {
        method: 'POST',
        body: { ...form, email, phone: form.phone || undefined },
      });
      toast.success(isKiosk ? `Kiosk screen "${form.name}" created` : `${form.name} added`);
      setForm({ ...form, name: '', email: '', phone: '', password: '' });
      staff.reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(member: StaffUser) {
    setError(null);
    try {
      await api(`/api/staff/${member.id}`, {
        method: 'PATCH',
        body: { isActive: !member.isActive },
      });
      staff.reload();
      toast.success(member.isActive ? `${member.name} disabled` : `${member.name} enabled`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff &amp; kiosk screens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add reception/admin accounts, or create a login for a kiosk tablet — once signed in on
          a device, that screen always opens straight to this salon&apos;s check-in flow.
        </p>
      </div>
      <ErrorBanner message={error ?? staff.error} />

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex gap-2">
            {(
              [
                { value: 'receptionist', label: 'Receptionist', icon: UserPlus },
                { value: 'salon_admin', label: 'Salon admin', icon: UserPlus },
                { value: 'kiosk', label: 'Kiosk screen', icon: Monitor },
              ] as const
            ).map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={form.role === option.value ? 'default' : 'outline'}
                onClick={() => setForm({ ...form, role: option.value })}
              >
                <option.icon className="h-4 w-4" />
                {option.label}
              </Button>
            ))}
          </div>

          <form onSubmit={create} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="staff-name">
                  {isKiosk ? 'Screen name (e.g. "Front Desk Tablet")' : 'Name'}
                </Label>
                <Input id="staff-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              {isKiosk ? null : (
                <div>
                  <Label htmlFor="staff-email">Email</Label>
                  <Input id="staff-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
              )}
              {isKiosk ? null : (
                <div>
                  <Label htmlFor="staff-phone">Phone</Label>
                  <Input id="staff-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              )}
              <div>
                <Label htmlFor="staff-password">
                  {isKiosk ? 'Screen PIN / password (min 8)' : 'Password (min 8)'}
                </Label>
                <Input id="staff-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              <Plus className="h-4 w-4" /> {isKiosk ? 'Create kiosk screen login' : 'Add staff member'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Section title="Staff accounts">
        <Card>
          {staff.loading ? (
            <CardContent className="space-y-2 pt-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    <TableCell className="capitalize">{member.role.replace('_', ' ')}</TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? 'success' : 'muted'}>
                        {member.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" type="button" onClick={() => toggle(member)}>
                        {member.isActive ? 'Disable' : 'Enable'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </Section>

      <Section title="Kiosk screens">
        {screens.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No kiosk screens yet. Create one above, then sign in with it on the tablet at your
            front desk.
          </p>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Screen</TableHead>
                  <TableHead>Login email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {screens.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? 'success' : 'muted'}>
                        {member.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" type="button" onClick={() => toggle(member)}>
                        {member.isActive ? 'Disable' : 'Enable'}
                      </Button>
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
