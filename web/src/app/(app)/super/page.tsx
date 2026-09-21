"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, Banknote, CalendarDays, Store, TicketCheck } from 'lucide-react';
import type { PlatformOverview } from '@shared/index';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { money } from '@/lib/format';
import { Empty, ErrorBanner, GradientStat, Section, StatusPill } from '@/components/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AttentionItem {
  key: string;
  severity: 'urgent' | 'warning';
  title: string;
  detail: string;
}

export default function PlatformPage() {
  const { user } = useAuth();
  const overview = useLoader<PlatformOverview>(
    () => api<PlatformOverview>('/api/salons/overview'),
    [],
    60000,
  );
  const data = overview.data;

  const attention = useMemo<AttentionItem[]>(() => {
    if (!data) return [];
    const items: AttentionItem[] = [];

    for (const salon of data.salons) {
      if (salon.status === 'suspended') {
        items.push({
          key: `suspended-${salon.id}`,
          severity: 'urgent',
          title: `${salon.name} is suspended`,
          detail: 'No staff can sign in until it is reactivated',
        });
      } else if (salon.chairCount === 0) {
        items.push({
          key: `no-chairs-${salon.id}`,
          severity: 'warning',
          title: `${salon.name} has no chairs set up`,
          detail: 'Customers can\u2019t be checked in yet',
        });
      } else if (salon.tokensToday === 0) {
        items.push({
          key: `dormant-${salon.id}`,
          severity: 'warning',
          title: `${salon.name} has had no tokens today`,
          detail: 'Worth checking in — could be a setup issue or an offline kiosk',
        });
      }
    }

    return items;
  }, [data]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back{user ? `, ${user.name.split(' ')[0]}!` : '!'}
        </h1>
        <p className="text-sm text-muted-foreground">Aggregates across every salon on the platform.</p>
      </div>
      <ErrorBanner message={overview.error} />

      {overview.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GradientStat
            tone="purple"
            icon={Store}
            label="Salons"
            value={String(data?.totalSalons ?? 0)}
            hint={`${data?.activeSalons ?? 0} active · ${data?.suspendedSalons ?? 0} suspended`}
          />
          <GradientStat
            tone="violet"
            icon={TicketCheck}
            label="Tokens today"
            value={String(data?.tokensToday ?? 0)}
          />
          <GradientStat
            tone="orange"
            icon={Banknote}
            label="Revenue today"
            value={money(data?.revenueToday ?? '0')}
          />
          <GradientStat
            tone="slate"
            icon={CalendarDays}
            label="Revenue this month"
            value={money(data?.revenueThisMonth ?? '0')}
            hint={`${data?.tokensThisMonth ?? 0} tokens`}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Salons</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salon</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell>{salon.chairCount}</TableCell>
                    <TableCell>{salon.tokensToday}</TableCell>
                    <TableCell>{money(salon.revenueToday)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Needs attention
            </CardTitle>
            {attention.length > 0 ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-xs font-bold text-destructive">
                {attention.length}
              </span>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {attention.length === 0 ? (
              <Empty>Every salon looks healthy.</Empty>
            ) : (
              attention.map((item) => (
                <div key={item.key} className="rounded-lg border border-border p-3">
                  <span
                    className={
                      item.severity === 'urgent'
                        ? 'text-xs font-semibold uppercase tracking-wide text-destructive'
                        : 'text-xs font-semibold uppercase tracking-wide text-amber-600'
                    }
                  >
                    {item.severity === 'urgent' ? 'Urgent' : 'Heads up'}
                  </span>
                  <p className="mt-1 text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Section title="Provision a new salon">
        <p className="text-sm text-muted-foreground">
          Head to the{' '}
          <Link href="/super/salons" className="text-brand-700 hover:underline">
            Salons page
          </Link>{' '}
          to create a new salon profile and its first admin account.
        </p>
      </Section>
    </div>
  );
}
