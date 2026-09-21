"use client";

import { useState } from 'react';
import type { Employee, EmployeeHistoryRow, Service } from '@salon/shared';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { dateTime, money } from '@/lib/format';
import { Empty, ErrorBanner, Section } from '@/components/ui';

export default function EmployeesPage() {
  const employees = useLoader<Employee[]>(() => api<Employee[]>('/api/employees'), []);
  const services = useLoader<Service[]>(() => api<Service[]>('/api/services'), []);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch (cause) {
      setError((cause as Error).message);
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
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Employees</h1>
      <ErrorBanner message={error ?? employees.error} />

      <form onSubmit={create} className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" type="password" placeholder="Password (min 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <input className="input" type="time" value={form.shiftStart} onChange={(e) => setForm({ ...form, shiftStart: e.target.value })} />
          <input className="input" type="time" value={form.shiftEnd} onChange={(e) => setForm({ ...form, shiftEnd: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-3">
          {(services.data ?? []).map((service) => (
            <label key={service.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
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
        <button className="btn-primary" type="submit">
          Add employee
        </button>
      </form>

      <Section title="Team">
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Email</th>
                <th className="th">Shift</th>
                <th className="th">Specialties</th>
                <th className="th">Status</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {(employees.data ?? []).map((employee) => (
                <tr key={employee.id}>
                  <td className="td font-medium">{employee.name}</td>
                  <td className="td">{employee.email}</td>
                  <td className="td">
                    {employee.shiftStart ?? '—'}–{employee.shiftEnd ?? '—'}
                    {employee.onShift ? ' (on shift)' : ''}
                  </td>
                  <td className="td">{employee.serviceIds.length}</td>
                  <td className="td">{employee.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="td space-x-2 text-right">
                    <button className="btn-secondary" type="button" onClick={() => setSelected(employee)}>
                      History
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => toggleActive(employee)}>
                      {employee.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {selected ? <EmployeeHistory employee={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function EmployeeHistory({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const history = useLoader<EmployeeHistoryRow[]>(
    () => api<EmployeeHistoryRow[]>(`/api/employees/${employee.id}/history`),
    [employee.id],
  );

  return (
    <Section
      title={`${employee.name} — recent work`}
      action={
        <button className="btn-secondary" type="button" onClick={onClose}>
          Close
        </button>
      }
    >
      {history.data?.length === 0 ? <Empty>No completed tokens yet.</Empty> : null}
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Token</th>
              <th className="th">Customer</th>
              <th className="th">Services</th>
              <th className="th">Total</th>
              <th className="th">Completed</th>
            </tr>
          </thead>
          <tbody>
            {(history.data ?? []).map((row) => (
              <tr key={row.tokenId}>
                <td className="td">{row.tokenNumber}</td>
                <td className="td">{row.customerName ?? '—'}</td>
                <td className="td">{row.services.join(', ')}</td>
                <td className="td">{money(row.total)}</td>
                <td className="td">{dateTime(row.completedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
