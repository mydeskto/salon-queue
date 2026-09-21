"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Banknote, Clock3, MonitorSmartphone, TicketCheck } from 'lucide-react';
import type { SalonOverviewReport, StaffUser, TokenSummary } from '@shared/index';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { minutesSince, money } from '@/lib/format';
import { Empty, ErrorBanner, GradientStat, Section } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const LONG_WAIT_MINUTES = 20;
const OFFLINE_MINUTES = 15;

interface AttentionItem {
  key: string;
  severity: 'urgent' | 'warning';
  title: string;
  detail: string;
  timeAgo: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [from, setFrom] = useState(isoDaysAgo(6));
  const [to, setTo] = useState(isoDaysAgo(0));

  const report = useLoader<SalonOverviewReport>(
    () => api<SalonOverviewReport>('/api/reports/overview', { query: { from, to } }),
    [from, to],
  );
  const tokens = useLoader<TokenSummary[]>(() => api<TokenSummary[]>('/api/tokens'), [], 30000);
  const staff = useLoader<StaffUser[]>(() => api<StaffUser[]>('/api/staff'), [], 60000);
  const data = report.data;

  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    for (const token of tokens.data ?? []) {
      if (token.status !== 'waiting') continue;
      const waited = minutesSince(token.createdAt);
      if (waited >= LONG_WAIT_MINUTES) {
        items.push({
          key: `token-${token.id}`,
          severity: waited >= LONG_WAIT_MINUTES * 2 ? 'urgent' : 'warning',
          title: `Token ${token.tokenNumber} still waiting`,
          detail: token.customerName ? `${token.customerName} · no chair assigned yet` : 'No chair assigned yet',
          timeAgo: `${waited} min ago`,
        });
      }
    }

    for (const member of staff.data ?? []) {
      if (member.role !== 'kiosk') continue;
      if (member.status === 'unpaired') {
        items.push({
          key: `kiosk-unpaired-${member.id}`,
          severity: 'warning',
          title: `"${member.name}" not paired yet`,
          detail: 'Waiting for the device to enter its pairing code',
          timeAgo: '',
        });
        continue;
      }
      const idleMinutes = member.lastSeenAt ? minutesSince(member.lastSeenAt) : null;
      if (idleMinutes === null || idleMinutes >= OFFLINE_MINUTES) {
        items.push({
          key: `kiosk-offline-${member.id}`,
          severity: 'urgent',
          title: `"${member.name}" looks offline`,
          detail: member.lastSeenAt ? 'Last seen a while ago' : 'Never checked in',
          timeAgo: idleMinutes !== null ? `${idleMinutes} min ago` : '',
        });
      }
    }

    return items;
  }, [tokens.data, staff.data]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back{user ? `, ${user.name.split(' ')[0]}!` : '!'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening at {user?.salonName ?? 'your salon'} right now.
        </p>
      </div>

      {report.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GradientStat
            tone="purple"
            icon={TicketCheck}
            label="Tokens"
            value={String(data?.totalTokens ?? 0)}
            hint={`${data?.completedTokens ?? 0} completed`}
          />
          <GradientStat
            tone="violet"
            icon={Banknote}
            label="Revenue"
            value={money(data?.totalRevenue ?? '0')}
          />
          <GradientStat
            tone="orange"
            icon={Clock3}
            label="Avg wait"
            value={`${data?.averageWaitMinutes ?? 0} min`}
          />
          <GradientStat
            tone="slate"
            icon={MonitorSmartphone}
            label="Chair utilisation"
            value={`${data?.chairUtilizationPercent ?? 0}%`}
            hint={`${data?.cancellationRatePercent ?? 0}% cancelled`}
          />
        </div>
      )}

      <ErrorBanner message={report.error ?? tokens.error ?? staff.error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Peak hours</CardTitle>
            <div className="flex gap-2">
              <div>
                <Label htmlFor="from" className="sr-only">
                  From
                </Label>
                <Input id="from" type="date" className="h-8 text-xs" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="to" className="sr-only">
                  To
                </Label>
                <Input id="to" type="date" className="h-8 text-xs" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data?.peakHours.length ? (
              <div className="flex items-end gap-2">
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
              </div>
            ) : (
              <Empty>No token activity in this range.</Empty>
            )}
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
              <Empty>Nothing needs attention right now.</Empty>
            ) : (
              attention.map((item) => (
                <div key={item.key} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={
                        item.severity === 'urgent'
                          ? 'text-xs font-semibold uppercase tracking-wide text-destructive'
                          : 'text-xs font-semibold uppercase tracking-wide text-amber-600'
                      }
                    >
                      {item.severity === 'urgent' ? 'Urgent' : 'Heads up'}
                    </span>
                    {item.timeAgo ? (
                      <span className="text-xs text-muted-foreground">{item.timeAgo}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

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

      <p className="text-right text-xs text-muted-foreground">
        Manage kiosk screens on the{' '}
        <Link href="/admin/staff" className="text-brand-700 hover:underline">
          staff page
        </Link>
        .
      </p>
    </div>
  );
}
