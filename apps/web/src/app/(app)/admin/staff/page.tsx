"use client";

import { useState } from 'react';
import type { StaffUser } from '@salon/shared';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { ErrorBanner, Section } from '@/components/ui';

export default function StaffPage() {
  const staff = useLoader<StaffUser[]>(() => api<StaffUser[]>('/api/staff'), []);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'receptionist' as 'receptionist' | 'salon_admin',
  });
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/staff', {
        method: 'POST',
        body: { ...form, phone: form.phone || undefined },
      });
      setForm({ ...form, name: '', email: '', phone: '', password: '' });
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
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reception staff</h1>
      <ErrorBanner message={error ?? staff.error} />

      <form onSubmit={create} className="card grid gap-3 sm:grid-cols-5">
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="input" type="password" placeholder="Password (min 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'receptionist' | 'salon_admin' })}>
          <option value="receptionist">Receptionist</option>
          <option value="salon_admin">Salon admin</option>
        </select>
        <button className="btn-primary sm:col-span-5" type="submit">
          Add staff member
        </button>
      </form>

      <Section title="Accounts">
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Email</th>
                <th className="th">Role</th>
                <th className="th">Status</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {(staff.data ?? []).map((member) => (
                <tr key={member.id}>
                  <td className="td font-medium">{member.name}</td>
                  <td className="td">{member.email}</td>
                  <td className="td">{member.role.replace('_', ' ')}</td>
                  <td className="td">{member.isActive ? 'Active' : 'Disabled'}</td>
                  <td className="td text-right">
                    <button className="btn-secondary" type="button" onClick={() => toggle(member)}>
                      {member.isActive ? 'Disable' : 'Enable'}
                    </button>
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
