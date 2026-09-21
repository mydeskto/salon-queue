"use client";

import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Plus, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PasswordResetResult, SalonWithStats, StaffUser } from '@shared/index';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { money } from '@/lib/format';
import { ErrorBanner, Section, StatusPill } from '@/components/ui';
import { CopyField } from '@/components/copy-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

  const [managing, setManaging] = useState<SalonWithStats | null>(null);

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
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="text-sm">
                <p className="font-semibold text-emerald-900">{created.salon.name} created</p>
                <p className="mt-1 text-emerald-800">
                  Copy these exactly — the password is not shown again after you leave this page.
                </p>
              </div>
            </div>
            <div className="space-y-2 pl-8">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Admin email
                </p>
                <CopyField value={created.adminCredentials.email} />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Admin password
                </p>
                <CopyField value={created.adminCredentials.password} />
              </div>
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
                    <TableCell className="space-x-2 text-right">
                      <Button variant="outline" size="sm" type="button" onClick={() => setManaging(salon)}>
                        <Settings className="h-3.5 w-3.5" /> Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </Section>

      <ManageSalonDialog
        salon={managing}
        onClose={() => setManaging(null)}
        onStatusChange={setStatus}
        onDeleted={() => {
          setManaging(null);
          salons.reload();
        }}
      />
    </div>
  );
}

function ManageSalonDialog({
  salon,
  onClose,
  onStatusChange,
  onDeleted,
}: {
  salon: SalonWithStats | null;
  onClose: () => void;
  onStatusChange: (salon: SalonWithStats, status: 'active' | 'suspended') => Promise<void>;
  onDeleted: () => void;
}) {
  const [details, setDetails] = useState({ name: '', address: '', phone: '' });
  const [savingDetails, setSavingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<PasswordResetResult | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const admins = useLoader<StaffUser[]>(
    () => (salon ? api<StaffUser[]>(`/api/salons/${salon.id}/admins`) : Promise.resolve([])),
    [salon?.id],
  );

  useEffect(() => {
    if (salon) {
      setDetails({ name: salon.name, address: salon.address ?? '', phone: salon.phone ?? '' });
      setResetResult(null);
      setConfirmingDelete(false);
      setError(null);
    }
  }, [salon]);

  if (!salon) return null;
  const activeSalon = salon;

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    setSavingDetails(true);
    setError(null);
    try {
      await api(`/api/salons/${activeSalon.id}`, {
        method: 'PATCH',
        body: {
          name: details.name,
          address: details.address || null,
          phone: details.phone || null,
        },
      });
      toast.success('Salon details updated');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSavingDetails(false);
    }
  }

  async function resetPassword(admin: StaffUser) {
    setError(null);
    try {
      const result = await api<PasswordResetResult>(
        `/api/salons/${activeSalon.id}/admins/${admin.id}/reset-password`,
        { method: 'POST' },
      );
      setResetResult(result);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function deleteSalon() {
    setDeleting(true);
    setError(null);
    try {
      await api(`/api/salons/${activeSalon.id}`, { method: 'DELETE' });
      toast.success(`${activeSalon.name} deleted`);
      onDeleted();
    } catch (cause) {
      setError((cause as Error).message);
      setDeleting(false);
    }
  }

  return (
    <Dialog open={Boolean(salon)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{salon.name}</DialogTitle>
          <DialogDescription>Manage this salon's details, admins, and status.</DialogDescription>
        </DialogHeader>

        <ErrorBanner message={error} />

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Status</p>
            <StatusPill status={salon.status} className="mt-1" />
          </div>
          {salon.status === 'active' ? (
            <Button variant="destructive" size="sm" type="button" onClick={() => onStatusChange(salon, 'suspended')}>
              Suspend
            </Button>
          ) : (
            <Button variant="outline" size="sm" type="button" onClick={() => onStatusChange(salon, 'active')}>
              Reactivate
            </Button>
          )}
        </div>

        <form onSubmit={saveDetails} className="space-y-3">
          <div>
            <Label htmlFor="manage-name">Salon name</Label>
            <Input
              id="manage-name"
              value={details.name}
              onChange={(e) => setDetails({ ...details, name: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="manage-address">Address</Label>
              <Input
                id="manage-address"
                value={details.address}
                onChange={(e) => setDetails({ ...details, address: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="manage-phone">Phone</Label>
              <Input
                id="manage-phone"
                value={details.phone}
                onChange={(e) => setDetails({ ...details, phone: e.target.value })}
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={savingDetails}>
            {savingDetails ? 'Saving…' : 'Save details'}
          </Button>
        </form>

        <div className="space-y-2">
          <p className="text-sm font-medium">Salon admins</p>
          {admins.loading ? (
            <Skeleton className="h-16 w-full" />
          ) : admins.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin account on this salon yet.</p>
          ) : (
            <div className="space-y-2">
              {(admins.data ?? []).map((admin) => (
                <div key={admin.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{admin.name}</p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={admin.isActive ? 'success' : 'muted'}>
                      {admin.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => resetPassword(admin)}
                    >
                      <KeyRound className="h-3.5 w-3.5" /> Reset password
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {resetResult ? (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">
              <p className="text-sm text-emerald-900">
                New password for <strong>{resetResult.email}</strong> — copy it now, it won&apos;t
                be shown again.
              </p>
              <div className="mt-2">
                <CopyField value={resetResult.password} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-destructive/30 p-3">
          <p className="text-sm font-medium text-destructive">Danger zone</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Permanently deletes this salon and all its staff/service records. Blocked while it
            has active tokens — suspend it instead if you just want to pause it.
          </p>
          {confirmingDelete ? (
            <div className="mt-2 flex gap-2">
              <Button variant="destructive" size="sm" type="button" disabled={deleting} onClick={deleteSalon}>
                {deleting ? 'Deleting…' : 'Yes, delete permanently'}
              </Button>
              <Button variant="outline" size="sm" type="button" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              type="button"
              className="mt-2"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete salon
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
