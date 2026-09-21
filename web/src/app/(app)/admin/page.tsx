"use client";

import { useState } from 'react';
import type { SalonOverviewReport } from '@shared/index';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { money } from '@/lib/format';
import { Empty, ErrorBanner, Section, Stat } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salon dashboard</h1>
          <p className="text-sm text-muted-foreground">Performance for the selected date range.</p>
        </div>
        <div className="flex gap-3">
          <div>
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
      </div>
      <ErrorBanner message={report.error} />

      {report.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Tokens" value={String(data?.totalTokens ?? 0)} hint={`${data?.completedTokens ?? 0} completed`} />
          <Stat label="Revenue" value={money(data?.totalRevenue ?? '0')} />
          <Stat label="Avg wait" value={`${data?.averageWaitMinutes ?? 0} min`} />
          <Stat
            label="Chair utilisation"
            value={`${data?.chairUtilizationPercent ?? 0}%`}
            hint={`${data?.cancellationRatePercent ?? 0}% cancelled`}
          />
        </div>
      )}

      <Section title="Peak hours">
        {data?.peakHours.length ? (
          <Card>
            <CardContent className="flex items-end gap-2 pt-5">
              {data.peakHours.map((entry) => {
                const max = Math.max(...data.peakHours.map((item) => item.tokens), 1);
                return (
                  <div key={entry.hour} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-brand-600 to-accent-500"
                      style={{ height: `${Math.max(4, (entry.tokens / max) * 120)}px` }}
                    />
                    <span className="text-[10px] text-muted-foreground">{entry.hour}:00</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          <Empty>No token activity in this range.</Empty>
        )}
      </Section>

      <Section title="Employees">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Customers</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Avg service</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.employees ?? []).map((row) => (
                <TableRow key={row.employeeId}>
                  <TableCell className="font-medium">{row.employeeName}</TableCell>
                  <TableCell>{row.customersServed}</TableCell>
                  <TableCell>{row.servicesCompleted}</TableCell>
                  <TableCell>{money(row.revenue)}</TableCell>
                  <TableCell>{row.averageServiceMinutes} min</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section title="Services">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Times performed</TableHead>
                <TableHead>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.services ?? []).map((row) => (
                <TableRow key={row.serviceId}>
                  <TableCell className="font-medium">{row.serviceName}</TableCell>
                  <TableCell>{row.timesPerformed}</TableCell>
                  <TableCell>{money(row.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section title="Revenue by day">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.revenueByDay ?? []).map((row) => (
                <TableRow key={row.date}>
                  <TableCell className="font-medium">{row.date}</TableCell>
                  <TableCell>{row.tokens}</TableCell>
                  <TableCell>{money(row.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>
    </div>
  );
}
