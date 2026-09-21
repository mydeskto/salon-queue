"use client";

import type { PlatformOverview } from '@salon/shared';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { money } from '@/lib/format';
import { ErrorBanner, Section, Stat, StatusPill } from '@/components/ui';

export default function PlatformPage() {
  const overview = useLoader<PlatformOverview>(
    () => api<PlatformOverview>('/api/salons/overview'),
    [],
    60000,
  );
  const data = overview.data;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Platform overview</h1>
      <ErrorBanner message={overview.error} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Salons"
          value={String(data?.totalSalons ?? 0)}
          hint={`${data?.activeSalons ?? 0} active · ${data?.suspendedSalons ?? 0} suspended`}
        />
        <Stat label="Tokens today" value={String(data?.tokensToday ?? 0)} />
        <Stat label="Revenue today" value={money(data?.revenueToday ?? '0')} />
        <Stat
          label="Revenue this month"
          value={money(data?.revenueThisMonth ?? '0')}
          hint={`${data?.tokensThisMonth ?? 0} tokens`}
        />
      </div>

      <Section title="Salons">
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Salon</th>
                <th className="th">Status</th>
                <th className="th">Employees</th>
                <th className="th">Chairs</th>
                <th className="th">Tokens today</th>
                <th className="th">Revenue today</th>
              </tr>
            </thead>
            <tbody>
              {(data?.salons ?? []).map((salon) => (
                <tr key={salon.id}>
                  <td className="td font-medium">{salon.name}</td>
                  <td className="td">
                    <StatusPill status={salon.status} />
                  </td>
                  <td className="td">{salon.employeeCount}</td>
                  <td className="td">{salon.chairCount}</td>
                  <td className="td">{salon.tokensToday}</td>
                  <td className="td">{money(salon.revenueToday)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
