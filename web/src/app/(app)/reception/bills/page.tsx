"use client";

import { toast } from 'sonner';
import type { Bill } from '@shared/index';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { dateTime, money } from '@/lib/format';
import { Empty, ErrorBanner } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function BillsPage() {
  const bills = useLoader<Bill[]>(() => api<Bill[]>('/api/bills'), []);

  async function reprint(billId: string) {
    try {
      await api(`/api/bills/${billId}/print`, { method: 'POST' });
      toast.success('Sent to printer');
    } catch (cause) {
      toast.error((cause as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bills</h1>
        <p className="text-sm text-muted-foreground">Completed transactions.</p>
      </div>
      <ErrorBanner message={bills.error} />

      {bills.loading ? (
        <Card>
          <CardContent className="space-y-2 pt-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : bills.data?.length === 0 ? (
        <Empty>No bills yet today.</Empty>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Stylist</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(bills.data ?? []).map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-semibold">{bill.tokenNumber}</TableCell>
                  <TableCell>{bill.customerName ?? '—'}</TableCell>
                  <TableCell>{bill.employeeName ?? '—'}</TableCell>
                  <TableCell>{money(bill.total)}</TableCell>
                  <TableCell>{dateTime(bill.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" type="button" onClick={() => reprint(bill.id)}>
                      Reprint
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
