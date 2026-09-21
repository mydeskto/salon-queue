"use client";

import { useState } from 'react';
import type { SalonWithStats } from '@salon/shared';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { money } from '@/lib/format';
import { ErrorBanner, Section, StatusPill } from '@/components/ui';

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

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
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
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function setStatus(salon: SalonWithStats, status: 'active' | 'suspended') {
    setError(null);
    try {
      await api(`/api/salons/${salon.id}`, { method: 'PATCH', body: { status } });
      salons.reload();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Salons</h1>
      <ErrorBanner message={error ?? salons.error} />

      {created ? (
        <div className="card border-emerald-300 bg-emerald-50">
          <p className="font-semibold">{created.salon.name} created</p>
          <p className="text-sm">
            Admin login: <strong>{created.adminCredentials.email}</strong> / password{' '}
            <strong>{created.adminCredentials.password}</strong> — share once, then have them change
            it.
          </p>
        </div>
      ) : null}

      <form onSubmit={create} className="card grid gap-3 sm:grid-cols-3">
        <input className="input" placeholder="Salon name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="input" placeholder="Admin name" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} required />
        <input className="input" type="email" placeholder="Admin email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} required />
        <input className="input" placeholder="Admin password (optional)" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
        <button className="btn-primary sm:col-span-3" type="submit">
          Provision salon
        </button>
      </form>

      <Section title="Directory">
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Salon</th>
                <th className="th">Status</th>
                <th className="th">Chairs</th>
                <th className="th">Employees</th>
                <th className="th">Revenue today</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {(salons.data ?? []).map((salon) => (
                <tr key={salon.id}>
                  <td className="td font-medium">{salon.name}</td>
                  <td className="td">
                    <StatusPill status={salon.status} />
                  </td>
                  <td className="td">{salon.chairCount}</td>
                  <td className="td">{salon.employeeCount}</td>
                  <td className="td">{money(salon.revenueToday)}</td>
                  <td className="td text-right">
                    {salon.status === 'active' ? (
                      <button className="btn-danger" type="button" onClick={() => setStatus(salon, 'suspended')}>
                        Suspend
                      </button>
                    ) : (
                      <button className="btn-secondary" type="button" onClick={() => setStatus(salon, 'active')}>
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
