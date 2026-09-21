"use client";

import type { CustomerDirectoryRow } from '@shared/index';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { dateTime, money } from '@/lib/format';
import { Empty, ErrorBanner } from '@/components/ui';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function CustomersPage() {
  const customers = useLoader<CustomerDirectoryRow[]>(
    () => api<CustomerDirectoryRow[]>('/api/reports/customers'),
    [],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">Everyone who has checked in with a phone number.</p>
      </div>
      <ErrorBanner message={customers.error} />

      {customers.loading ? (
        <Card>
          <CardContent className="space-y-2 pt-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : customers.data?.length === 0 ? (
        <Empty>No customer phone numbers captured yet.</Empty>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Total spend</TableHead>
                <TableHead>Last visit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(customers.data ?? []).map((row) => (
                <TableRow key={row.customerPhone}>
                  <TableCell className="font-medium">{row.customerPhone}</TableCell>
                  <TableCell>{row.customerName ?? '—'}</TableCell>
                  <TableCell>{row.visits}</TableCell>
                  <TableCell>{money(row.totalSpend)}</TableCell>
                  <TableCell>{dateTime(row.lastVisitAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
