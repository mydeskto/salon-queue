"use client";

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Employee, EmployeeHistoryRow, Service } from '@shared/index';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { dateTime, money } from '@/lib/format';
import { Empty, ErrorBanner, Section } from '@/components/ui';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function EmployeesPage() {
  const employees = useLoader<Employee[]>(() => api<Employee[]>('/api/employees'), []);
  const services = useLoader<Service[]>(() => api<Service[]>('/api/services'), []);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    shiftStart: '09:00',
    shiftEnd: '18:00',
    serviceIds: [] as string[],
  });

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api('/api/employees', {
        method: 'POST',
        body: {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
          serviceIds: form.serviceIds,
          shiftStart: form.shiftStart || undefined,
          shiftEnd: form.shiftEnd || undefined,
        },
      });
      setForm({ ...form, name: '', email: '', phone: '', password: '', serviceIds: [] });
      employees.reload();
      toast.success(`${form.name} added to the team`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(employee: Employee) {
    setError(null);
    try {
      await api(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        body: { isActive: !employee.isActive },
      });
      employees.reload();
      toast.success(employee.isActive ? `${employee.name} deactivated` : `${employee.name} activated`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
        <p className="text-sm text-muted-foreground">Stylists who can be assigned to chairs.</p>
      </div>
      <ErrorBanner message={error ?? employees.error} />

      <Card>
        <CardContent className="space-y-3 pt-5">
          <form onSubmit={create} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="emp-name">Name</Label>
                <Input id="emp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="emp-email">Email</Label>
                <Input id="emp-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="emp-phone">Phone</Label>
                <Input id="emp-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="emp-password">Password (min 8)</Label>
                <Input id="emp-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="emp-start">Shift start</Label>
                <Input id="emp-start" type="time" value={form.shiftStart} onChange={(e) => setForm({ ...form, shiftStart: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="emp-end">Shift end</Label>
                <Input id="emp-end" type="time" value={form.shiftEnd} onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Specialties</Label>
              <div className="flex flex-wrap gap-3">
                {(services.data ?? []).map((service) => (
                  <label key={service.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-brand-600"
                      checked={form.serviceIds.includes(service.id)}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          serviceIds: current.serviceIds.includes(service.id)
                            ? current.serviceIds.filter((id) => id !== service.id)
                            : [...current.serviceIds, service.id],
                        }))
                      }
                    />
                    {service.name}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              <Plus className="h-4 w-4" /> Add employee
            </Button>
          </form>
        </CardContent>
      </Card>

      <Section title="Team" description={`${employees.data?.length ?? 0} employee(s)`}>
        <Card>
          {employees.loading ? (
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
                  <TableHead>Shift</TableHead>
                  <TableHead>Specialties</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(employees.data ?? []).map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell className="text-muted-foreground">{employee.email}</TableCell>
                    <TableCell>
                      {employee.shiftStart ?? '—'}–{employee.shiftEnd ?? '—'}
                      {employee.onShift ? (
                        <Badge variant="success" className="ml-2">
                          on shift
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{employee.serviceIds.length}</TableCell>
                    <TableCell>
                      <Badge variant={employee.isActive ? 'success' : 'muted'}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="outline" size="sm" type="button" onClick={() => setSelected(employee)}>
                        History
                      </Button>
                      <Button variant="outline" size="sm" type="button" onClick={() => toggleActive(employee)}>
                        {employee.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </Section>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.name} — recent work</DialogTitle>
          </DialogHeader>
          {selected ? <EmployeeHistory employee={selected} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployeeHistory({ employee }: { employee: Employee }) {
  const history = useLoader<EmployeeHistoryRow[]>(
    () => api<EmployeeHistoryRow[]>(`/api/employees/${employee.id}/history`),
    [employee.id],
  );

  if (history.loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (history.data?.length === 0) {
    return <Empty>No completed tokens yet.</Empty>;
  }

  return (
    <div className="max-h-96 overflow-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Token</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Services</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Completed</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(history.data ?? []).map((row) => (
            <TableRow key={row.tokenId}>
              <TableCell>{row.tokenNumber}</TableCell>
              <TableCell>{row.customerName ?? '—'}</TableCell>
              <TableCell>{row.services.join(', ')}</TableCell>
              <TableCell>{money(row.total)}</TableCell>
              <TableCell>{dateTime(row.completedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
