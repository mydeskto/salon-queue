"use client";

import { useMemo, useState } from 'react';
import { Mail, Monitor, RefreshCw, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { KioskPairingResult, StaffInviteResult, StaffUser } from '@shared/index';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { minutesSince } from '@/lib/format';
import { Empty, ErrorBanner, Section } from '@/components/ui';
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

const WEB_ORIGIN =
  typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_WEB_URL ?? '');

function statusBadge(member: StaffUser) {
  if (member.status === 'invited') return <Badge variant="warning">Invite pending</Badge>;
  if (member.status === 'unpaired') return <Badge variant="warning">Not paired</Badge>;
  if (!member.isActive) return <Badge variant="muted">Disabled</Badge>;
  return <Badge variant="success">Active</Badge>;
}

function kioskOnlineBadge(member: StaffUser) {
  if (member.status === 'unpaired') return null;
  if (!member.lastSeenAt) return <Badge variant="muted">Never seen</Badge>;
  const idle = minutesSince(member.lastSeenAt);
  if (idle <= 3) return <Badge variant="success">Online now</Badge>;
  if (idle <= 15) return <Badge variant="warning">Idle {idle}m</Badge>;
  return <Badge variant="destructive">Offline {idle}m ago</Badge>;
}

export default function StaffPage() {
  const staff = useLoader<StaffUser[]>(() => api<StaffUser[]>('/api/staff'), [], 30000);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'receptionist' as 'receptionist' | 'salon_admin',
  });
  const [inviteResult, setInviteResult] = useState<StaffInviteResult | null>(null);
  const [invitingBusy, setInvitingBusy] = useState(false);

  const [kioskOpen, setKioskOpen] = useState(false);
  const [kioskName, setKioskName] = useState('');
  const [kioskResult, setKioskResult] = useState<KioskPairingResult | null>(null);
  const [kioskBusy, setKioskBusy] = useState(false);

  const people = useMemo(
    () => (staff.data ?? []).filter((member) => member.role !== 'kiosk'),
    [staff.data],
  );
  const screens = useMemo(
    () => (staff.data ?? []).filter((member) => member.role === 'kiosk'),
    [staff.data],
  );

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInvitingBusy(true);
    try {
      const result = await api<StaffInviteResult>('/api/staff/invite', {
        method: 'POST',
        body: {
          name: inviteForm.name,
          email: inviteForm.email,
          phone: inviteForm.phone || undefined,
          role: inviteForm.role,
        },
      });
      setInviteResult(result);
      setInviteForm({ name: '', email: '', phone: '', role: 'receptionist' });
      staff.reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setInvitingBusy(false);
    }
  }

  async function reinvite(member: StaffUser) {
    setError(null);
    try {
      const result = await api<StaffInviteResult>(`/api/staff/${member.id}/reinvite`, {
        method: 'POST',
      });
      setInviteResult(result);
      setInviteOpen(true);
      staff.reload();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function createKiosk(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setKioskBusy(true);
    try {
      const result = await api<KioskPairingResult>('/api/staff/kiosk-devices', {
        method: 'POST',
        body: { name: kioskName },
      });
      setKioskResult(result);
      setKioskName('');
      staff.reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setKioskBusy(false);
    }
  }

  async function regenerateCode(member: StaffUser) {
    setError(null);
    try {
      const result = await api<KioskPairingResult>(`/api/staff/${member.id}/pairing-code`, {
        method: 'POST',
      });
      setKioskResult(result);
      setKioskOpen(true);
      staff.reload();
    } catch (cause) {
      setError((cause as Error).message);
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff &amp; kiosk screens</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite receptionists and admins by email, or pair a kiosk tablet with a one-time
            code — no shared passwords for either.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setInviteResult(null);
              setInviteOpen(true);
            }}
          >
            <Mail className="h-4 w-4" /> Invite staff
          </Button>
          <Button
            type="button"
            onClick={() => {
              setKioskResult(null);
              setKioskOpen(true);
            }}
          >
            <Monitor className="h-4 w-4" /> Add kiosk screen
          </Button>
        </div>
      </div>
      <ErrorBanner message={error ?? staff.error} />

      <Section title="Staff accounts">
        <Card>
          {staff.loading ? (
            <CardContent className="space-y-2 pt-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          ) : people.length === 0 ? (
            <CardContent className="pt-5">
              <Empty>No staff invited yet.</Empty>
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
                    <TableCell>{statusBadge(member)}</TableCell>
                    <TableCell className="text-right">
                      {member.status === 'invited' ? (
                        <Button variant="outline" size="sm" type="button" onClick={() => reinvite(member)}>
                          <RefreshCw className="h-3.5 w-3.5" /> Resend invite
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" type="button" onClick={() => toggle(member)}>
                          {member.isActive ? 'Disable' : 'Enable'}
                        </Button>
                      )}
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
            No kiosk screens yet. Add one above, then enter its pairing code on the tablet at{' '}
            <span className="font-mono">/login/kiosk</span>.
          </p>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Screen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Online</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {screens.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{statusBadge(member)}</TableCell>
                    <TableCell>{kioskOnlineBadge(member)}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="outline" size="sm" type="button" onClick={() => regenerateCode(member)}>
                        <RefreshCw className="h-3.5 w-3.5" />{' '}
                        {member.status === 'unpaired' ? 'Show code' : 'Re-pair'}
                      </Button>
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

      {/* Invite staff dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          {inviteResult ? (
            <>
              <DialogHeader>
                <DialogTitle>Invite ready</DialogTitle>
                <DialogDescription>
                  Send this link to {inviteResult.staff.name}. It expires{' '}
                  {new Date(inviteResult.expiresAt).toLocaleDateString()}.
                </DialogDescription>
              </DialogHeader>
              <CopyField value={`${WEB_ORIGIN}${inviteResult.inviteUrl}`} />
              <DialogFooter>
                <Button type="button" onClick={() => setInviteOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Invite staff by email</DialogTitle>
                <DialogDescription>
                  They&apos;ll set their own password from the link you share.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={sendInvite} className="space-y-3">
                <div className="flex gap-2">
                  {(
                    [
                      { value: 'receptionist', label: 'Receptionist' },
                      { value: 'salon_admin', label: 'Salon admin' },
                    ] as const
                  ).map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={inviteForm.role === option.value ? 'default' : 'outline'}
                      onClick={() => setInviteForm({ ...inviteForm, role: option.value })}
                    >
                      <UserPlus className="h-4 w-4" /> {option.label}
                    </Button>
                  ))}
                </div>
                <div>
                  <Label htmlFor="invite-name">Name</Label>
                  <Input
                    id="invite-name"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="invite-phone">Phone (optional)</Label>
                  <Input
                    id="invite-phone"
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={invitingBusy}>
                    {invitingBusy ? 'Sending…' : 'Create invite'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Kiosk pairing dialog */}
      <Dialog open={kioskOpen} onOpenChange={setKioskOpen}>
        <DialogContent>
          {kioskResult ? (
            <>
              <DialogHeader>
                <DialogTitle>Pairing code</DialogTitle>
                <DialogDescription>
                  On the kiosk tablet, go to <span className="font-mono">/login/kiosk</span> and
                  enter this code. It expires at{' '}
                  {new Date(kioskResult.expiresAt).toLocaleTimeString()}.
                </DialogDescription>
              </DialogHeader>
              <p className="rounded-lg bg-secondary py-6 text-center text-4xl font-bold tracking-[0.3em] text-foreground">
                {kioskResult.code}
              </p>
              <DialogFooter>
                <Button type="button" onClick={() => setKioskOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Add a kiosk screen</DialogTitle>
                <DialogDescription>
                  Name it something recognizable, like &ldquo;Front Desk Tablet.&rdquo;
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createKiosk} className="space-y-3">
                <div>
                  <Label htmlFor="kiosk-name">Screen name</Label>
                  <Input
                    id="kiosk-name"
                    value={kioskName}
                    onChange={(e) => setKioskName(e.target.value)}
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={kioskBusy}>
                    {kioskBusy ? 'Creating…' : 'Create & get code'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
