"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Printer, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Bill, TokenSummary } from '@shared/index';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLoader } from '@/lib/usePolling';
import { useSalonEvents } from '@/lib/socket';
import { dateTime, money } from '@/lib/format';
import { Empty, ErrorBanner, Section, StatusPill } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * A single "Billing" section covering the whole payment flow: search by
 * token number, see tokens still awaiting payment (jump to checkout), see
 * paid bills (reprint). There's no separate "mark as pending" action — a
 * token is pending until a bill exists for it, and a bill only exists once
 * checkout completes, so "paid" is a fact derived from the data rather than
 * a toggle.
 */
export default function BillingPage() {
  const { user } = useAuth();
  const salonId = user?.salonId ?? null;
  const [search, setSearch] = useState('');

  const pending = useLoader<TokenSummary[]>(
    () =>
      api<TokenSummary[]>('/api/tokens', {
        query: { salonId: salonId ?? undefined, status: 'awaiting_payment', tokenNumber: search || undefined },
      }),
    [salonId, search],
    15000,
  );
  const bills = useLoader<Bill[]>(
    () => api<Bill[]>('/api/bills', { query: { tokenNumber: search || undefined } }),
    [search],
  );

  useSalonEvents(salonId, () => {
    pending.reload();
    bills.reload();
  });

  const pendingList = useMemo(() => pending.data ?? [], [pending.data]);
  const billList = useMemo(() => bills.data ?? [], [bills.data]);

  async function reprint(billId: string) {
    try {
      await api(`/api/bills/${billId}/print`, { method: 'POST' });
      toast.success('Sent to printer');
    } catch (cause) {
      toast.error((cause as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Search any token, see what&rsquo;s pending payment, and reprint paid receipts.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by token number…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <ErrorBanner message={pending.error ?? bills.error} />

      <Section title="Pending" description={`${pendingList.length} awaiting payment`}>
        {pending.loading ? (
          <Card>
            <CardContent className="space-y-2 pt-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ) : pendingList.length === 0 ? (
          <Empty>{search ? 'No pending tokens match that search.' : 'Nothing awaiting payment right now.'}</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pendingList.map((token) => (
              <Card key={token.id}>
                <CardContent className="flex items-center justify-between gap-4 pt-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold">{token.tokenNumber}</p>
                      <StatusPill status={token.status} />
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {token.customerName ?? 'Walk-in'} · {money(token.totalPrice)}
                    </p>
                  </div>
                  <Button asChild className="shrink-0">
                    <Link href={`/reception/checkout/${token.id}`}>Checkout</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Paid" description={`${billList.length} bill(s)`}>
        {bills.loading ? (
          <Card>
            <CardContent className="space-y-2 pt-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ) : billList.length === 0 ? (
          <Empty>{search ? 'No paid bills match that search.' : 'No bills yet today.'}</Empty>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Stylist</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid at</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {billList.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-semibold">{bill.tokenNumber}</TableCell>
                    <TableCell>{bill.customerName ?? '—'}</TableCell>
                    <TableCell>{bill.employeeName ?? '—'}</TableCell>
                    <TableCell className="capitalize">{bill.paymentMethod}</TableCell>
                    <TableCell>{money(bill.total)}</TableCell>
                    <TableCell>{dateTime(bill.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" type="button" onClick={() => reprint(bill.id)}>
                        <Printer className="h-4 w-4" /> Reprint
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </Section>
    </div>
  );
}
