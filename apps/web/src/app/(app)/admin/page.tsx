"use client";

import { useState } from 'react';
import type { SalonOverviewReport } from '@salon/shared';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { money } from '@/lib/format';
import { Empty, ErrorBanner, Section, Stat } from '@/components/ui';

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const [from, setFrom] = useState(isoDaysAgo(6));
  const [to, setTo] = useState(isoDaysAgo(0));

  const report = useLoader<SalonOverviewReport>(
    () => api<SalonOverviewReport>('/api/reports/overview', { query: { from, to } }),
    [from, to],
  );
  const data = report.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">Salon dashboard</h1>
        <div className="flex gap-3">
          <div>
            <label className="label" htmlFor="from">
              From
            </label>
            <input
              id="from"
              type="date"
              className="input"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="to">
              To
            </label>
            <input
              id="to"
              type="date"
              className="input"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        </div>
      </div>
      <ErrorBanner message={report.error} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tokens" value={String(data?.totalTokens ?? 0)} hint={`${data?.completedTokens ?? 0} completed`} />
        <Stat label="Revenue" value={money(data?.totalRevenue ?? '0')} />
        <Stat label="Avg wait" value={`${data?.averageWaitMinutes ?? 0} min`} />
        <Stat label="Chair utilisation" value={`${data?.chairUtilizationPercent ?? 0}%`} hint={`${data?.cancellationRatePercent ?? 0}% cancelled`} />
      </div>

      <Section title="Peak hours">
        {data?.peakHours.length ? (
          <div className="card flex items-end gap-2">
            {data.peakHours.map((entry) => {
              const max = Math.max(...data.peakHours.map((item) => item.tokens), 1);
              return (
                <div key={entry.hour} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-ink"
                    style={{ height: `${Math.max(4, (entry.tokens / max) * 120)}px` }}
                  />
                  <span className="text-[10px] text-slate-500">{entry.hour}:00</span>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>No token activity in this range.</Empty>
        )}
      </Section>

      <Section title="Employees">
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Employee</th>
                <th className="th">Customers</th>
                <th className="th">Services</th>
                <th className="th">Revenue</th>
                <th className="th">Avg service</th>
              </tr>
            </thead>
            <tbody>
              {(data?.employees ?? []).map((row) => (
                <tr key={row.employeeId}>
                  <td className="td">{row.employeeName}</td>
                  <td className="td">{row.customersServed}</td>
                  <td className="td">{row.servicesCompleted}</td>
                  <td className="td">{money(row.revenue)}</td>
                  <td className="td">{row.averageServiceMinutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Services">
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Service</th>
                <th className="th">Times performed</th>
                <th className="th">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(data?.services ?? []).map((row) => (
                <tr key={row.serviceId}>
                  <td className="td">{row.serviceName}</td>
                  <td className="td">{row.timesPerformed}</td>
                  <td className="td">{money(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Revenue by day">
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Date</th>
                <th className="th">Tokens</th>
                <th className="th">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(data?.revenueByDay ?? []).map((row) => (
                <tr key={row.date}>
                  <td className="td">{row.date}</td>
                  <td className="td">{row.tokens}</td>
                  <td className="td">{money(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
