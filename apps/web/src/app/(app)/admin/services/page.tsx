"use client";

import { useState } from 'react';
import type { Service } from '@salon/shared';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { money } from '@/lib/format';
import { ErrorBanner, Section } from '@/components/ui';

export default function ServicesPage() {
  const services = useLoader<Service[]>(() => api<Service[]>('/api/services'), []);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [durationMinutes, setDuration] = useState('30');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
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
    } catch (cause) {
      setError((cause as Error).message);
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
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Services</h1>
      <ErrorBanner message={error ?? services.error} />

      <form onSubmit={create} className="card grid gap-3 sm:grid-cols-5">
        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <input className="input" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} required />
        <input className="input" placeholder="Minutes" value={durationMinutes} onChange={(e) => setDuration(e.target.value)} required />
        <button className="btn-primary" type="submit">
          Add service
        </button>
      </form>

      <Section title="Catalogue">
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Category</th>
                <th className="th">Price</th>
                <th className="th">Duration</th>
                <th className="th">Status</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {(services.data ?? []).map((service) => (
                <tr key={service.id}>
                  <td className="td font-medium">{service.name}</td>
                  <td className="td">{service.category ?? '—'}</td>
                  <td className="td">{money(service.price)}</td>
                  <td className="td">{service.durationMinutes} min</td>
                  <td className="td">{service.isActive ? 'Active' : 'Hidden'}</td>
                  <td className="td text-right">
                    <button className="btn-secondary" type="button" onClick={() => toggle(service)}>
                      {service.isActive ? 'Hide' : 'Restore'}
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
