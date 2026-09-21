"use client";

import type { PlatformOverview } from '@shared/index';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { money } from '@/lib/format';
import { ErrorBanner, Section, Stat, StatusPill } from '@/components/ui';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function PlatformPage() {
  const overview = useLoader<PlatformOverview>(
    () => api<PlatformOverview>('/api/salons/overview'),
    [],
    60000,
  );
  const data = overview.data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform overview</h1>
        <p className="text-sm text-muted-foreground">Aggregates across every salon on the platform.</p>
      </div>
      <ErrorBanner message={overview.error} />

      {overview.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
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
      )}

      <Section title="Salons">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Salon</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Chairs</TableHead>
                <TableHead>Tokens today</TableHead>
                <TableHead>Revenue today</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.salons ?? []).map((salon) => (
                <TableRow key={salon.id}>
                  <TableCell className="font-medium">{salon.name}</TableCell>
                  <TableCell>
                    <StatusPill status={salon.status} />
                  </TableCell>
                  <TableCell>{salon.employeeCount}</TableCell>
                  <TableCell>{salon.chairCount}</TableCell>
                  <TableCell>{salon.tokensToday}</TableCell>
                  <TableCell>{money(salon.revenueToday)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>
    </div>
  );
}
